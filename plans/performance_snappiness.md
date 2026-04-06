# Performance & Snappiness Plan

## Priority: CRITICAL — Variant button 3-second delay

---

## Root Cause Analysis

### #1 — 3 Sequential DB Round-trips on Every Variant Click (PRIMARY CAUSE)

`PATCH /api/user-card-variants` (called on every variant dot click) executes:

1. `SELECT quantity FROM user_card_variants WHERE ...` → fetch current qty
2. `SELECT key FROM variants WHERE id = ?` → legacy variant_type lookup
3. `UPSERT INTO user_card_variants` → write new qty

Each Supabase round-trip from Vercel = 200–500ms. Total = 600–1500ms before the JS response
even leaves the server. Add browser→Vercel network + cold starts = 2–3 seconds total.

After the API call resolves, `updateCardQuantity()` in the Zustand store is `await`ed, which
fires a 4th DB write (`UPSERT user_cards`) — the legacy sync.

### #2 — No Optimistic UI Updates

`handleVariantClick` → `updateVariantQuantity()` fully `await`s the API before calling
`setCardQuickVariants()`. The variant dot shows the wrong (old) quantity the entire time.

### #3 — PATCH Does Read-Then-Write Instead of Atomic Upsert

Postgres can increment with no read round-trip:
```sql
INSERT INTO user_card_variants (user_id, card_id, variant_id, quantity)
VALUES ($1, $2, $3, GREATEST(0, $4))
ON CONFLICT (user_id, card_id, variant_id)
DO UPDATE SET quantity = GREATEST(0, user_card_variants.quantity + $4)
RETURNING quantity;
```

### #4 — CardGrid is a 2053-Line Monolith with 20+ useState hooks

Any state change (including `isLoadingFriends`, `editingVariantId`, modal tab switches)
causes the entire 200+ card grid to re-render. Modal and card tiles must be isolated.

---

## Implementation Plan

### Phase 1 — Fix Variant Button Latency (Critical)

#### Step 1: Add a Postgres RPC `increment_user_card_variant`

Create a migration file `database/migration_increment_user_card_variant_rpc.sql`:

```sql
CREATE OR REPLACE FUNCTION increment_user_card_variant(
  p_user_id uuid,
  p_card_id uuid,
  p_variant_id uuid,
  p_increment integer
) RETURNS integer AS $$
DECLARE
  new_qty integer;
BEGIN
  IF p_increment > 0 THEN
    INSERT INTO user_card_variants (user_id, card_id, variant_id, quantity)
    VALUES (p_user_id, p_card_id, p_variant_id, p_increment)
    ON CONFLICT (user_id, card_id, variant_id)
    DO UPDATE SET quantity = GREATEST(0, user_card_variants.quantity + p_increment)
    RETURNING quantity INTO new_qty;
  ELSE
    UPDATE user_card_variants
    SET quantity = GREATEST(0, quantity + p_increment)
    WHERE user_id = p_user_id AND card_id = p_card_id AND variant_id = p_variant_id
    RETURNING quantity INTO new_qty;

    IF new_qty IS NULL THEN new_qty := 0; END IF;

    IF new_qty = 0 THEN
      DELETE FROM user_card_variants
      WHERE user_id = p_user_id AND card_id = p_card_id AND variant_id = p_variant_id;
    END IF;
  END IF;

  -- Sync legacy user_cards (fire-and-forget via outer transaction)
  RETURN COALESCE(new_qty, 0);
END;
$$ LANGUAGE plpgsql;
```

This reduces the PATCH from 3 sequential queries to 1 atomic call.

#### Step 2: Refactor `PATCH /api/user-card-variants`

