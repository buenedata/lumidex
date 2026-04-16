# TCGGO Pricing System — Architecture Document

**Status:** Design (not yet implemented)  
**Date:** 2026-04-16  
**Context:** Full teardown of the old pricing system is complete. All old tables (`card_prices`, `card_price_history`, `card_graded_prices`, `price_points`, `ebay_oauth_tokens`, `ebay_webhooks`) have been dropped via [`database/migration_pricing_teardown.sql`](../database/migration_pricing_teardown.sql). The new system is powered exclusively by the TCGGO API via RapidAPI.

---

## 3.1 — TCGGO API Summary

**Base URL:** `https://cardmarket-api-tcg.p.rapidapi.com`  
**Auth:** `x-rapidapi-key` header (RapidAPI key stored in env)  
**Game param:** always `pokemon` for this project

### Relevant Endpoints

#### A. Episode Cards — Batch price fetch for a whole set
```
GET /pokemon/episodes/{episodeId}/cards?per_page=100&page=1
```
- Returns all cards for a TCGGO "episode" (= our set), paginated (max 100/page)
- **Each card includes inline prices** — no separate price fetch needed
- `episodeId` = `sets.api_set_id` (integer, already in our DB)
- **This is the primary endpoint for batch syncing a set's prices**

Key price fields per card:
```json
{
  "id": 3624,
  "tcgid": "swsh12pt5-1",
  "prices": {
    "cardmarket": {
      "currency": "EUR",
      "lowest_near_mint": 0.02,
      "30d_average": 0.04,
      "7d_average": 0.04,
      "graded": []
    },
    "tcg_player": {
      "currency": "EUR",
      "market_price": 0.06,
      "mid_price": 0.09
    }
  }
}
```

#### B. Cards Search — Single/batch card lookup
```
GET /pokemon/cards/search?ids=3852,3853,3854   (max 20 per request)
GET /pokemon/cards/search?tcgids=sv3-223,sv3-224  (max 20 per request)
GET /pokemon/cards/search?id=3852
```
- Returns same price structure as episode cards
- Useful for updating individual cards by their `tcggo_id`
- Max 20 IDs per batch call

#### C. History Prices — For the price chart (PREFERRED, non-deprecated)
```
GET /pokemon/history-prices?id={tcggo_id}&date_from=YYYY-MM-DD&sort=asc
```
- Returns date-keyed object, 30 entries per page
- Can filter by `date_from`, `date_to`, `sort` (asc/desc), `lang` (en/de/fr/es/it)
- Fields: `cm_low` (EUR) + `tcg_player_market` (EUR, nullable)
- Use `id` (TCGGO internal ID = `cards.tcggo_id`) for lookup

Example response:
```json
{
  "data": {
    "2026-04-04": { "cm_low": 0.02, "tcg_player_market": 0.06 },
    "2026-03-29": { "cm_low": 0.03, "tcg_player_market": 0.06 }
  },
  "paging": { "current": 1, "total": 1, "per_page": 30 },
  "results": 2
}
```

**Note:** `/{game}/cards/{itemId}/history-prices` is **deprecated** — use the query-param version above.

### Stable Identifier

| Our DB | TCGGO API | Type |
|--------|-----------|------|
| `cards.tcggo_id` | `id` in every card response | `integer` |
| `sets.api_set_id` | `episode.id` | `integer` |

Both already exist in the Lumidex database and are **preserved through the teardown**.

### ⚠ Important Currency Note
Despite the label "TCGPlayer", TCGGO returns **all prices in EUR** (`"currency": "EUR"` appears in both `cardmarket` and `tcg_player` blocks). The [`lib/currency.ts`](../lib/currency.ts) `EUR_TO_USD` conversion factor (`1.09`) applies to both sources.

### Rate Limit Considerations
Rate limits are not documented in the API spec — they are plan-dependent on RapidAPI. Design principles we follow regardless:
- **Never fetch per-card individually when a set-level batch endpoint exists**
- Cache all prices aggressively (24h TTL for current prices, fetched once per set visit)
- Guard all TCGGO calls server-side (never expose the API key to the browser)
- Handle `429` responses gracefully (return stale data from DB, log warning)

