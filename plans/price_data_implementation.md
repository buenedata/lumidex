# Price Data Implementation Plan

> Covers both **individual card prices** (TCGPlayer + CardMarket per variant) and
> **sealed product prices** (booster packs, ETBs, booster boxes, collections, tins)
> — both sourced from `pokemon-tcg-api.p.rapidapi.com` where available.


## Problem: Card Matching

The 3 key facts that solve this:

1. The RapidAPI (`pokemon-tcg-api.p.rapidapi.com`) uses card IDs in format `{set_id}-{number}` (e.g., `sv1-1`, `swsh1-145`)
2. Our `sets` table already stores `set_id` using the same identifiers (e.g., `sv1`, `swsh1`)
3. pkmn.gg's `__NEXT_DATA__` already exposes `card.dbId` (the pokemontcg.io ID — same format as above) which the import route reads but currently discards

### Matching Strategy

**Never match on card number alone** — `sv1` card #25 and `swsh1` card #25 are different cards.

**Primary match (new):** Add `api_id text` column to `cards` table. Store the pokemontcg.io card ID (`sv1-1`) there. At sync time, match `card_prices → cards` via `api_id`.

**Fallback match (for old cards):** Within a single-set sync, build an in-memory map of `normalize(number) → card UUID` from our DB, then match API cards by normalized number. Since we always query our DB filtered to `WHERE set_id = '{setId}'`, card numbers are unique in that context.

**Backfill path:** Update the import route to also save `dbId` as `api_id` on new card imports. Old cards get their `api_id` filled in on the next price sync.

---

## Architecture Overview

```
RapidAPI
  pokemon-tcg-api.p.rapidapi.com
        │
        │ GET /cards?q=set.id:{setId}&pageSize=250
        ▼
app/api/prices/sync/route.ts  (admin-only)
   1. Validate admin
   2. Fetch DB cards for set (id, set_id, number, api_id)
   3. Build number → UUID lookup map
   4. Fetch all pages from RapidAPI
   5. For each API card:
      a. Find DB UUID via api_id or normalized number
      b. Upsert card_prices row
      c. If api_id was missing, update cards.api_id
        │
        ▼
  Supabase: card_prices table
        │
        ▼
app/set/[id]/page.tsx  (server component)
   • Query card_prices for set's cards
   • Build cardPricesUSD map (same shape as today)
   • Fall back to getMockPriceUSD() where row missing
        │
        ▼
SetPageCards + CardGrid  (no changes needed)
   • Already consume cardPricesUSD prop
```

---

## Files to Create / Modify

### Step 1 — Database migration

**New file:** `database/migration_card_prices.sql`

```sql
-- ── Step 1: Add api_id to cards ───────────────────────────────────────────────
ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS api_id text;

-- Index for fast lookup during price sync
CREATE UNIQUE INDEX IF NOT EXISTS cards_api_id_idx
  ON public.cards (api_id)
  WHERE api_id IS NOT NULL;

-- ── Step 2: card_prices table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.card_prices (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id             uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,

  -- TCGPlayer prices (all USD)
  tcgp_normal         numeric(10, 2),   -- "normal" market price
  tcgp_reverse_holo   numeric(10, 2),   -- "reverseHolofoil" market price
  tcgp_holo           numeric(10, 2),   -- "holofoil" market price
  tcgp_1st_edition    numeric(10, 2),   -- "1stEditionHolofoil" / "1stEditionNormal"
  tcgp_market         numeric(10, 2),   -- best market price (computed at sync: first non-null of holo→reverse→normal)

  -- CardMarket prices (all EUR)
  cm_avg_sell         numeric(10, 2),   -- averageSellPrice
  cm_low              numeric(10, 2),   -- lowPrice
  cm_trend            numeric(10, 2),   -- trendPrice
  cm_avg_30d          numeric(10, 2),   -- avg30

  -- Metadata
  api_card_id         text,             -- raw API ID e.g. "sv1-1" (for debugging/audit)
  tcgp_updated_at     text,             -- ISO date from API response (TCGPlayer)
  cm_updated_at       text,             -- ISO date from API response (CardMarket)
  fetched_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT card_prices_card_id_key UNIQUE (card_id)
);

-- RLS
ALTER TABLE public.card_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "card_prices_public_read"
  ON public.card_prices FOR SELECT USING (true);

CREATE POLICY "card_prices_admin_write"
  ON public.card_prices FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Indexes
CREATE INDEX IF NOT EXISTS card_prices_card_id_idx
  ON public.card_prices (card_id);

CREATE INDEX IF NOT EXISTS card_prices_fetched_at_idx
  ON public.card_prices (fetched_at DESC);

-- updated_at trigger
CREATE TRIGGER handle_updated_at_card_prices
  BEFORE UPDATE ON public.card_prices
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

---

### Step 2 — `lib/pricing.ts` (new file)

Replaces `lib/mockPricing.ts` as the canonical pricing module for consumers.

**Exports:**
```typescript
// Reads real prices from DB for a whole set at once (server-side)
export async function getCardPricesForSet(
  setId: string,
  priceSource: PriceSource,          // 'tcgplayer' | 'cardmarket'
): Promise<Record<string, number>>   // card_id → price in source base currency (USD or EUR)

