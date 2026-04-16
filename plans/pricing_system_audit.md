# Pricing System Audit & Redesign Plan

**Date:** 2026-04-16  
**Status:** Authoritative — supersedes `pricing_stable_schedule.md` where they conflict  
**Scope:** Full audit of all pricing services, DB tables, API routes, and cron scheduling

---

## Section 1: Current Architecture Diagram

```
╔══════════════════════════════════════════════════════════════════════════╗
║                         EXTERNAL DATA SOURCES                           ║
╠═══════════════════════╦══════════════════════╦═══════════════════════════╣
║  pokemontcg.io API    ║  tcggo RapidAPI       ║  eBay Browse API          ║
║  (per-card by api_id) ║  (per-set by         ║  (per-card search)        ║
║  → TCGPlayer USD      ║   api_set_id)         ║  → raw ungraded USD       ║
║  → CardMarket EUR     ║  → CM EUR avg7/30/low ║  → graded PSA/CGC/ACE USD ║
║  [often wrong CM URL] ║  → TCGP USD market    ║                           ║
╚═══════════════════════╩══════════════════════╩═══════════════════════════╝
          │                       │                         │
          ▼                       ▼                         ▼
  pokemonApiService.ts    tcggoCardService.ts        ebayService.ts
  fetchPokemonApiPrices   fetchTcggoEpisodePrices    fetchEbayRawPrices
  → RawPricePoint[]       → Map<normNum, Entry>      → EbayPriceResult
                          (one batch call/set)
                                  │
                    ebayGradedService.ts
                    fetchEbayGradedPrices
                    → EbayGradedResult[]
          │                       │                         │
          └───────────────────────┴─────────────────────────┘
                                  │
                        pricingOrchestrator.ts
                        updatePricesBatch()
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
              normalizePoints()          mergeTcggoPrices()
              (EUR → USD via 1.09)       (overwrites CM fields
                                          AFTER aggregation)
                    │
          ┌─────────┴─────────────────────────────────┐
          │                                           │
   priceRepository.ts                    gradedPriceRepository.ts
   savePricePoints()  ──────────►  price_points        upsertGradedPrices()
   savePriceHistory() ──────────►  card_price_history  ──► card_graded_prices
                                                            (upsert, stable)
          │
   priceAggregator.ts
   aggregatePricesForCard()    ◄── reads price_points (last 24h only)
   → CardPriceUpdate
          │
   mergeTcggoPrices()          ← overwrites cm_* fields (bypasses price_points!)
          │
   writeCardPriceCache()       ──────────────────────►  card_prices  (upsert)
          │
   findUndervaluedCards()      (runs after each set)
   importProductPricing()      ──────────────────────►  set_products (upsert)

════════════════════════════════════════════════════════════════════════════

  TRIGGER PATHS
  ─────────────
  Admin UI              POST /api/prices/sync
                          → pricingJobRunner.runPriceUpdateJob(setId)
                          → pricingOrchestrator.updatePricesBatch({setId})
                          [SSE streaming progress back to admin UI]

  Admin batch           POST /api/admin/prices/batch
                          → pricingOrchestrator.updatePricesBatch({setIds})

  Cron (BROKEN)         vercel.json → GET /api/cron/update-prices (01, 02, 03 UTC)
                         ╳ app/api/cron/update-prices/route.ts DOES NOT EXIST
                         → Vercel fires the request → 404 Not Found
                         → Nightly sync has NEVER executed

  History backfill      POST /api/admin/prices/history-backfill
                          → tcggoHistoryService + savePriceHistoryBackfill()

════════════════════════════════════════════════════════════════════════════

  UI READ PATHS
  ─────────────
  Current price         GET /api/prices/card/[cardId]   ← card_prices
  Price chart           GET /api/prices/history/[cardId] ← card_price_history
  Graded prices         GET /api/prices/card/[cardId]/graded ← card_graded_prices
```

---

## Section 2: Problems Identified

Problems are labelled **P1–P15** in order of severity.