---

## 3.2 — Database Schema (Minimal)

Two new tables. Nothing more.

```sql
-- ── Migration: migration_tcggo_pricing.sql ────────────────────────

-- 1. Re-add prices_last_synced_at to sets
--    (was dropped in teardown; needed to track set-level cache staleness)
ALTER TABLE public.sets
  ADD COLUMN IF NOT EXISTS prices_last_synced_at TIMESTAMPTZ;

-- 2. Current price snapshot — one row per card
--    Upserted on every set sync. Updated in-place.
CREATE TABLE IF NOT EXISTS public.card_prices (
  card_id          UUID        PRIMARY KEY
                               REFERENCES public.cards(id) ON DELETE CASCADE,
  tcggo_id         INTEGER,    -- denormalized from cards.tcggo_id for debug/reference
  cm_low_eur       NUMERIC,    -- CardMarket: lowest near mint (EUR)
  tcgp_market_eur  NUMERIC,    -- TCGPlayer: market price (EUR per TCGGO response)
  fetched_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Price history — time-series for the chart
--    One row per card per date. UNIQUE prevents duplicates on re-sync.
CREATE TABLE IF NOT EXISTS public.card_price_history (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id          UUID        NOT NULL
                               REFERENCES public.cards(id) ON DELETE CASCADE,
  price_date       DATE        NOT NULL,
  cm_low_eur       NUMERIC,
  tcgp_market_eur  NUMERIC,    -- nullable; not all cards have TCGPlayer data
  recorded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (card_id, price_date)
);

-- ── Indexes ──────────────────────────────────────────────────────

-- Fast lookup of all prices for a set's cards
CREATE INDEX IF NOT EXISTS idx_card_prices_card_id
  ON public.card_prices(card_id);

-- Fast time-range queries for chart
CREATE INDEX IF NOT EXISTS idx_card_price_history_card_date
  ON public.card_price_history(card_id, price_date DESC);

-- ── RLS ──────────────────────────────────────────────────────────
-- Prices are public data — readable by everyone, writable only via service role

ALTER TABLE public.card_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "card_prices_public_read"
  ON public.card_prices FOR SELECT USING (true);

ALTER TABLE public.card_price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "card_price_history_public_read"
  ON public.card_price_history FOR SELECT USING (true);
```

### Why This Schema

| Decision | Rationale |
|----------|-----------|
| `card_prices` has no `id` UUID — uses `card_id` as PK | One row per card, always upserted. No need for a surrogate key. |
| All prices stored as EUR | TCGGO returns EUR for both CardMarket and TCGPlayer. No lossy conversion at write time — convert at read time using `EUR_TO_USD`. |
| No variant-level price columns | TCGGO provides a single market price per card, not per variant (Normal/Reverse/Holo). The old multi-column approach is gone. |
| `card_price_history` deduped by `(card_id, price_date)` | Safe to re-run syncs without creating duplicate time-series rows. |
| `sets.prices_last_synced_at` re-added | One timestamp per set is sufficient to decide if a batch sync is needed. Much cheaper than inspecting `fetched_at` across all card rows. |

---

## 3.3 — Update Strategy: On-Demand Set Sync (TTL-Based)

**Chosen approach: Set-level on-demand sync with a 24-hour TTL cache**

### How It Works

```
User visits /sets/[setId]
  └─ Server checks sets.prices_last_synced_at
       ├─ NULL or > 24h ago?
       │    └─ Call TCGGO /pokemon/episodes/{api_set_id}/cards (paginated)
       │         └─ Upsert all card prices into card_prices
       │              └─ Update sets.prices_last_synced_at = NOW()
       └─ Return card prices map to the page
```

### Justification

| Option | Pros | Cons |
|--------|------|------|
| **On-demand set sync (chosen)** | Simple, no cron dependency, prices refresh organically as sets are visited | First user to visit a stale set waits for TCGGO call |
| Scheduled batch (cron) | Always fresh | Complex, needs cron infra, fetches prices for sets nobody is viewing |
| Per-card on-demand | Only fetch what's viewed | 200 individual API calls for a set page load (catastrophic) |