// Converts a base-currency amount to user's preferred currency + formats it
export function formatPrice(
  amount: number,
  fromCurrency: 'USD' | 'EUR',
  toCurrency: string,
): string

// Exchange rates map (real static rates — can be refreshed weekly)
export const EXCHANGE_RATES: Record<string, number>  // relative to USD

// CardMarket is EUR-based; conversion to USD needed for consistent math
export const EUR_TO_USD = 1.09  // update periodically
```

**Logic inside `getCardPricesForSet`:**
- Query `card_prices JOIN cards ON card_id = cards.id WHERE cards.set_id = '{setId}'`
- If `priceSource === 'tcgplayer'`: return `tcgp_market` (USD)
- If `priceSource === 'cardmarket'`: return `cm_avg_sell` converted to USD via `EUR_TO_USD`
- For cards with no price row: return `null` (caller falls back to `getMockPriceUSD()`)

**Keep `lib/mockPricing.ts`** intact — used as fallback. Move `formatPrice` to `lib/pricing.ts` (import it from there in both the set page and any other consumer).

---

### Step 3 — `app/api/prices/sync/route.ts` (new file)

Admin-only POST endpoint.

**Request body:**
```typescript
{
  setId: string           // e.g. "sv1"
  setApiId?: string       // optional override if DB set_id ≠ RapidAPI set.id
}
```

**Response (streaming SSE, same pattern as import-card-data):**
```
data: { type: "progress", processed: 12, total: 165, matched: 12, unmatched: 0 }
data: { type: "done", matched: 165, unmatched: 0, elapsed: 4200 }
data: { type: "error", message: "..." }
```

**Algorithm:**
```
1. requireAdmin()
2. Fetch DB cards for set_id:
   SELECT id, number, api_id FROM cards WHERE set_id = '{setId}'
3. Build lookup maps:
   - apiIdMap: Map<api_id, uuid>
   - numberMap: Map<normalize(number), uuid>  ← fallback within this set only
4. Paginate RapidAPI:
   GET https://pokemon-tcg-api.p.rapidapi.com/cards
     ?q=set.id:{setId}&pageSize=250&page=1
     Headers: x-rapidapi-key, x-rapidapi-host
   Repeat until page * pageSize >= totalCount
5. For each API card:
   a. Find UUID: apiIdMap.get(card.id) ?? numberMap.get(normalize(card.number))
   b. If no match: log unmatched, skip
   c. Extract prices from card.tcgplayer.prices and card.cardmarket.prices
   d. UPSERT into card_prices (ON CONFLICT card_id DO UPDATE)
   e. If api_id was missing on our card: UPDATE cards SET api_id = card.id