---

### P1 — CRITICAL: Cron route does not exist (nightly sync has never run)

**File:** [`vercel.json`](../vercel.json:1)  
**Missing file:** `app/api/cron/update-prices/route.ts`

`vercel.json` registers three nightly Vercel Cron triggers:

```json
{ "path": "/api/cron/update-prices", "schedule": "0 1 * * *" }
{ "path": "/api/cron/update-prices", "schedule": "0 2 * * *" }
{ "path": "/api/cron/update-prices", "schedule": "0 3 * * *" }
```

The corresponding Next.js route `app/api/cron/update-prices/route.ts` **does not exist**. The `app/api/prices/cron/` directory is completely empty. `pricingJobRunner.ts` logs that the cron URL should be `/api/cron/update-prices`, confirming the intent — the file was simply never created.

Every nightly cron invocation since `vercel.json` was committed has returned HTTP 404. The plan in `pricing_stable_schedule.md` specified exactly how this route should work but was never implemented.

**Impact:** Zero automatic price updates. All sync is manual-only via the admin UI.

---

### P2 — CRITICAL: tcggo CM prices bypass `price_points` and `card_price_history`

**Files:** [`pricingOrchestrator.ts:127`](../services/pricing/pricingOrchestrator.ts:127), [`priceAggregator.ts:38`](../services/pricing/priceAggregator.ts:38)

The `mergeTcggoPrices()` function runs **after** `savePriceHistory()` and **after** `aggregatePricesForCard()`. It mutates the `CardPriceUpdate` object in-place, then `writeCardPriceCache()` writes the overridden CM values to `card_prices`. This means:

- `card_prices.cm_avg_sell` → comes from **tcggo** avg7
- `card_price_history` → contains the **pokemontcg.io** CM price for the same card

When both sources have CM data, the history chart (reads `card_price_history`) and the current price card (reads `card_prices`) reflect **different data sources**. A card where pokemontcg.io links to the wrong CardMarket product will show a wrong history even though the current price is correct from tcggo.

Additionally, `cm_avg_30d` is explicitly skipped by the aggregator ("requires wider time window; leave undefined"). `mergeTcggoPrices` does set it from tcggo's `avg30`, but only when `tcggoCmPlausible` is true and tcggo has `avg30` data. For pokemontcg.io-only cards, `card_prices.cm_avg_30d` is permanently null.

---

### P3 — CRITICAL: pokemontcg.io wrong CardMarket product matching

**File:** [`pokemonApiService.ts:119`](../services/pricing/pokemonApiService.ts:119)

pokemontcg.io maintains its own mapping from card IDs to CardMarket product URLs. These mappings are frequently incorrect — a common card's `api_id` can resolve to a premium promo or alt-art version with the same name but vastly different price (e.g. Charmander from Pokémon 151 mapping to the GameStop Stamp Promo at €78 instead of ~€0.30).

The 50× sanity check (`cmNormalUsd > tcgpMaxUsd * 50`) catches extreme mismatches. However:

1. If cards have no TCGPlayer data (tcgpMaxUsd = 0), the check is **bypassed entirely** — line 146: `if (tcgpMaxUsd > 0 && ...)`. A €78 wrong-product match on a Japanese card with no TCGP price passes through unchecked.
2. Moderate wrong-product matches (different card, similar price tier) pass the 50× check silently.
3. The correct fix — always prefer tcggo for CardMarket — only works for sets with `api_set_id` populated.

---

### P4 — HIGH: `price_points` has unbounded growth and no deduplication

**File:** [`priceRepository.ts:11`](../services/pricing/priceRepository.ts:11)

`savePricePoints` uses `INSERT` (not upsert). Every sync appends new rows regardless of whether prices changed. There is no unique constraint, no retention policy, and no cleanup job. Consequences:

