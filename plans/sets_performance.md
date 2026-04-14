# Sets & Set-Detail Page Performance Plan

## Problem

Clicking "Sets" in the navbar takes ~15 seconds before the page content appears.
Clicking through to a set detail page is similarly slow, especially on first visit
or after a period of inactivity.

The `loading.tsx` skeleton shows instantly (good), but the SSR itself blocks
for 10–15 seconds before Next.js can send the rendered HTML.

---

## Root Cause Analysis

### Why 15 seconds?

When a Vercel serverless function cold-starts it opens fresh connections to
Supabase. When 6–8 concurrent uncached queries hit Supabase simultaneously
from one cold invocation, connection pool setup + query execution compounds.
`unstable_cache` on Vercel is backed by **Vercel's distributed Data Cache**
(not just in-process memory), so cache hits persist across serverless
invocations and function restarts — this is why caching is the highest-impact fix.

---

## `/sets` Page — Three Uncached Functions

### Problem 1 — `getSets()` is never cached

**File:** `lib/db.ts` lines 100–112

```ts
export async function getSets(): Promise<DbSet[]> {
  const { data, error } = await supabase
    .from('sets')
    .select('…')
    .order('release_date', { ascending: false })
  …
}
```

`getSets()` uses the **anon** client (not `supabaseAdmin`), hits Supabase on
**every single request**, and returns a potentially large payload (300+ set rows).
There is no `unstable_cache` wrapper.

Compare to `getSetById` and `getCardsBySet` — both correctly use
`unstable_cache` with a 60-second TTL. `getSets()` was missed.

### Problem 2 — `getSeriesWithProducts()` is never cached AND runs 2 sequential round-trips

**File:** `lib/pricing.ts` lines 261–291

```ts
export async function getSeriesWithProducts(): Promise<Set<string>> {
  // Round-trip 1: fetch all set_ids from set_products
  const { data: productRows } = await supabaseAdmin
    .from('set_products').select('set_id')

  const setIds = [...new Set(productRows.map(r => r.set_id))]

  // Round-trip 2: resolve series for those set_ids — BLOCKED until RT1 finishes
  const { data: setRows } = await supabaseAdmin
    .from('sets').select('set_id, series').in('set_id', setIds)
  …
}
```

Two problems:
1. **Sequential** — round-trip 2 cannot start until round-trip 1 returns.
   At 200–500 ms per Supabase call, this is 400–1000 ms of pure waiting.
2. **Never cached** — runs on every `/sets` page load.

### Problem 3 — `get_user_card_counts_by_set` RPC runs uncached on every visit

This GROUP BY aggregation scans `user_card_variants` for the user. For a
collector with 1000+ cards across 50+ sets this is a slow Postgres query
executed on every page load with no server-side caching.

---

## `/set/[id]` Page — Two Uncached Phase-2 Functions

### Problem 4 — `getCardPricesForSet()` is never cached

**File:** `lib/pricing.ts` lines 150–233

```ts
export async function getCardPricesForSet(
  setId: string,
  priceSource: PriceSource,
  preloadedCardIds?: string[],
): Promise<Record<string, CardPriceData>> {
  const { data } = await supabaseAdmin
    .from('card_prices')
    .select('…17 columns…')
    .in('card_id', cardIds)   // up to 250 UUIDs in the IN clause
  …
}
```

This query is called in **Phase 2** of the set detail page — it already enjoys
the optimisation of receiving `preloadedCardIds` so the extra lookup is skipped.
But the main price fetch itself is completely uncached. Prices are written by a
cron job, not by user actions, so a 5-minute stale window is perfectly acceptable.

### Problem 5 — `batchFetchVariantStructure()` is never cached

**File:** `lib/variantServer.ts` lines 28–130

Runs **3 parallel Supabase queries** on every set-page load:
1. Global official variants
2. Per-card availability overrides for all card IDs
3. Card-specific variants for all card IDs

Variant structure changes only when an admin edits variants (infrequent). Safe
to cache for 5–10 minutes.

### Problem 6 — Phase 1 → Phase 2 sequential waterfall

```
Phase 1: getSetById + getCardsBySet + getAuthAndPrefs  →  ~2–4s (cache miss)
                                                             ↓ (Phase 2 waits)
Phase 2: getCardPricesForSet + batchFetchVariantStructure → ~2–4s (no cache)
                                                             ↓
Total cold-path:                                          4–8s minimum
```

With Supabase cold starts on both phases, 10–15 seconds is fully explained.

---

## Implementation Plan

### Fix 1 — Cache `getSets()` in `lib/db.ts`

Wrap with `unstable_cache` (same pattern as `getSetById`):

```ts
import { unstable_cache } from 'next/cache'

export const getSets = unstable_cache(
  async (): Promise<DbSet[]> => {
    const { data, error } = await supabase
      .from('sets')
      .select('id:set_id, name, series, total:setTotal, setComplete, release_date, logo_url, symbol_url, created_at, language')
      .order('release_date', { ascending: false })

    if (error) {
      console.error('Error fetching sets:', error)
      throw new Error(`Failed to fetch sets: ${error.message}`)
    }

    return data || []
  },
  ['db:getSets'],
  { revalidate: 300, tags: ['sets'] },   // 5-minute TTL; revalidated on admin set import
)
```