6. Stream progress events
7. Return summary
```

**RapidAPI response shape:**
```typescript
interface RapidApiResponse {
  data: RapidApiCard[]
  page: number
  pageSize: number
  count: number
  totalCount: number
}

interface RapidApiCard {
  id: string          // "sv1-1"
  number: string      // "1"
  tcgplayer?: {
    updatedAt: string
    prices?: {
      normal?:             { low?:number; mid?:number; high?:number; market?:number }
      reverseHolofoil?:    { market?:number }
      holofoil?:           { market?:number }
      '1stEditionHolofoil'?: { market?:number }
      '1stEditionNormal'?:   { market?:number }
    }
  }
  cardmarket?: {
    updatedAt: string
    prices?: {
      averageSellPrice?: number
      lowPrice?:         number
      trendPrice?:       number
      avg30?:            number
    }
  }
}
```

**Best market price logic (tcgp_market):**
```typescript
const tcgpPrices = card.tcgplayer?.prices ?? {}
const tcgp_market =
  tcgpPrices.holofoil?.market ??
  tcgpPrices.reverseHolofoil?.market ??
  tcgpPrices.normal?.market ??
  null
```

---

### Step 4 — Update `app/set/[id]/page.tsx`

**Current (lines 56–65):**
```typescript
// ── Mock pricing (deterministic, rarity-based) ────────────────────────
cards.forEach(c => { cardPricesUSD[c.id] = getMockPriceUSD(c) })
setTotalValue = Object.values(cardPricesUSD).reduce((s, p) => s + p, 0)
mostExpensive = cards.reduce<PokemonCard | null>(...)
```

**Replace with:**
```typescript
// Fetch user's price source preference (tcgplayer / cardmarket)
const priceSource: PriceSource = profileRow?.price_source ?? 'tcgplayer'

// ── Real prices from DB, mock fallback ────────────────────────────────
const realPrices = await getCardPricesForSet(id, priceSource)
cards.forEach(c => {
  cardPricesUSD[c.id] = realPrices[c.id] ?? getMockPriceUSD(c)
})
const pricesAreReal = Object.keys(realPrices).length > 0
// pass pricesAreReal to SetPageCards for "Prices from TCGPlayer" badge
```

**Also move** the `profileRow` select to fetch `price_source` alongside `preferred_currency` (they're already in the same query).

---

### Step 5 — `app/admin/prices/page.tsx` (new file)

Admin UI for triggering price syncs.

**Layout:**
- Page title: "Price Data Sync"
- Table of all sets with columns: Set Name | Set ID | Cards | Last Synced | Coverage | Actions
- "Sync" button per row → calls `POST /api/prices/sync` with SSE progress
- Progress bar during sync (same UX as the card data import page)
- Coverage = count of card_prices rows / total cards in set (as %)
- "Sync All Sets" bulk button at top

**Data needed on page load:**
```sql
SELECT 
  s.set_id, s.name, s."setComplete",
  COUNT(c.id) as card_count,
  COUNT(cp.id) as priced_count,
  MAX(cp.fetched_at) as last_synced
FROM sets s
LEFT JOIN cards c ON c.set_id = s.set_id
LEFT JOIN card_prices cp ON cp.card_id = c.id
GROUP BY s.set_id, s.name, s."setComplete"
ORDER BY s.release_date DESC
```

This query can be a new API route `GET /api/prices/status` or done server-side in the page component.

---

### Step 6 — Add entry to `app/admin/page.tsx`

Add to the `ADMIN_TOOLS` array:
```typescript
{
  href: '/admin/prices',
  icon: '💰',
  title: 'Price Data Sync',
  description:
    'Sync TCGPlayer and CardMarket price data from the Pokémon TCG API via RapidAPI. ' +
    'Prices are cached in the database and served to all set pages.',
  badge: 'Prices',
},
```

---

### Step 7 — Also: Update `app/api/import-card-data/route.ts`

When saving a card to the DB during import, also save `dbId` as `api_id`:
```typescript
// In the upsert payload
api_id: card.dbId ?? null,
```

This ensures cards imported going forward automatically get their `api_id` filled in.

---

### Step 8 — Environment variables

**`.env.local`** (add):
```
RAPIDAPI_KEY=your_key_here
```

**`.env.example`** / `README.md` (document):
```
RAPIDAPI_KEY=            # RapidAPI key for pokemon-tcg-api.p.rapidapi.com
```

The sync route reads: `process.env.RAPIDAPI_KEY`

---

## Data Flow Diagram

```
Admin page /admin/prices
    │ POST /api/prices/sync { setId }
    ▼
