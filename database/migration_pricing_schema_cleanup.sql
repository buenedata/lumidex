-- =============================================================================
-- migration_pricing_schema_cleanup.sql
-- =============================================================================
-- Pricing table schema audit — drop dead columns + add deduplication indexes.
--
-- Audit conducted: 2026-04-16
-- Audited files:
--   services/pricing/priceAggregator.ts      (writeCardPriceCache write set)
--   services/pricing/pricingOrchestrator.ts  (mergeTcggoPrices write set)
--   services/pricing/pokemonApiService.ts    (price_points created)
--   services/pricing/priceRepository.ts      (savePricePoints / savePriceHistory insert shape)
--   app/api/prices/card/[cardId]/route.ts    (card_prices SELECT columns)
--   lib/pricing.ts                           (_fetchCardPricesForSet SELECT columns)
--
-- DO NOT RUN AUTOMATICALLY — a human admin must review and execute manually.
-- =============================================================================


-- =============================================================================
-- SECTION 1 — DROP DEAD COLUMNS FROM card_prices
-- =============================================================================
--
-- Dead = never written by any active code path AND the read value is always
-- NULL (so dropping produces identical runtime behaviour for all consumers).
--
-- ┌─────────────────────┬────────────────────────────┬──────────────────────────────────────────────────────┐
-- │ Column              │ Written by                 │ Read by                                              │
-- ├─────────────────────┼────────────────────────────┼──────────────────────────────────────────────────────┤
-- │ tcgp_updated_at     │ NOBODY (not in any upsert) │ /api/prices/card/[cardId]/route.ts (SELECT + JSON)   │
-- │                     │                            │ components/CardGrid.tsx (TypeScript type only)        │
-- │                     │  → always NULL; the API    │                                                      │
-- │                     │    returns null every time │                                                      │
-- ├─────────────────────┼────────────────────────────┼──────────────────────────────────────────────────────┤
-- │ cm_updated_at       │ NOBODY (not in any upsert) │ /api/prices/card/[cardId]/route.ts (SELECT + JSON)   │
-- │                     │                            │ components/CardGrid.tsx (TypeScript type only)        │
-- │                     │  → always NULL             │                                                      │
-- ├─────────────────────┼────────────────────────────┼──────────────────────────────────────────────────────┤
-- │ api_card_id         │ NOBODY (not in any upsert) │ lib/pricing.ts SELECT + CardPriceRow type            │
-- │                     │                            │ (passed through in raw: r, never used for math)       │
-- │                     │  → always NULL             │                                                      │
-- └─────────────────────┴────────────────────────────┴──────────────────────────────────────────────────────┘
--
-- NOTE on tcgp_1st_edition (NOT DROPPED — see note below):
--   writeCardPriceCache CAN write it (line 136 of priceAggregator.ts), but
--   aggregatePricesForCard() never computes it and mergeTcggoPrices() never
--   sets it → always remains at its original (historically-synced) value.
--   The column IS actively read and displayed by CardGrid.tsx (variant price
--   pill) and app/profile/[id]/page.tsx (portfolio value fallback).
--   Dropping it would silently zero out portfolio value for collectors who own
--   1st-edition variants and have historical prices stored here.
--   RECOMMENDATION: implement a write path in aggregatePricesForCard before
--   considering this column for removal.
--
-- NOTE on cm_cosmos_holo (NOT DROPPED):
--   The lib/pricing.ts comment marks it "manually set" — populated via direct
--   SQL, not the automated pipeline. It IS read by CardGrid.tsx and the API
--   route. Keep as-is.
--
-- =============================================================================

ALTER TABLE public.card_prices DROP COLUMN IF EXISTS tcgp_updated_at;
ALTER TABLE public.card_prices DROP COLUMN IF EXISTS cm_updated_at;
ALTER TABLE public.card_prices DROP COLUMN IF EXISTS api_card_id;