> **Note:** The `/api/sets` route already sets `Cache-Control: s-maxage=300` —
> the `unstable_cache` TTL matches this so behaviour is consistent.

---

### Fix 2 — Cache `getSeriesWithProducts()` AND fix the sequential queries

**File:** `lib/pricing.ts`

Two sub-fixes:

**2a. Convert to a single JOIN query** (eliminates the sequential round-trip):

```ts
// Single query using PostgREST nested select (inner join)
const { data, error } = await supabaseAdmin
  .from('set_products')
  .select('sets!inner(series)')
  // No .in() needed — the join filters automatically
```

This collapses 2 sequential DB calls into 1 and removes the N+1 pattern of
"fetch IDs then fetch by IDs".

**2b. Wrap in `unstable_cache`**:

```ts
export const getSeriesWithProducts = unstable_cache(
  async (): Promise<Set<string>> => {
    const { data, error } = await supabaseAdmin
      .from('set_products')
      .select('sets!inner(series)')

    if (error) {
      console.error('[pricing] getSeriesWithProducts error:', error)
      return new Set()
    }

    const seriesSet = new Set<string>()
    for (const row of (data ?? [])) {
      const series = (row as any).sets?.series
      if (series) seriesSet.add(series as string)
    }
    return seriesSet
  },
  ['pricing:getSeriesWithProducts'],
  { revalidate: 600, tags: ['sets', 'products'] },  // 10-minute TTL
)
```

---

### Fix 3 — Cache `getCardPricesForSet()` in `lib/pricing.ts`

The cache key must include `setId` AND `priceSource` since the same set returns
different prices for TCGPlayer vs CardMarket:

```ts
export function getCardPricesForSet(
  setId: string,
  priceSource: PriceSource = 'tcgplayer',
  preloadedCardIds?: string[],
): Promise<Record<string, CardPriceData>> {
  return unstable_cache(
    () => _getCardPricesForSet(setId, priceSource, preloadedCardIds),
    [`pricing:cardPrices:${setId}:${priceSource}`],
    { revalidate: 300, tags: ['prices', `set-prices:${setId}`] },
  )()
}
```

> Because `preloadedCardIds` changes per-call, the actual DB query logic moves
> into a private `_getCardPricesForSet` inner function. The cache key is stable
> on `setId + priceSource` — the card IDs are an implementation detail of the
> query, not part of the semantic cache key.

---

### Fix 4 — Cache `batchFetchVariantStructure()` in `lib/variantServer.ts`

Variant structure rarely changes (admin-only operations). Cache key is the
sorted card IDs (to handle identical sets in different call orders):

```ts
export function batchFetchVariantStructure(
  cardIds: string[],
): Promise<Record<string, QuickAddVariant[]>> {
  if (cardIds.length === 0) return Promise.resolve({})

  const cacheKey = `variants:batch:${[...cardIds].sort().join(',')}`
  return unstable_cache(
    () => _batchFetchVariantStructure(cardIds),
    [cacheKey],
    { revalidate: 600, tags: ['variants'] },  // 10-minute TTL
  )()
}
```

> The inner `_batchFetchVariantStructure` contains the existing 3-query logic.
> When an admin edits variants, an `revalidateTag('variants')` call in the
> admin route handler invalidates all cached variant structures.

---

## Expected Impact After All 4 Fixes

| Scenario | Before | After |
|---|---|---|
| `/sets` page — cold serverless invocation | 10–15 s | 1–2 s |
| `/sets` page — warm (cache hit) | 3–5 s | < 300 ms |
| `/set/[id]` — first visit to a set | 8–15 s | 2–4 s |
| `/set/[id]` — repeat visit (within TTL) | 3–5 s | < 500 ms |

The improvement on cold starts is smaller because Supabase itself still needs
to handle the queries; caching eliminates the Supabase round-trips entirely
on warm hits.

---

## Files to Change

| File | Change |
|---|---|
| `lib/db.ts` | Wrap `getSets()` in `unstable_cache` |
| `lib/pricing.ts` | Wrap `getSeriesWithProducts()` in `unstable_cache` + fix sequential queries |
| `lib/pricing.ts` | Wrap `getCardPricesForSet()` in `unstable_cache` |
| `lib/variantServer.ts` | Wrap `batchFetchVariantStructure()` in `unstable_cache` |

No page files need to change. No database migrations required.

---

## Cache Invalidation Strategy

| Tag | When to revalidate |
|---|---|
| `sets` | Admin imports a new set |
| `products` | Admin adds/removes sealed products |
| `prices` | Price cron job completes a sync cycle |
| `set-prices:{setId}` | Price cron updates prices for a specific set |
| `variants` | Admin edits variant definitions or card-specific overrides |

These `revalidateTag()` calls should be added to the relevant admin API route
handlers so the cache is proactively cleared when data changes, rather than
waiting for the TTL to expire.