prices/sync route
    ├── SELECT cards WHERE set_id = X  →  number→UUID map
    ├── GET rapidapi.com/cards?q=set.id:X  (paginated)
    │       ├── match by api_id  (exact)
    │       └── match by normalize(number)  (fallback, safe within one set)
    ├── UPSERT card_prices (tcgp_*, cm_*)
    └── UPDATE cards SET api_id (backfill)

Set page /set/[id]
    ├── SELECT card_prices WHERE card_id IN (cards for set)
    ├── Real price found  →  use it
    └── No price row     →  getMockPriceUSD() fallback

User sees
    ├── price_source = 'tcgplayer'  →  tcgp_market (USD) → converted to preferred_currency
    └── price_source = 'cardmarket' →  cm_avg_sell (EUR) → converted to preferred_currency
```

---

## Sealed Product Pricing

> The `pokemon-tcg-api.p.rapidapi.com` API is based on pokemontcg.io v2.
> The official spec does not expose a `/products` endpoint, but the RapidAPI
> wrapper may add one. The implementation is **conditional** — product sync
> runs after card sync, skips silently if the endpoint returns 404 or empty.

### What "products" covers

| Product Type | Example |
|---|---|
| Booster Pack | SV151 Booster Pack |
| Booster Box | SV151 Booster Box (36 packs) |
| Elite Trainer Box (ETB) | SV151 ETB |
| Collection Box | Charizard ex Premium Collection |
| Tin | Miraidon ex Pokémon Card Tin |

### API endpoint (conditional)

```
GET https://pokemon-tcg-api.p.rapidapi.com/products?q=set.id:{setId}&pageSize=100
```

Expected response shape (if available):
```typescript
interface RapidApiProduct {
  id:       string          // e.g. "sv1-booster-box"
  name:     string          // "Scarlet & Violet Booster Box"
  set:      { id: string }
  category: string          // "Booster Pack" | "Booster Box" | "Elite Trainer Box" | ...
  tcgplayer?: {
    url: string
    prices?: { normal?: { market?: number; low?: number; high?: number } }
  }
  cardmarket?: {
    url: string
    prices?: { averageSellPrice?: number; trendPrice?: number }
  }
}
```

### New DB table: `set_products`

Add to `database/migration_card_prices.sql`:

```sql
CREATE TABLE IF NOT EXISTS public.set_products (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id          text NOT NULL,
  api_product_id  text,
  name            text NOT NULL,
  product_type    text,         -- 'Booster Pack' | 'Booster Box' | 'ETB' | 'Collection' | 'Tin' | 'Other'

  tcgp_market     numeric(10, 2),
  tcgp_low        numeric(10, 2),
  tcgp_high       numeric(10, 2),
  tcgp_url        text,

  cm_avg_sell     numeric(10, 2),
  cm_trend        numeric(10, 2),
  cm_url          text,

  fetched_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT set_products_api_product_id_key UNIQUE (api_product_id)
);

ALTER TABLE public.set_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "set_products_public_read" ON public.set_products FOR SELECT USING (true);
CREATE POLICY "set_products_admin_write" ON public.set_products FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS set_products_set_id_idx ON public.set_products (set_id);

CREATE TRIGGER handle_updated_at_set_products
  BEFORE UPDATE ON public.set_products
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

### Changes to sync route

After completing card price sync, in `app/api/prices/sync/route.ts`:

