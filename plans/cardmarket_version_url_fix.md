# CardMarket Version URL & Cosmos Holo Price Fix

## Problem Summary

For **Charmander from the 151 set**, three bugs are present:

| Variant | Current URL | Correct URL |
|---|---|---|
| Normal | `Charmander-V3-MEW004` ❌ | `Charmander-V1-MEW004` |
| Cosmos Holo | `Charmander-V3-MEW004` ❌ | `Charmander-V5-MEW004` |
| Reverse Holo | Same wrong URL, no `?isReverseHolo=Y` ❌ | `Charmander-V1-MEW004?isReverseHolo=Y` |

Reverse Holo also shows no price (—).

---

## Root Cause

`pokemontcg.io` returns a **single** `cardmarket.url` per card (`-V3-` for Charmander/151).
This single URL is stored as `card_prices.cm_url` and used for **all variant external links**.

CardMarket uses version numbers (`-V1-`, `-V3-`, `-V5-`) to represent different card finish products:
- **V1** = standard non-holo
- **V5** = cosmos holo
- **V3** = different finish (wrong one that pokemontcg.io links to)

There is no per-variant URL override mechanism in the current schema.
Additionally, Cosmos Holo has no separate price column — it falls back to `cm_avg_sell` (same as Normal).

---

## Architecture

```
Admin enters per-variant URLs
        │
        ▼
card_cm_url_overrides table
  (card_id, variant_key, cm_url)
        │
        ▼
GET /api/prices/card/[cardId]
  → returns variant_cm_urls map + cm_cosmos_holo price
        │
        ▼
CardGrid.tsx — per-variant URL resolution:
  normal        → variant_cm_urls['normal'] ?? cm_url
  reverse       → (variant_cm_urls['normal'] ?? cm_url) + ?isReverseHolo=Y
  cosmos_holo   → variant_cm_urls['cosmos_holo']
  reverse_cosmos→ variant_cm_urls['cosmos_holo'] + ?isReverseHolo=Y
```

---

## Implementation Steps

### Step 1 — DB Migration A: `card_cm_url_overrides` table
**New file:** `database/migration_card_cm_url_overrides.sql`

```sql
CREATE TABLE card_cm_url_overrides (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id     uuid NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  variant_key text NOT NULL,
  cm_url      text NOT NULL,
  created_at  timestamptz DEFAULT now(),
  CONSTRAINT unique_card_variant_cmurl UNIQUE (card_id, variant_key)
);

CREATE INDEX idx_ccuo_card_id ON card_cm_url_overrides(card_id);

ALTER TABLE card_cm_url_overrides ENABLE ROW LEVEL SECURITY;

-- Public read (prices are public)
CREATE POLICY "ccuo_read_all"
  ON card_cm_url_overrides FOR SELECT
  USING (true);
-- Service-role writes bypass RLS
```

### Step 2 — DB Migration B: `cm_cosmos_holo` column
**New file:** `database/migration_add_cm_cosmos_holo.sql`

```sql
ALTER TABLE public.card_prices
  ADD COLUMN IF NOT EXISTS cm_cosmos_holo numeric(10,2);
```

### Step 3 — New API Route: `/api/card-cm-urls/route.ts`

```typescript
// GET /api/card-cm-urls?cardId=<uuid>
// → { urls: { [variantKey]: string } }

// POST /api/card-cm-urls  (admin-authenticated)
// body: { cardId, variantKey, cmUrl }
// → upserts one row in card_cm_url_overrides
```

### Step 4 — Update `app/api/prices/card/[cardId]/route.ts`

- Add a second query to `card_cm_url_overrides` for the card
- Add `cm_cosmos_holo` to the `card_prices` SELECT
- Return `variant_cm_urls: Record<string, string>` alongside the price data

```typescript
return NextResponse.json({
  price: { ...priceRow, cm_cosmos_holo },
  variant_cm_urls: { normal: '...', cosmos_holo: '...' },
})
```

### Step 5 — `services/pricing/types.ts`

Add to `CardPriceUpdate`:
```typescript
cm_cosmos_holo?: number | null
```

### Step 6 — `services/pricing/priceAggregator.ts`

Add to `writeCardPriceCache` payload builder:
```typescript
if (update.cm_cosmos_holo !== undefined) payload.cm_cosmos_holo = update.cm_cosmos_holo
```

### Step 7 — `lib/pricing.ts` `CardPriceRow` interface

```typescript
cm_cosmos_holo: number | null
```

### Step 8 — `CardGrid.tsx` `CardPriceRow` interface

