# CardMarket Reverse Holo Price Fix

## Problem Summary

Both Normal and Reverse Holo variants show the same price. For Ethan's Pinsir (sv10-1):
- **Expected**: Normal = $0.05, Reverse Holo = $0.24 (per dextcg.com / CardMarket)
- **Actual**: Both show 0.42 kr (same value)

## Root Causes

### Bug 1 — CardMarket reverse holo data is never fetched or stored

`services/pricing/pokemonApiService.ts` has an incomplete `CardMarketPrices` interface.
It only reads `averageSellPrice` (normal card avg) and discards the reverse holo price entirely.

The pokemontcg.io API returns these additional fields that we ignore:
- `reverseHoloSell`     ← avg sell price for reverse holo (what dextcg shows)
- `reverseHoloLow`
- `reverseHoloTrend`
- `reverseHoloAvg1`, `reverseHoloAvg7`, `reverseHoloAvg30`
- `cardmarket.url`     ← link to the CardMarket product page

The `card_prices` table also has no `cm_reverse_holo` column, so even if we fetched the data,
there would be nowhere to store it.

### Bug 2 — Card tab shows one price for all variants

`components/CardGrid.tsx` (lines 1603-1618) displays the same price for every variant row
(Normal, Reverse Holo, Holo) because it uses `cardPricesUSD[selectedCard.id]` = `tcgp_market`
(which is holo ?? reverse ?? normal — one "best" price per card).

---

## Data Flow Diagram

```
pokemontcg.io API response
  cardmarket.url                        → NOT STORED
  cardmarket.prices.averageSellPrice    → price_point (variantKey='normal') ✓
  cardmarket.prices.reverseHoloSell     → NOT FETCHED ✗
        │
        ▼
  price_points table
    source='cardmarket', variant_key='normal'   → cm_avg_sell ✓
    source='cardmarket', variant_key='reverse'  → NEVER SAVED ✗
        │
        ▼
  card_prices table
    cm_avg_sell      → exists (normal only)
    cm_reverse_holo  → COLUMN MISSING ✗
    cm_url           → COLUMN MISSING ✗
        │
        ▼
  CardGrid Card tab
    All variants → same gridPrice from cardPricesUSD ✗
    Reverse Holo → shows same price as Normal ✗
```

---

## Fix Plan

### Step 1 — DB Migration
**New file:** `database/migration_add_cm_reverse_holo.sql`

```sql
ALTER TABLE public.card_prices
  ADD COLUMN IF NOT EXISTS cm_reverse_holo numeric(10,2),
  ADD COLUMN IF NOT EXISTS cm_url          text;
```

### Step 2 — `services/pricing/pokemonApiService.ts`
- Extend `CardMarketPrices` interface:
  ```typescript
  reverseHoloSell?:   number | null
  reverseHoloLow?:    number | null
  reverseHoloTrend?:  number | null
  reverseHoloAvg1?:   number | null
  reverseHoloAvg30?:  number | null
  ```
- Also capture `cardmarket.url` from the API response object
- After saving the normal CM price point, check `reverseHoloSell ?? reverseHoloTrend`
  and save a second price point with `variantKey: 'reverse'`
- Return `cm_url` in the `PokemonApiPriceResult` (extend that type or use a separate field)

### Step 3 — `services/pricing/types.ts`
Add to `CardPriceUpdate`:
```typescript
cm_reverse_holo?: number | null
cm_url?:          string | null
```

Also extend `PokemonApiPriceResult` to carry the CardMarket URL:
```typescript
cm_url?: string | null
```

### Step 4 — `services/pricing/priceAggregator.ts` — `aggregatePricesForCard`
Add after the existing CM normal aggregation block:
```typescript
// CardMarket reverse holo
const cmReverseRows = rows
  .filter(r => r.source === 'cardmarket' && !r.is_graded && r.variant_key === 'reverse')
  .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())

const cmReversePrices = cmReverseRows.map(r => r.price as number)
const cm_reverse_holo = average(cmReversePrices)
```
Include `cm_reverse_holo` in the returned `CardPriceUpdate`.