1. **Aggregation dilution:** `aggregatePricesForCard` averages all points in the last 24 hours. If a set is synced twice in 24 hours (manual + cron), the aggregator averages across two sets of observations — diluting precision with duplicate data.
2. **Unbounded table size:** After one year of nightly 3-run cron × all sets, `price_points` will contain millions of rows even if prices never change.
3. **Query performance degradation:** The aggregator's hot query (`WHERE card_id = $1 AND recorded_at >= $2`) only has an single-column index on `card_id`, not the compound `(card_id, recorded_at)` needed for efficient range filtering.

Similarly, `savePriceHistory` uses `INSERT` — multiple syncs per day create duplicate daily history rows. The chart renders correctly (more dots, same line shape) but it's wasted storage.

---

### P5 — HIGH: Legacy "all-cards" path (Path B) never calls `mergeTcggoPrices`

**File:** [`pricingOrchestrator.ts:614`](../services/pricing/pricingOrchestrator.ts:614)

When `updatePricesBatch()` is called with no `setIds` (the legacy admin all-cards mode — Path B), the code:
1. Fetches all cards globally
2. For each card: calls `fetchPokemonApiPrices`, `savePricePoints`, `savePriceHistory`, `aggregatePricesForCard`, `writeCardPriceCache`
3. **Does NOT call `fetchTcggoEpisodePrices` or `mergeTcggoPrices` at any point**

Cards synced through Path B get pokemontcg.io prices only. tcggo's more accurate CardMarket data is silently dropped. This is a regression from the set-based Path A that was introduced when set-based processing was added.

---

### P6 — HIGH: tcggo provides no reverse holo CardMarket prices

**File:** [`tcggoCardService.ts:22`](../services/pricing/tcggoCardService.ts:22)

The tcggo API returns `cardmarket.avg7`, `cardmarket.avg30`, and `cardmarket.lowest_near_mint` but these are for the **normal variant only**. There is no reverse holo CM price from tcggo. When `mergeTcggoPrices` overrides CardMarket data with tcggo values, it only sets `cm_avg_sell`, `cm_avg_30d`, `cm_low`, and `cm_trend` — never `cm_reverse_holo`. For sets where pokemontcg.io's `reverseHoloSell` data is wrong or missing, `card_prices.cm_reverse_holo` remains null.

---

### P7 — MEDIUM: Dead columns in `card_prices` schema

**File:** [`database/migration_card_prices.sql:39`](../database/migration_card_prices.sql:39)

The following columns exist in `card_prices` but nothing in the codebase writes to them:

| Column | Status | Note |
|--------|--------|------|
| `tcgp_bgs95` | Dead | BGS 9.5 — eBay graded stored in `card_graded_prices`, not card_prices |
| `tcgp_bgs9` | Dead | BGS 9 — same |
| `tcgp_cgc10` | Dead | CGC 10 — same |
| `tcgp_1st_edition` | Dead | `mapVariant` returns `'normal'` for 1st edition, not a separate variant key |
| `tcgp_updated_at` | Dead | Never populated by any service |
| `cm_updated_at` | Dead | Never populated by any service |

`CardPriceUpdate` type in `types.ts` includes `tcgp_1st_edition` and `cm_cosmos_holo` (cosmos holo is manually set, not auto-fetched), but `tcgp_bgs95`, `tcgp_bgs9`, `tcgp_cgc10` don't even appear in the type — confirmed unreachable.

---

### P8 — MEDIUM: eBay raw prices are recorded but never read back

**Files:** [`pricingOrchestrator.ts:51`](../services/pricing/pricingOrchestrator.ts:51), [`priceAggregator.ts:57`](../services/pricing/priceAggregator.ts:57)

The orchestrator documents: *"eBay raw prices are saved to price_points but are currently NOT aggregated into card_prices or price_history."* The aggregator's `tcgpUngraded` and `cmNormalRows` filters explicitly exclude `source === 'ebay'`.

Additionally:
- `includeEbayRaw` defaults to `false` in `updatePricesBatch` — eBay raw is never fetched in cron or set-sync mode
- `syncSingleCard` in `pricingJobRunner.ts` **does** call `fetchEbayRawPrices` unconditionally regardless of this flag — inconsistent behaviour between single-card and batch modes
- eBay raw points accumulate in `price_points` consuming storage and query time without influencing any output