```typescript
cm_cosmos_holo:  number | null
variant_cm_urls: Record<string, string> | null
```

Also update the data-fetching in CardGrid where `/api/prices/card/[cardId]` is called to extract `variant_cm_urls` from the response.

### Step 9 — `CardGrid.tsx` price display for Cosmos Holo (CardMarket)

```typescript
// Detect cosmos holo by key or name
const isCosmosHolo = variant.key === 'cosmos_holo' ||
  (vName.includes('cosmos') && vName.includes('holo'))

if (priceSource === 'cardmarket') {
  if (isReverse && isCosmosHolo) {
    // Reverse Holo Cosmos — no separate CM price exists; show —
    price = null
  } else if (isCosmosHolo) {
    const eur = priceRow.cm_cosmos_holo ?? null
    price = eur != null ? Math.round(eur * EUR_TO_USD * 100) / 100 : null
  } else if (isReverse) {
    const eur = priceRow.cm_reverse_holo ?? null
    price = eur != null ? Math.round(eur * EUR_TO_USD * 100) / 100 : null
  } else {
    const eur = priceRow.cm_avg_sell ?? priceRow.cm_trend ?? null
    price = eur != null ? Math.round(eur * EUR_TO_USD * 100) / 100 : null
  }
}
```

### Step 10 — `CardGrid.tsx` external link icon

Replace the single `cm_url` lookup with per-variant URL resolution:

```typescript
// Resolve the correct CardMarket URL for this specific variant
function resolveCmUrl(
  variant: Variant,
  priceRow: CardPriceRow,
): string | null {
  const vName = variant.name.toLowerCase()
  const vKey  = variant.key ?? ''
  const overrides = priceRow.variant_cm_urls ?? {}

  const isReverse    = vName.includes('reverse')
  const isCosmosHolo = vKey === 'cosmos_holo' || (vName.includes('cosmos') && vName.includes('holo'))

  // Base URL: override for normal/cosmos_holo, or fall back to API-provided cm_url
  const normalBase = overrides['normal'] ?? priceRow.cm_url
  const cosmosBase = overrides['cosmos_holo'] ?? null

  if (isCosmosHolo) {
    const base = cosmosBase
    if (!base) return null
    return isReverse ? `${base}?isReverseHolo=Y` : base
  }

  if (isReverse) {
    if (!normalBase) return null
    return `${normalBase}?isReverseHolo=Y`
  }

  return normalBase ?? null
}
```

### Step 11 — `components/admin/CardVariantEditor.tsx`

Add a **"CardMarket URLs"** section below the existing variant list:

- Lists each variant for the card (both global assigned variants and card-specific variants)
- Shows a text input per variant for `cm_url` override
- For `cosmos_holo` variant: also shows a `cm_cosmos_holo` price (EUR) input that writes to `card_prices`
- Save button POSTs to `/api/card-cm-urls`
- Loads existing overrides via GET on mount

### Post-Deploy Steps

**Step 12**: Run both migrations in Supabase SQL Editor.

**Step 13**: In Admin → Variants → find Charmander/151 → set:
- `normal` → `https://www.cardmarket.com/en/Pokemon/Products/Singles/151/Charmander-V1-MEW004`
- `cosmos_holo` → `https://www.cardmarket.com/en/Pokemon/Products/Singles/151/Charmander-V5-MEW004`
- Set `cm_cosmos_holo` price if the Cosmos Holo EUR price is known

**Step 14**: Re-sync Charmander/151 from Admin → Prices to verify `cm_reverse_holo` populates from pokemontcg.io `reverseHoloSell`.

---

## Files Changed

| File | Change |
|------|--------|
| `database/migration_card_cm_url_overrides.sql` | **New** — per-variant CardMarket URL overrides table |
| `database/migration_add_cm_cosmos_holo.sql` | **New** — `cm_cosmos_holo` column on `card_prices` |
| `app/api/card-cm-urls/route.ts` | **New** — GET/POST endpoint for URL overrides |
| `app/api/prices/card/[cardId]/route.ts` | Add `cm_cosmos_holo` to SELECT; fetch & return `variant_cm_urls` |
| `services/pricing/types.ts` | Add `cm_cosmos_holo` to `CardPriceUpdate` |
| `services/pricing/priceAggregator.ts` | Persist `cm_cosmos_holo` in `writeCardPriceCache` |
| `lib/pricing.ts` | Add `cm_cosmos_holo` to `CardPriceRow` |
| `components/CardGrid.tsx` | Per-variant URL resolution; Cosmos Holo price display |
| `components/admin/CardVariantEditor.tsx` | CM URL override editor section |