Note: `cm_url` comes from the API response, not from `price_points`.
The job runner needs to pass it through separately (see Step 4b in pricingJobRunner.ts) or
store it as a special aux row. The simplest approach: pass `cm_url` from `pokemonApiService`
back to the job runner, which upserts it directly on `card_prices.cm_url` alongside the aggregation.

### Step 5 — `services/pricing/priceAggregator.ts` — `writeCardPriceCache`
Add to payload builder:
```typescript
if (update.cm_reverse_holo !== undefined) payload.cm_reverse_holo = update.cm_reverse_holo
if (update.cm_url          !== undefined) payload.cm_url          = update.cm_url
```

### Step 6 — `app/api/prices/card/[cardId]/route.ts`
Add `cm_reverse_holo` and `cm_url` to the SELECT:
```
cm_reverse_holo,
cm_url,
```

### Step 7 — `lib/pricing.ts`
Add to `CardPriceRow` interface:
```typescript
cm_reverse_holo: number | null
cm_url:          string | null
```

### Step 8 — `components/CardGrid.tsx` — `CardPriceRow` interface
Add:
```typescript
cm_reverse_holo: number | null
cm_url:          string | null
```

### Step 9 — `components/CardGrid.tsx` — Card tab variant price (lines 1603-1618)

Replace the shared-price logic with per-variant lookup:

```typescript
const priceRow = cardPriceCache.get(selectedCard.id)
if (!priceRow) return isLoadingPrice ? '…' : '—'

const vName    = variant.name.toLowerCase()
const isReverse = vName.includes('reverse')
const isHolo    = vName.includes('holo') && !isReverse

let price: number | null = null
if (priceSource === 'cardmarket') {
  const eur = isReverse
    ? (priceRow.cm_reverse_holo ?? null)
    : (priceRow.cm_avg_sell ?? priceRow.cm_trend ?? null)
  price = eur != null ? Math.round(eur * EUR_TO_USD * 100) / 100 : null
} else {
  // TCGPlayer — use per-variant columns
  price = isReverse ? (priceRow.tcgp_reverse_holo ?? null)
        : isHolo    ? (priceRow.tcgp_holo         ?? null)
        :             (priceRow.tcgp_normal        ?? priceRow.tcgp_market ?? null)
}
return price != null ? formatPrice(price, effectiveCurrency) : '—'
```

Also remove the early-return `const gridPrice = cardPricesUSD?.[selectedCard.id]` that bypasses
variant-specific lookup — `cardPricesUSD` is the set-grid price (one per card), not per-variant.

### Step 10 — `components/CardGrid.tsx` — CardMarket link
Next to the price in the Card tab variant row, add a small external link icon when `cm_url` is available:
```tsx
{priceRow.cm_url && (
  <a
    href={priceRow.cm_url}
    target="_blank"
    rel="noopener noreferrer"
    className="text-muted hover:text-primary transition-colors"
    title="View on CardMarket"
  >
    <CardMarketIcon className="w-3.5 h-3.5" />
  </a>
)}
```

### Step 11 — Re-sync prices
After deployment, trigger a price sync from `/admin/prices` for:
- `sv10` (Destined Rivals) to verify the fix immediately
- Any other recently-synced sets to backfill `cm_reverse_holo`

---

## Files Changed

| File | Change |
|------|--------|
| `database/migration_add_cm_reverse_holo.sql` | New — adds 2 columns to card_prices |
| `services/pricing/pokemonApiService.ts` | Fetch reverseHoloSell + cm_url |
| `services/pricing/types.ts` | Add cm_reverse_holo, cm_url to CardPriceUpdate; cm_url to PokemonApiPriceResult |
| `services/pricing/priceAggregator.ts` | Aggregate reverse holo CM; persist cm_url |
| `app/api/prices/card/[cardId]/route.ts` | Add cm_reverse_holo, cm_url to SELECT |
| `lib/pricing.ts` | Add cm_reverse_holo, cm_url to CardPriceRow |
| `components/CardGrid.tsx` | Fix variant-specific price display; add CM link |