**The chosen approach is the right balance.** A set page visit triggers at most a few paginated TCGGO calls (a 200-card set = 2 pages). The response is cached for 24h. Subsequent visits within 24h skip TCGGO entirely and read from Supabase.

For price history (chart), the same pattern applies at the card level: fetch from TCGGO when the user opens the Price tab, cache the result in `card_price_history` for 7 days.

### TTL Values

| Data | TTL | Why |
|------|-----|-----|
| Set current prices (`card_prices`) | 24h | Card prices don't change hour-by-hour |
| Card price history (`card_price_history`) | 7 days | Historical data is stable; TCGGO adds ~1 point/day |

---

## 3.4 — API Layer Design (2 Routes)

### Route 1 — `GET /api/prices/set/[setId]`

**Purpose:** Returns current prices for all cards in a set. Triggers a TCGGO sync if the set's prices are stale.

```
Request:  GET /api/prices/set/sv8
Response: { prices: { [cardId]: { cm_low_eur: number | null, tcgp_market_eur: number | null, fetched_at: string } } }
```

**Server logic:**
```
1. Fetch from DB:
     SELECT prices_last_synced_at, api_set_id FROM sets WHERE set_id = $setId

2. IF prices_last_synced_at IS NULL OR (NOW() - prices_last_synced_at) > 24h:
     a. Paginate: GET /pokemon/episodes/{api_set_id}/cards?per_page=100&page=1,2,...
     b. For each card in response:
          - Find our card_id via tcggo_id lookup:
            SELECT id FROM cards WHERE tcggo_id = {card.id} AND set_id = $setId
          - If found: UPSERT into card_prices(card_id, tcggo_id, cm_low_eur, tcgp_market_eur, fetched_at)
     c. UPDATE sets SET prices_last_synced_at = NOW() WHERE set_id = $setId

3. SELECT cp.card_id, cm_low_eur, tcgp_market_eur, fetched_at
   FROM card_prices cp
   JOIN cards c ON c.id = cp.card_id
   WHERE c.set_id = $setId

4. Return as { prices: { [card_id]: { cm_low_eur, tcgp_market_eur, fetched_at } } }
```

**Caching headers:**
```
Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400
```
(1h fresh on CDN, serve stale for up to 24h while revalidating)

**Edge case handling:**
- `api_set_id` is null → return `{ prices: {} }` (set not mapped in TCGGO)
- TCGGO returns 429 → return whatever is in DB (stale data is better than nothing), do NOT update `prices_last_synced_at`
- Card has no `tcggo_id` → skip silently

---

### Route 2 — `GET /api/prices/card/[cardId]/history`

**Purpose:** Returns price history points for the PriceChart component. Fetches from TCGGO on first request; caches in DB.

```
Request:  GET /api/prices/card/[cardId]/history?days=30
Response: { history: PriceHistoryPoint[] }
```

**Server logic:**
```
1. Fetch card's tcggo_id: SELECT tcggo_id FROM cards WHERE id = $cardId
   - If NULL → return { history: [] }

2. Check cache: SELECT price_date, cm_low_eur, tcgp_market_eur
   FROM card_price_history
   WHERE card_id = $cardId AND price_date >= NOW() - INTERVAL '$days days'
   ORDER BY price_date ASC

3. IF result set is empty OR oldest row is younger than 7 days ago (no historical depth):
     a. date_from = (NOW() - $days days).toISOString().split('T')[0]
     b. Call: GET /pokemon/history-prices?id={tcggo_id}&date_from={date_from}&sort=asc
        (paginate if paging.total > 1)
     c. UPSERT each date entry into card_price_history ON CONFLICT (card_id, price_date) DO UPDATE

4. Re-query DB and return as PriceHistoryPoint[]
```

**Mapping to `PriceHistoryPoint` (see types/index.ts):**

| TCGGO Field | `variantKey` | `source` |
|-------------|-------------|--------|
| `cm_low` | `"cm_low"` | `"cardmarket"` |
| `tcg_player_market` | `"tcgp_market"` | `"tcgplayer"` |

Each date produces two `PriceHistoryPoint` entries (one per source, if non-null). The `priceUsd` field stores the EUR value — conversion happens at display time in the chart via `formatPrice(value * EUR_TO_USD, currency)`.