---

### P9 — MEDIUM: `card_price_history` schema comment uses wrong variant key

**File:** [`database/migration_card_price_history.sql:17`](../database/migration_card_price_history.sql:17)

The migration SQL comment says:
```sql
-- variant_key: 'normal' | 'reverse_holo' | 'holo' | '1st_edition'
```

The actual code stores `'reverse'` (from [`cardMatcher.mapVariant`](../services/pricing/cardMatcher.ts:67): `if (normalized.includes('reverse')) return 'reverse'`). Any external query or future code that uses `'reverse_holo'` as a key to filter history rows returns zero results. This is a documentation bug that causes subtle runtime failures for developers working from schema comments rather than reading service code.

---

### P10 — MEDIUM: Static hardcoded EUR/USD exchange rate

**File:** [`priceNormalizer.ts:6`](../services/pricing/priceNormalizer.ts:6)

```ts
const EXCHANGE_RATES: Record<string, number> = {
  EUR: 1.09,  // EUR → USD
  ...
```

All CardMarket EUR prices are converted to USD before insert into `price_points`. The UI displays these as "EUR" prices after reverse-converting, or treats them as USD directly. Problems:

1. Hardcoded rate of 1.09 will drift from the real rate — all CardMarket price comparisons become systematically incorrect during volatile FX periods
2. Historical `price_points` rows are stored with whatever rate was current at insert time — no way to recompute accurately later
3. `card_prices` schema comment says "CardMarket prices are in EUR" but they are actually stored as USD-converted values in `price_points`

---

### P11 — MEDIUM: `revalidateTag` called with invalid options argument

**File:** [`app/api/prices/sync/route.ts:121`](../app/api/prices/sync/route.ts:121)

```ts
revalidateTag('prices', { expire: 0 })
revalidateTag(`set-prices:${setId}`, { expire: 0 })
```

The Next.js `revalidateTag` function signature is `revalidateTag(tag: string): void`. There is no second options argument in the documented API. Passing `{ expire: 0 }` is silently ignored. The revalidation of the `'prices'` tag still fires (the first argument is valid), but the intent of `{ expire: 0 }` — whatever it was — is never applied.

---

### P12 — MEDIUM: `syncSingleCard` uses session client for DB reads

**File:** [`pricingJobRunner.ts:97`](../services/pricing/pricingJobRunner.ts:97)

```ts
const supabase = await createSupabaseServerClient()
const { data: card } = await supabase.from('cards').select(...)
```

`createSupabaseServerClient()` is the SSR client that reads auth cookies from the active HTTP request. Subsequent write operations in the same function (via `priceAggregator` and `priceRepository`) correctly use `supabaseAdmin`. If `syncSingleCard` is ever called outside an authenticated Next.js request context (e.g. from the cron route, a background worker, or a test), the `cards` table read fails silently under RLS, returning no card and throwing an error. The function should use `supabaseAdmin` for all DB operations.

---

### P13 — LOW: No composite index for the aggregator's hot query

**File:** [`database/migration_price_points.sql:63`](../database/migration_price_points.sql:63)

The aggregator's primary query is:
```sql
SELECT ... FROM price_points
WHERE card_id = $1 AND recorded_at >= $2
```

The current indexes are:
- `idx_price_points_card_id` on `(card_id)` — partial match
- `idx_price_points_source` on `(source)` — not used by this query
- `idx_price_points_variant_key` on `(variant_key)` — not used by this query

There is no `(card_id, recorded_at DESC)` compound index. As `price_points` grows (no retention policy, append-only inserts), this query performs a filtered index scan on `card_id` then evaluates `recorded_at` per-row. For a card with thousands of historical rows, this becomes slow.

---

### P14 — LOW: tcggo mislabels TCGPlayer prices as EUR