```typescript
// ── Products (conditional) ────────────────────────────────────────────────
try {
  const productsRes = await fetchFromRapidApi(`/products?q=set.id:${setId}&pageSize=100`)
  if (productsRes.data?.length > 0) {
    const rows = productsRes.data.map((p: RapidApiProduct) => ({
      set_id:         setId,
      api_product_id: p.id,
      name:           p.name,
      product_type:   normalizeProductType(p.category),
      tcgp_market:    p.tcgplayer?.prices?.normal?.market ?? null,
      tcgp_low:       p.tcgplayer?.prices?.normal?.low    ?? null,
      tcgp_high:      p.tcgplayer?.prices?.normal?.high   ?? null,
      tcgp_url:       p.tcgplayer?.url ?? null,
      cm_avg_sell:    p.cardmarket?.prices?.averageSellPrice ?? null,
      cm_trend:       p.cardmarket?.prices?.trendPrice       ?? null,
      cm_url:         p.cardmarket?.url ?? null,
    }))
    await supabaseAdmin.from('set_products')
      .upsert(rows, { onConflict: 'api_product_id' })
    yield sseData({ type: 'products', count: rows.length })
  }
} catch { /* products endpoint unavailable — skip silently */ }

function normalizeProductType(category: string): string {
  const c = (category ?? '').toLowerCase()
  if (c.includes('booster box'))                 return 'Booster Box'
  if (c.includes('booster pack') || c === 'pack') return 'Booster Pack'
  if (c.includes('elite trainer'))               return 'ETB'
  if (c.includes('collection'))                  return 'Collection'
  if (c.includes('tin'))                         return 'Tin'
  return 'Other'
}
```

### Display: Sealed Products section on set detail page

Fetch server-side in `app/set/[id]/page.tsx`:

```typescript
const { data: sealedProducts } = await supabaseAdmin
  .from('set_products')
  .select('name, product_type, tcgp_market, tcgp_url, cm_avg_sell, cm_url')
  .eq('set_id', id)
  .order('product_type')
```

Render a collapsible card below the stat strip:

```
┌─────────────────────────────────────────────────────────────┐
│  📦  Sealed Products                                        │
├──────────────────────┬─────────────┬───────────────────────┤
│  Booster Pack        │  $4.99      │  ↗ TCGPlayer          │
│  Booster Box (36)    │  $134.99    │  ↗ TCGPlayer          │
│  Elite Trainer Box   │  $49.99     │  ↗ TCGPlayer          │
└──────────────────────┴─────────────┴───────────────────────┘
```

Price shown respects `price_source` + `preferred_currency` (same `formatPrice()` as cards).

---

## Graded Card Pricing

Professional grading services (PSA, BGS/Beckett, CGC) assign condition grades
(10 = gem mint → 1 = poor) to cards and sell them at large premiums over raw cards.
PSA 10 of a Charizard can be 50–500× the raw card price.

### Where graded prices come from

TCGPlayer lists graded cards as **separate product SKUs** on the same card
listing page. The RapidAPI may surface these under the card's `tcgplayer.prices`
object as additional keys:

```typescript
// Extended tcgplayer price keys that include grades:
interface TcgPlayerPrices {
  normal?:            { market?: number }
  reverseHolofoil?:   { market?: number }
  holofoil?:          { market?: number }
  // Graded variants (may not always be present):
  '1stEditionHolofoil'?: { market?: number }
  gradedPsa10?:       { market?: number }   // PSA 10
  gradedPsa9?:        { market?: number }   // PSA 9
  gradedBgs9_5?:      { market?: number }   // BGS 9.5
  gradedBgs9?:        { market?: number }   // BGS 9
  gradedCgc10?:       { market?: number }   // CGC 10
}
```

> **Note:** The exact key names depend on what the RapidAPI returns. The sync
> route should log all observed price keys for a sample card so we can confirm
> the exact field names before implementing the parsing.

### DB additions: graded price columns on `card_prices`