**Caching headers:**
```
Cache-Control: private, max-age=3600
```

---

## 3.5 — Frontend Integration

### SetPageCards — Set-level price stats

[`components/SetPageCards.tsx`](../components/SetPageCards.tsx) already accepts:
- `cardPricesUSD: Record<string, number>` — the "best price" per card in USD
- `statMostExpensiveUSD`, `statSetValueUSD`, `statMostExpensiveName`

**What to change:** The set page (server component) calls `/api/prices/set/[setId]` and transforms the result:

```typescript
// Convert EUR → USD using EUR_TO_USD, pick preferred source
const cardPricesUSD: Record<string, number> = {}
for (const [cardId, p] of Object.entries(prices)) {
  const eur = priceSource === 'cardmarket' ? p.cm_low_eur : (p.tcgp_market_eur ?? p.cm_low_eur)
  if (eur != null) cardPricesUSD[cardId] = eur * EUR_TO_USD
}
```

Stats (`statSetValueUSD`, `statMostExpensiveUSD`) are computed server-side from `cardPricesUSD`.

**Graceful empty state:** If `prices` is empty (`api_set_id` not mapped or TCGGO error), pass empty `cardPricesUSD`. The price sort option in SetPageCards already handles this (all prices treated as 0).

---

### CardGrid — Price Tab

[`components/CardGrid.tsx`](../components/CardGrid.tsx) currently has two fetches in the Price tab:
1. `cardPriceCache` — snapshot of multi-variant prices from the old `/api/cards/prices/[cardId]` route
2. `priceHistoryCache` — from the old history route

**New behavior:**

**Current price snapshot** — no separate API call needed. Since the set page already loaded `cardPricesUSD`, the Price tab can display the best price from that map immediately. For a richer breakdown (both CM and TCGPlayer), the route `/api/prices/set/[setId]` returns both `cm_low_eur` and `tcgp_market_eur` — consider passing a richer `cardPrices` prop that includes both.

```typescript
// CardGrid receives the prices map with both values
interface CardPriceData {
  cm_low_eur: number | null
  tcgp_market_eur: number | null
  fetched_at: string
}
// cardPrices: Record<string, CardPriceData>  (new prop, replaces cardPricesUSD for the modal)
```

**Price history chart** — lazy-fetch `/api/prices/card/[cardId]/history?days=7` when the Price tab is first opened (same pattern as before, just a new URL).

**⚠ Simplification:** The old Price tab showed Normal / Reverse Holo / Holo / 1st Edition variant-level prices (from TCGPlayer). TCGGO does not provide per-variant prices — only a single market price per card. **The variant price rows in the modal must be simplified to show two rows: CardMarket and TCGPlayer.**

---

### PriceChart — Updated Variant Config

[`components/PriceChart.tsx`](../components/PriceChart.tsx) `VARIANT_CONFIG` needs two new entries:

```typescript
const VARIANT_CONFIG = {
  // ... existing entries can stay (for backward compat with any legacy data)
  cm_low:      { label: 'CardMarket Low',    color: '#3b82f6' }, // blue
  tcgp_market: { label: 'TCGPlayer Market',  color: '#eab308' }, // yellow
}
```

The `priceSource` filter already works: when user prefers `'cardmarket'`, the chart naturally emphasizes `cm_low`. The existing filtering logic in PriceChart (`filteredHistory`) handles source preference correctly — no changes needed there as long as `PriceHistoryPoint.source` is populated correctly (`'cardmarket'` or `'tcgplayer'`).

---

### Graceful Degradation

| State | UI Behavior |
|-------|-------------|
| `prices_last_synced_at` is null | Show `—` price pills; no error shown to user |
| TCGGO returns 429 | Serve stale DB data if available; no error shown |
| Card has no `tcggo_id` | Price shows `—`; history chart shows empty state ("No price data available") |
| History fetch fails | Chart shows empty state with retry option |

---

## 3.6 — Implementation Plan (Step-by-Step)

Execute in this order in a single focused coding session:

1. **Run teardown migration** — Execute [`database/migration_pricing_teardown.sql`](../database/migration_pricing_teardown.sql) in Supabase dashboard (if not already done).