**File:** [`tcggoCardService.ts:15`](../services/pricing/tcggoCardService.ts:15), [`pricingOrchestrator.ts:175`](../services/pricing/pricingOrchestrator.ts:175)

The tcggo API labels TCGPlayer `market_price` in EUR but the values are actually USD. The orchestrator acknowledges this in a comment and does not apply currency conversion. This is a stable workaround as long as tcggo does not fix their labeling — if they ever do, USD prices would be incorrectly double-converted.

---

### P15 — LOW: `pricingJobRunner.ts` is a redundant wrapper

**File:** [`pricingJobRunner.ts:62`](../services/pricing/pricingJobRunner.ts:62)

`runPriceUpdateJob` is a one-function wrapper around `updatePricesBatch` that adds logging. The `syncSingleCard` function duplicates logic already present in the full orchestrator path for single-card processing. Both functions should be consolidated or one eliminated to reduce the number of code paths to maintain.

---

## Section 3: Rewrite vs. Incremental Fix Decision

### Recommendation: **Targeted incremental fixes — no rewrite**

**Reasoning:**

The core architecture is fundamentally correct and well-structured:
- The three-table model (`price_points` → aggregation → `card_prices`) separates raw data from computed snapshots correctly
- The service layer separation (pokemonApiService, tcggoCardService, ebayService) is clean and each service is independently testable
- The orchestrator's fast/full path split correctly optimizes for throughput vs. accuracy
- The set-tier scheduling concept (recent/older) in `pricing_stable_schedule.md` is well-reasoned
- The `mergeTcggoPrices` strategy — always prefer tcggo for CM, fall back to pokemontcg.io for TCGP — is the right approach

**What went wrong is not the design, it is the implementation gaps:**
1. The cron route was planned, `vercel.json` was configured, but the route file was never created
2. Edge cases in the orchestrator (Legacy Path B, tcggo bypassing history) were not caught in code review
3. Schema debt accumulated as dead columns were added but not cleaned up

**A full rewrite would:**
- Reproduce the same 3-table architecture (there is no better data model for this problem)
- Reproduce the same data source strategy (pokemontcg.io + tcggo + eBay)
- Reproduce the same variant naming complexity (the TCGPlayer API uses 'reverseHolofoil', the system normalises to 'reverse', the column is 'tcgp_reverse_holo')
- Carry significant regression risk for a system under active production use
- Require re-fetching historical price data that already exists in `card_price_history`

The 15 problems above divide cleanly into three categories:

| Category | Count | Action |
|----------|-------|--------|
| Never-implemented features | P1, P5 | Add the missing code |
| Data integrity gaps needing schema + query changes | P2, P4, P6, P13 | Targeted migrations + query fixes |
| Acknowledged dead code / documentation debt | P7, P8, P9, P10, P14 | Remove or formalise |
| Minor bugs / improvement | P3, P11, P12, P15 | Targeted fixes |

None require re-architecting the system.

---

## Section 4: Proposed Clean Architecture

The overall structure stays the same. The changes are surgical.

### 4.1 Database changes

```sql
-- ── Fix 1: Deduplicate price_points (one observation per card/source/variant/day) ───
-- Requires purging existing duplicates first (see Phase 2 migration note)
CREATE UNIQUE INDEX IF NOT EXISTS idx_price_points_daily_dedup
  ON price_points (card_id, source, variant_key, DATE(recorded_at AT TIME ZONE 'UTC'));

-- ── Fix 2: Compound index for aggregator hot query ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_price_points_card_recorded
  ON price_points (card_id, recorded_at DESC);

-- ── Fix 3: Deduplicate card_price_history (one entry per card/source/variant/day) ─
CREATE UNIQUE INDEX IF NOT EXISTS idx_cph_daily_dedup
  ON card_price_history (card_id, source, variant_key, DATE(recorded_at AT TIME ZONE 'UTC'));

-- ── Fix 4: Add retention policy (soft — retain 2 years, purge older) ─────────────
-- Run via pg_cron or Supabase scheduled function:
-- DELETE FROM price_points WHERE recorded_at < now() - interval '2 years';

-- ── Deprecate dead columns (document, do not drop until confirmed unused by UI) ───
-- tcgp_bgs95, tcgp_bgs9, tcgp_cgc10, tcgp_1st_edition, tcgp_updated_at, cm_updated_at
```