Replace the read→compute→write pattern with a direct call to the RPC above. Remove the
`SELECT key FROM variants` lookup (drop `variant_type` population or accept NULL for PATCH
increments — it's a legacy field). This collapses 3 DB calls to 1.

#### Step 3: Refactor `POST /api/user-card-variants`

Same: remove the `SELECT key FROM variants` lookup and accept `variant_type = null` for the
direct-set case. The POST is used when the user types a quantity directly in the modal input —
it already has all the data it needs without the extra lookup.

#### Step 4: Add Optimistic Updates in `CardGrid.updateVariantQuantity()`

Before `fetch()`:
1. Compute expected new qty from current state
2. Call `setCardQuickVariants()` immediately with the optimistic value
3. `await` the API call
4. On success: reconcile `result.quantity` (overwrite optimistic with confirmed server value)
5. On error: revert to pre-click quantity + show a brief error indicator

Make `updateCardQuantity()` (the legacy store sync) fire-and-forget — remove the `await`.

---

### Phase 2 — Component Architecture (Reduce Re-render Scope)

#### Step 5: Extract `<CardModal>` from `CardGrid`

Move all modal-related state and JSX into a standalone `components/CardModal.tsx` file:
- `selectedCard`, `modalTab`, `cardPriceCache`, `isLoadingPrice`
- `priceHistoryCache`, `isLoadingHistory`, `gradedPriceCache`, `isLoadingGraded`
- `wantedCardIds`, `wantedLoading`, `wantedInitialized`
- `friendsCache`, `isLoadingFriends`
- `variantInputValues`, `hoveredVariantId`, `relatedCards`, `relatedCardsTotal`
- `editingVariantId`, `editForm`, `variantEditError`, `confirmDeleteId`, `isSavingEdit`

`CardGrid` passes a callback `onCardClick(card)` and the modal manages its own state.
This means a tab switch in the modal (price, friends, trade) no longer re-renders 200+ tiles.

#### Step 6: Memoize the `<CardTile>` component

Extract the per-card `<div key={card.id}>` block into `components/CardTile.tsx` wrapped in
`React.memo()`. Props: `card`, `quickVariants`, `isOwned`, `customVariantCount`,
`greyOutUnowned`, `cardPricesUSD`, `effectiveCurrency`, `onVariantClick`, `onCardClick`.

With optimistic updates happening via callbacks, `React.memo` can prevent re-rendering tiles
that weren't affected by the click.

---

### Phase 3 — API & Caching

#### Step 7: Cache variant definitions on the GET `/api/variants` endpoint

Variant definitions (colors, names, sort order) almost never change. The GET response that
doesn't include user quantities can be cached at the CDN edge:

```typescript
response.headers.set('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
```

The POST batch endpoint (which includes user quantities) should remain uncached.

#### Step 8: Move legacy `user_cards` sync to a background Postgres trigger

Instead of calling `updateCardQuantity()` from the client after every variant click,
add a Postgres trigger on `user_card_variants` that keeps `user_cards.quantity` in sync
server-side. This removes the sync responsibility from the application layer entirely.

---

### Phase 4 — Set Page Server Component Review

Check `app/set/[id]/page.tsx` for sequential `await`s that could be parallelized with
`Promise.all()`. The Speed Insights shows `/set/[id]` has a RES of 58 with 185 sessions —
the highest traffic route and the worst score.

---

## Expected Improvements

| Change | Expected Impact |
|--------|----------------|
| Optimistic updates | Instant variant button feedback (0ms perceived) |
| Atomic RPC (1 DB call instead of 3) | API response time: ~300ms → ~100ms |
| Remove variant_type lookup | Saves 1 DB round-trip per click |
| Fire-and-forget legacy sync | Removes blocking 4th DB call |
| CardModal extraction | Tab/modal interactions no longer re-render grid |
| CardTile memoization | Only clicked card re-renders, not all 200+ |
| Variant definition caching | Batch load served from CDN on repeat visits |
| Postgres trigger for user_cards | Removes client-side legacy sync entirely |

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `database/migration_increment_user_card_variant_rpc.sql` | NEW — atomic RPC |
| `database/migration_user_cards_sync_trigger.sql` | NEW — optional: server-side legacy sync |
| `app/api/user-card-variants/route.ts` | Refactor PATCH and POST |
| `components/CardGrid.tsx` | Add optimistic updates, extract modal and tile |
| `components/CardModal.tsx` | NEW — extracted modal |
| `components/CardTile.tsx` | NEW — memoized card tile |
| `app/api/variants/route.ts` | Add cache headers to GET response |
| `app/set/[id]/page.tsx` | Review for Promise.all parallelization |