Instead of a separate table, add columns to `card_prices` (fewer JOINs):

```sql
-- Add to the card_prices table definition in migration_card_prices.sql:
tcgp_psa10          numeric(10, 2),   -- PSA 10 market price (USD)
tcgp_psa9           numeric(10, 2),   -- PSA 9 market price (USD)
tcgp_bgs95          numeric(10, 2),   -- BGS 9.5 market price (USD)
tcgp_bgs9           numeric(10, 2),   -- BGS 9 market price  (USD)
tcgp_cgc10          numeric(10, 2),   -- CGC 10 market price (USD)
```

### Extraction in sync route

```typescript
// Inside the per-card upsert block, alongside existing tcgp_* fields:
const grades = card.tcgplayer?.prices ?? {}

tcgp_psa10:  grades.gradedPsa10?.market  ?? null,
tcgp_psa9:   grades.gradedPsa9?.market   ?? null,
tcgp_bgs95:  grades.gradedBgs9_5?.market ?? null,
tcgp_bgs9:   grades.gradedBgs9?.market   ?? null,
tcgp_cgc10:  grades.gradedCgc10?.market  ?? null,
```

### Graded price multiplier fallback

If the API doesn't return graded prices for a card, we can **estimate** them
using well-known industry multipliers (shown as approximate, not "real" prices):

| Grade | Multiplier vs raw market |
|---|---|
| PSA 10 | 3–8× (varies enormously by card) |
| PSA 9  | 1.5–3× |
| BGS 9.5 | 4–10× |
| BGS 9  | 1.5–2.5× |
| CGC 10 | 2–5× |

**Only use multipliers as a last resort** for display — always show a
"~estimated" label when the price is derived, never a real-looking hard figure.

### Display: Graded Prices tab/section in card detail

Graded prices are most relevant in the **card detail modal/drawer**, not on the
set grid. When a user clicks a card and sees its detail panel, add a
"Graded Prices" table:

```
┌────────────────────────────────────────────────────┐
│  🏅  Graded Prices                                 │
├───────────┬──────────┬──────────────────────────── │
│  PSA 10   │  $485    │  ████████████████████ 100%  │
│  PSA 9    │  $210    │  ████████████         55%   │
│  BGS 9.5  │  $620    │  ██████████████████████     │
│  BGS 9    │  $180    │  ██████████           46%   │
│  CGC 10   │  $390    │  ████████████████     80%   │
│  Raw      │  $62     │  ████                 13%   │
└───────────┴──────────┴────────────────────────────-┘
```

The bar chart shows relative value (% of highest grade price).

### DB type additions

Add to `types/index.ts`:

```typescript
export interface CardGradedPrices {
  psa10?:  number | null
  psa9?:   number | null
  bgs95?:  number | null
  bgs9?:   number | null
  cgc10?:  number | null
}
```

---

## Key Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| Card matching | `api_id` column on cards + normalized number fallback (within-set only) | Number alone is NOT unique across sets |
| Price caching | `card_prices` DB table (1 row per card) | No per-request RapidAPI calls; rate-limit safe |
| Sync trigger | Admin UI only | Prices don't change hourly; avoid automated rate exhaustion |
| Base currencies | TCGPlayer = USD, CardMarket = EUR | Fixed by sources |
| Card price fallback | `getMockPriceUSD()` where row missing | Set pages always show a price |
| Graded prices | Extra columns on `card_prices` (not a separate table) | Simpler JOINs; graded data belongs to same card row |
| Graded price fallback | Multiplier estimate labeled "~approx" | Better than nothing; clearly flagged as non-real |
| Sealed products | `set_products` table; conditional sync | Products belong to a set, not a card |
| Products sync | Try endpoint, skip silently on 404/empty | API may not support it; graceful degradation |
| `formatPrice` location | Moved to `lib/pricing.ts` | Single source of truth |
| SSE streaming | Yes, same as import-card-data | 250+ cards per set; UX must stay responsive |