### 4.2 Service changes

**[`priceRepository.savePricePoints()`](../services/pricing/priceRepository.ts:11)**  
Change from `insert` to `upsert()` with `{ onConflict: 'card_id,source,variant_key,DATE(recorded_at)' }` and `ignoreDuplicates: true`. This requires the unique index from Fix 1. Net effect: running sync twice in a day is idempotent.

**[`priceRepository.savePriceHistory()`](../services/pricing/priceRepository.ts:49)**  
Same change — upsert with `ignoreDuplicates: true` on the Fix 3 unique index.

**[`pricingOrchestrator.mergeTcggoPrices()`](../services/pricing/pricingOrchestrator.ts:127)**  
After computing `tcggoCmPlausible` and setting the aggregated fields, also synthesize and save price_points + history rows for the tcggo CM data. This ensures `card_price_history` reflects the same source as `card_prices.cm_avg_sell`. Use the same synthesize-and-push pattern already used in the fast path when pokemontcg.io has no CM data (lines 286–303).

**[`pricingOrchestrator.updatePricesBatch()` Path B](../services/pricing/pricingOrchestrator.ts:614)**  
Replicate the same tcggo episode fetch + `cardIdToNormNum` map + `mergeTcggoPrices` call that exists in the set-based Path A. Path B should behave identically to Path A for cards it processes.

**[`pricingJobRunner.syncSingleCard()`](../services/pricing/pricingJobRunner.ts:97)**  
Replace `createSupabaseServerClient()` with `supabaseAdmin` for the card lookup.  
Remove unconditional `fetchEbayRawPrices` call (or gate it behind `includeEbayRaw` option to match batch behavior).

**[`app/api/prices/sync/route.ts:121`](../app/api/prices/sync/route.ts:121)**  
Remove the invalid `{ expire: 0 }` argument from `revalidateTag` calls.

**[`services/pricing/pokemonApiService.ts:146`](../services/pricing/pokemonApiService.ts:146)**  
Fix the CM sanity check bypass when `tcgpMaxUsd === 0`: apply a fallback absolute price ceiling (e.g. any CM price > €50 on a card with no TCGPlayer data is suspect) rather than skipping the check entirely.

### 4.3 New cron route

Create `app/api/cron/update-prices/route.ts` exactly as specified in `pricing_stable_schedule.md`:

```
GET /api/cron/update-prices
1. Verify Authorization: Bearer <CRON_SECRET>
2. Nighttime guard: UTC hour in [21..23, 0..4] OR ?force=true
3. Call setTierService.getSetsForPricing() → ordered setIds
4. If empty → { ok: true, message: 'No sets due' }
5. Call updatePricesBatch({ setIds, includeGraded: true, timeBudgetMs: 270_000 })
6. Return full result JSON
```

Note: `setTierService.ts` already exists in `services/pricing/` — it only needs to be wired into the cron route.

### 4.4 CardMarket URL strategy

Tighten the CM URL acceptance rule in `pokemonApiService`: only propagate `cmUrl` when the CM price passed the sanity check AND `tcgpMaxUsd > 0`. For zero-TCGPlayer-price cards, do not store a CM URL from pokemontcg.io — rely on `CardMarket URL overrides` (`card_cm_url_overrides` table) for these edge cases.

---

## Section 5: Implementation Roadmap

Each phase is independently deployable without depending on later phases.

---

### Phase 1 — Fix the cron (deploy alone, immediate value)

> This is the single highest-value change. Everything else is refinement.