-- =============================================================================
-- SECTION 2 — DEDUPLICATION UNIQUE INDEXES
-- =============================================================================
--
-- Both price_points and card_price_history use plain INSERT (no ON CONFLICT)
-- in priceRepository.ts, meaning every sync run appends new rows.  Without a
-- unique constraint the tables grow unboundedly — one row per card per source
-- per sync, potentially thousands of duplicate rows per day.
--
-- A unique index on (card_id, source, variant_key, is_graded, date) lets
-- callers switch to INSERT … ON CONFLICT DO NOTHING (or UPDATE) to keep exactly
-- one row per card/source/variant per calendar day.
--
-- COALESCE workaround for NULLable variant_key:
--   PostgreSQL treats two NULLs as DISTINCT in a unique index, so a card with
--   variant_key IS NULL would never conflict.  COALESCE(variant_key, '') maps
--   NULL → '' so that two graded rows with no variant both land in the same
--   slot for a given day.
-- =============================================================================

-- ── price_points ─────────────────────────────────────────────────────────────
-- Covers the primary aggregation query in priceAggregator.ts:
--   .from('price_points').select(...).eq('card_id', cardId).gte('recorded_at', since)
-- The compound index also accelerates that query's implicit card_id + date filter.
--
-- Note: grade / grading_company are intentionally omitted from the unique key.
-- For graded rows the combination (card_id, source, '', true, date) is unique
-- enough — multiple grades on the same day for a card come from separate eBay
-- searches and are expected to be deduplicated at the application layer before
-- insert.  If per-grade deduplication is needed later, add grade to this index.

CREATE UNIQUE INDEX IF NOT EXISTS idx_price_points_dedup
  ON public.price_points (card_id, source, COALESCE(variant_key, ''), is_graded, recorded_at);

-- Compound lookup index used by aggregatePricesForCard (last-24h window query):
--   .from('price_points').select(...).eq('card_id', cardId).gte('recorded_at', since)
-- Existing idx_price_points_card_id covers card_id alone; this one adds
-- recorded_at DESC so the date range scan doesn't need a secondary sort.

CREATE INDEX IF NOT EXISTS idx_price_points_card_id_recorded
  ON public.price_points (card_id, recorded_at DESC);


-- ── card_price_history ───────────────────────────────────────────────────────
-- variant_key is NOT NULL in card_price_history (defined as `text NOT NULL` in
-- the original migration), so no COALESCE is required here.
-- The existing cph_card_id_recorded_idx already covers (card_id, recorded_at DESC)
-- for time-series chart queries — this unique index adds deduplication on top.

CREATE UNIQUE INDEX IF NOT EXISTS idx_cph_dedup
  ON public.card_price_history (card_id, source, variant_key, is_graded, recorded_at);


-- =============================================================================
-- SECTION 3 — FOLLOW-UP CODE CHANGES REQUIRED AFTER RUNNING THIS MIGRATION
-- =============================================================================
--
-- The migration is safe to run stand-alone; the column drops are backwards-
-- compatible because the columns are always NULL in the live database.
-- However, the following code files contain references to the dropped columns
-- and should be updated in the same PR:
--
-- 1. app/api/prices/card/[cardId]/route.ts
--    Remove from SELECT list:
--      tcgp_updated_at
--      cm_updated_at
--
-- 2. components/CardGrid.tsx
--    Remove from CardPriceRow type definition (around line 44):
--      tcgp_updated_at: string | null
--      cm_updated_at:   string | null
--
-- 3. lib/pricing.ts
--    Remove from SELECT string (line 183):
--      api_card_id
--    Remove from CardPriceRow interface (line 88):
--      api_card_id: string | null
--
-- 4. services/pricing/priceRepository.ts  (and pricingJobRunner.ts / pricingOrchestrator.ts)
--    Change savePricePoints() and savePriceHistory() from plain INSERT to:
--      INSERT … ON CONFLICT (…dedup key…) DO NOTHING
--    so the new unique indexes are actually exploited for deduplication.
-- =============================================================================
