# Pricing: Stable Scheduling & API Cleanup

**Status:** Ready for implementation  
**Date:** 2026-04-05

---

## Decision Summary

- **Nightly cron:** 3x per night — 01:00, 02:00, 03:00 UTC (03:00–05:00 Oslo)
- **Nighttime window guard:** 21:00–05:00 UTC (23:00–07:00 Oslo)
- **Graded pricing:** Included automatically in every cron run (`includeGraded: true`)
- **Update frequency:**
  - Current series + previous series → **24-hour** interval
  - All older series → **48-hour** interval

---

## API Audit Results

| API | Keep? | Reason |
|-----|-------|--------|
| `api.pokemontcg.io/v2` | ✅ KEEP | Primary source for TCGPlayer + CardMarket card prices (single call per card) |
| eBay Browse OAuth (`api.ebay.com`) | ✅ KEEP | Raw ungraded + graded last-sold prices (user required) |
| RapidAPI `cardmarket-api-tcg.p.rapidapi.com` | ✅ KEEP | Only source for sealed product pricing by episode |
| RapidAPI `pokemon-tcg-api.p.rapidapi.com` | ❌ REMOVE | Admin debug probe only — not in production pipeline |

---

## File Changes

### NEW FILES

#### `database/migration_set_prices_last_synced.sql`
```sql
ALTER TABLE sets
  ADD COLUMN IF NOT EXISTS prices_last_synced_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_sets_prices_last_synced_at
  ON sets (prices_last_synced_at);
```

#### `services/pricing/setTierService.ts`
- Query all sets: `set_id, series, release_date, prices_last_synced_at`
- Group by `series` → find max `release_date` per series → sort descending
- Top series = `current`, 2nd series = `previous` → both get `recent` tier (24h)
- All other series → `older` tier (48h)
- Filter to sets where `prices_last_synced_at IS NULL` OR older than threshold
- Return array sorted: `recent` nulls first → `recent` oldest first → `older` nulls first → `older` oldest first

#### `vercel.json`
```json
{
  "crons": [
    { "path": "/api/cron/update-prices", "schedule": "0 1 * * *" },
    { "path": "/api/cron/update-prices", "schedule": "0 2 * * *" },
    { "path": "/api/cron/update-prices", "schedule": "0 3 * * *" }
  ]
}
```

---

### MODIFIED FILES

#### `services/pricing/pricingOrchestrator.ts`
- `UpdatePricesBatchOptions`: change `setId?: string` → `setIds?: string[]`
- Add `timeBudgetMs?: number` option (default 270_000 = 270s)
- Processing loop: iterate over `setIds`, after each set check elapsed time; if > budget, break early
- After all cards in a set complete successfully, run:
  ```ts
  await supabase.from('sets')
    .update({ prices_last_synced_at: new Date().toISOString() })
    .eq('set_id', currentSetId)
  ```
- `BatchResult` gains `setsProcessed: number` and `setsSkippedDueToTimeout: number`

#### `app/api/cron/update-prices/route.ts`
- Remove the existing simple wrapper
- New logic:
  1. Verify `Authorization: Bearer <CRON_SECRET>`
  2. Nighttime guard: check UTC hour; if outside `[21..23, 0..4]` and `?force=true` not present → return `{ ok: true, skipped: 'outside nighttime window' }`
  3. Call `getSetsForPricing()` from `setTierService`
  4. If no sets due → return `{ ok: true, message: 'No sets due for update' }`
  5. Call `updatePricesBatch({ setIds, includeGraded: true, timeBudgetMs: 270_000 })`
  6. Return full summary JSON

#### `app/api/prices/discover/route.ts`
- Remove `const CARDS_HOST` and `const CARDS_BASE` (lines ~8–9)
- Remove the entire `probe === 'cards'` branch (lines ~66–90)
- Keep all episode-related code intact

---

### DELETED FILES

| File | Reason |
|------|--------|
| `app/api/prices/cron/raw/route.ts` | Replaced by unified smart cron |
| `app/api/prices/cron/graded/route.ts` | Graded now included in unified cron |

---

## Files NOT Touched (eBay last-sold preserved)

- `services/pricing/ebayService.ts`
- `services/pricing/ebayGradedService.ts`
- `services/pricing/gradedPriceRepository.ts`
- `lib/ebayAuth.ts`
- `app/api/ebay/webhook/route.ts`
- All UI components displaying eBay prices

---

## Tier Classification Flow

```
sets table (all rows)
  → group by series
  → max(release_date) per series
  → sort desc

series[0] = CURRENT  \
series[1] = PREVIOUS  } → tier: "recent" → 24h update interval
series[2..N] = OLDER  → tier: "older" → 48h update interval

For each set:
  - if prices_last_synced_at IS NULL → due immediately
  - if "recent" and prices_last_synced_at < now - 24h → due
  - if "older" and prices_last_synced_at < now - 48h → due

Sort: recent nulls first → recent oldest first → older nulls first → older oldest first
```

---

## Cron Schedule

| Time (UTC) | Time (Oslo / UTC+2) | Window |
|------------|---------------------|--------|
| 01:00 | 03:00 | Run 1 — processes most overdue sets |
| 02:00 | 04:00 | Run 2 — processes next batch |
| 03:00 | 05:00 | Run 3 — processes remaining |

Each run has a 270s time budget. With ~100s per typical set (200 cards × 500ms), each run can fully process 2–3 sets. Three nightly runs = 6–9 sets updated per night. Runs are idempotent — if a set was updated in run 1, it won't be requeued in run 2 (prices_last_synced_at will be recent).

---

## Notes for Implementation

- `pricingJobRunner.ts` (`runPriceUpdateJob`) is used by the admin sync UI — keep it working but update it to pass an array of setIds through to the orchestrator
- The admin `/api/prices/sync` route (used by the admin prices page) should NOT be changed — it still operates set-by-set for manual control
- The `?force=true` query param on the cron endpoint allows admins to trigger a manual run outside nighttime hours for testing
- Vercel will automatically provide `CRON_SECRET` in request headers when the cron is triggered — configure it in the Vercel dashboard under Environment Variables