| # | Task | File | Notes |
|---|------|------|-------|
| 1.1 | Create `app/api/cron/update-prices/route.ts` | New file | Exact spec in `pricing_stable_schedule.md` |
| 1.2 | Verify `setTierService.getSetsForPricing()` is implemented | `services/pricing/setTierService.ts` | File exists — check if function is exported |
| 1.3 | Ensure `CRON_SECRET` env var is set in Vercel dashboard | Vercel UI | Without this, route rejects all requests |
| 1.4 | Test with `?force=true` query param during daytime | Local/staging | Bypasses the nighttime guard |
| 1.5 | Monitor first 3 nightly cron runs via Vercel logs | Vercel dashboard | Confirm 200 responses, not 404 |

**Acceptance:** Vercel cron logs show three successful 200 responses per night. `sets.prices_last_synced_at` is updated nightly.

---

### Phase 2 — Data integrity: deduplication and index

> Prevents table bloat and aggregation noise without changing any displayed prices.

| # | Task | File | Notes |
|---|------|------|-------|
| 2.1 | Add compound index `(card_id, recorded_at DESC)` to `price_points` | New migration | Non-destructive; can run while app is live |
| 2.2 | Purge duplicate `price_points` rows (keep latest per day per card/source/variant) | One-time SQL | Run before adding unique index |
| 2.3 | Add unique index on `price_points(card_id, source, variant_key, DATE(recorded_at))` | New migration | After dedup purge |
| 2.4 | Change `savePricePoints` to upsert with `ignoreDuplicates: true` | `priceRepository.ts` | Requires index from 2.3 |
| 2.5 | Purge duplicate `card_price_history` rows | One-time SQL | Keep one per card/source/variant/day |
| 2.6 | Add unique index on `card_price_history(card_id, source, variant_key, DATE(recorded_at))` | New migration | After dedup purge |
| 2.7 | Change `savePriceHistory` to upsert with `ignoreDuplicates: true` | `priceRepository.ts` | Requires index from 2.6 |

**Acceptance:** Running admin sync twice in one day produces identical `card_prices` values and no duplicate history rows.

---

### Phase 3 — Accuracy: tcggo-to-history consistency and Path B fix

> Fixes cases where the chart shows different prices than the current price card.

| # | Task | File | Notes |
|---|------|------|-------|
| 3.1 | In `mergeTcggoPrices`, emit a price_point + history row for tcggo CM data | `pricingOrchestrator.ts` | Only when tcggo overrides pokemontcg.io CM |
| 3.2 | In Legacy Path B, add tcggo episode fetch + `mergeTcggoPrices` call | `pricingOrchestrator.ts` | Mirror what set-based Path A does |
| 3.3 | Fix CM sanity check bypass for zero-TCGPlayer-price cards | `pokemonApiService.ts` | Add absolute €50 ceiling as fallback anchor |
| 3.4 | Fix `revalidateTag` invalid options argument | `app/api/prices/sync/route.ts` | Remove `{ expire: 0 }` |

**Acceptance:** Cards in sets tracked by tcggo show consistent prices between the current-price display and the 7-day chart. Running Legacy Path B produces the same CM prices as set-based Path A for the same cards.

---

### Phase 4 — Bug fixes: session client and eBay raw

| # | Task | File | Notes |
|---|------|------|-------|
| 4.1 | Replace `createSupabaseServerClient` with `supabaseAdmin` in `syncSingleCard` | `pricingJobRunner.ts` | Prevents RLS failures in non-request contexts |
| 4.2 | Gate `fetchEbayRawPrices` in `syncSingleCard` behind `includeEbayRaw` option | `pricingJobRunner.ts` | Match batch behavior |
| 4.3 | Document eBay raw as intentionally unused in aggregation (or decide to remove) | `pricingOrchestrator.ts` | Clarify final intent |

---

### Phase 5 — Schema cleanup: dead columns and schema comment fix