2. **Create new pricing migration** — Create `database/migration_tcggo_pricing.sql` with the schema from §3.2. Run it in Supabase. Adds: `card_prices`, `card_price_history`, re-adds `sets.prices_last_synced_at`.

3. **Add env variable** — Add `TCGGO_RAPIDAPI_KEY=...` to `.env.local` and Vercel environment.

4. **Create lib/tcggo.ts** — A thin client for TCGGO API calls:
   - `fetchEpisodeCards(episodeId: number, page: number)` — wraps `/pokemon/episodes/{id}/cards`
   - `fetchCardHistory(tcggoId: number, dateFrom: string)` — wraps `/pokemon/history-prices?id=...`
   - Handles auth header, base URL, error/429 handling

5. **Create `app/api/prices/set/[setId]/route.ts`** — Implements the set sync logic from §3.4. Uses supabase service role client.

6. **Create `app/api/prices/card/[cardId]/history/route.ts`** — Implements the history fetch logic from §3.4.

7. **Update `types/index.ts`**:
   - Keep `PriceHistoryPoint` as-is (still works)
   - Add `CardPriceData` interface: `{ cm_low_eur: number | null, tcgp_market_eur: number | null, fetched_at: string }`
   - Remove `PriceSource` type if no longer needed (or keep for currency preferences)

8. **Update `components/PriceChart.tsx`** — Add `cm_low` and `tcgp_market` to `VARIANT_CONFIG`.

9. **Update `components/CardGrid.tsx`** — 
   - Replace old `/api/cards/prices/[cardId]` fetch with a read from the passed `cardPrices` prop
   - Update the `/api/cards/prices/[cardId]/history` fetch URL to `/api/prices/card/[cardId]/history`
   - Simplify the Price tab current-price snapshot (2 rows: CM + TCGP, not 4 variant rows)

10. **Update set page server component** (e.g. `app/sets/[setId]/page.tsx`) — Fetch from `/api/prices/set/[setId]`, pass transformed `cardPrices` to `SetPageCards`.

11. **Update `components/SetPageCards.tsx`** — Accept the new `cardPrices: Record<string, CardPriceData>` prop alongside (or replacing) `cardPricesUSD`. Compute stats server-side or in the component from `cm_low_eur` + `tcgp_market_eur`.

12. **Test end-to-end** on a set that has `api_set_id` populated. Verify:  
    - Set page loads prices on first visit (triggers sync)
    - Second visit within 24h skips TCGGO
    - Price tab in card modal shows CM + TCGP prices
    - Price chart loads 7-day history

13. **Admin page cleanup** — `app/admin/prices/page.tsx` can be simplified to a "Sync Set Prices" button that POSTs to the set sync route manually (for cache busting).

---

## Open Questions / Concerns

| # | Question | Recommendation |
|---|----------|----------------|
| 1 | **RapidAPI rate limits** — unknown from spec | Log all TCGGO calls; monitor for 429s after launch. Increase TTL to 48h if hitting limits. |
| 2 | **TCGPlayer prices in EUR** — `tcg_player.currency: "EUR"` in TCGGO API. Is this actually EUR, or is it a label error? | Treat as EUR and apply `EUR_TO_USD`. Spot-check against TCGPlayer.com. |
| 3 | **Cards with null `tcggo_id`** — admin imports might not populate this | Add a note to the admin card import flow. Cards without `tcggo_id` silently show no price. |
| 4 | **Set page concurrency** — two users visit a stale set simultaneously. Two sync jobs run? | Accept this; both upsert the same data. No corrupt state, just a redundant TCGGO call. Add DB locking if it becomes a problem. |
| 5 | **`priceUsd` field name** — `PriceHistoryPoint.priceUsd` is misleading (values are EUR) | Rename to `priceValue` + add `currency: string` field. Low priority — the chart converts correctly today. |
| 6 | **History endpoint pagination** — 30 results/page; 1 year of daily data = 12+ pages | For now, only fetch 1 page (30 points ≈ 1 month). Pro users' 1-year chart would need multi-page fetch. Implement as needed. |

---

*End of architecture document. Reviewed and ready for implementation.*