| # | Task | File | Notes |
|---|------|------|-------|
| 5.1 | Update `card_price_history` schema comment to say `'reverse'` not `'reverse_holo'` | `database/migration_card_price_history.sql` OR code comment | Documentation only |
| 5.2 | Confirm UI never reads `tcgp_bgs95`, `tcgp_bgs9`, `tcgp_cgc10` from `card_prices` | Code search | Before dropping columns |
| 5.3 | Migration to drop dead columns from `card_prices` | New migration | `tcgp_bgs95`, `tcgp_bgs9`, `tcgp_cgc10`, `tcgp_updated_at`, `cm_updated_at` |
| 5.4 | Remove `tcgp_1st_edition` from `CardPriceUpdate` type if confirmed unused | `types.ts` | Or keep as future-proofing |

---

### Phase 6 — Optional: live exchange rate for CardMarket prices

> Lower priority. Only matters if EUR/USD moves >10% from 1.09.

| # | Task | Notes |
|---|------|-------|
| 6.1 | Add a `currency_rates` table (source, base, quote, rate, fetched_at) | Seeded daily via ECB or Open Exchange Rates |
| 6.2 | Replace hardcoded `EUR: 1.09` with a DB lookup in `priceNormalizer.toUsd()` | Fallback to 1.09 if DB rate unavailable |
| 6.3 | Alternative: store CM prices in EUR natively in `price_points`, convert only at display time | More flexible but requires UI changes |

---

## Appendix: Quick Reference — Variant Key Names

| API key (pokemontcg.io) | `mapVariant()` output | `price_points.variant_key` | `card_prices` column |
|---|---|---|---|
| `normal` | `'normal'` | `'normal'` | `tcgp_normal` |
| `reverseHolofoil` | `'reverse'` | `'reverse'` | `tcgp_reverse_holo` |
| `holofoil` | `'holo'` | `'holo'` | `tcgp_holo` |
| `1stEditionNormal` | `'normal'` (dead!) | `'normal'` | `tcgp_normal` (no `tcgp_1st_edition`) |
| `pokeball` | `'pokeball'` | `'pokeball'` | (no column) |
| `masterball` | `'masterball'` | `'masterball'` | (no column) |

> **Note:** The history chart must use `variant_key = 'reverse'` to query reverse holo history. The schema comment incorrectly says `'reverse_holo'`.

---

## Appendix: File Inventory

| File | Lines | Purpose | Status |
|------|-------|---------|--------|
| `services/pricing/pricingOrchestrator.ts` | 733 | Main sync pipeline | Working but has P2, P5 gaps |
| `services/pricing/pricingJobRunner.ts` | 191 | Wrapper + single-card sync | Has P4.1 bug |
| `services/pricing/priceAggregator.ts` | 159 | Reads price_points → card_prices | Working; misses cm_avg_30d |
| `services/pricing/priceRepository.ts` | 138 | Writes to price_points + history | Working but no dedup |
| `services/pricing/pokemonApiService.ts` | 197 | pokemontcg.io fetch | Has P3 CM sanity check gap |
| `services/pricing/tcggoCardService.ts` | 172 | tcggo RapidAPI fetch | Working |
| `services/pricing/tcggoHistoryService.ts` | — | Historical backfill from tcggo | Working |
| `services/pricing/cardMatcher.ts` | 91 | Variant key mapping | Working |
| `services/pricing/priceNormalizer.ts` | 75 | EUR→USD conversion | Has P11 hardcoded rate |
| `services/pricing/setTierService.ts` | — | Set tier classification for cron | Exists, needs wiring |
| `services/pricing/ebayService.ts` | — | eBay raw prices | Working; output unused |
| `services/pricing/ebayGradedService.ts` | — | eBay graded prices | Working |
| `services/pricing/undervaluedDetector.ts` | — | Undervalued card detection | Working |
| `services/pricing/productPricingService.ts` | — | Sealed product prices | Working |
| `app/api/cron/update-prices/route.ts` | — | **DOES NOT EXIST** | Must be created (Phase 1) |
| `app/api/prices/sync/route.ts` | 157 | Admin manual sync (SSE) | Has P12 revalidateTag bug |
| `vercel.json` | 17 | Cron schedule config | Configured but cron 404s |
