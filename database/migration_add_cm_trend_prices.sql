-- =============================================================================
-- migration_add_cm_trend_prices.sql
-- =============================================================================
-- Adds two CardMarket trend-average price columns to item_prices.
--
-- The TCGGO bulk-episode endpoint already returns these fields on every sync:
--   prices.cardmarket["30d_average"]  — 30-day rolling average (EUR)
--   prices.cardmarket["7d_average"]   — 7-day rolling average (EUR)
-- but they were never persisted.  This migration adds the storage columns so
-- the sync pipeline can write them and consumers (price charts, analytics) can
-- read them.
--
-- The columns are populated on item_type='single', variant='normal' rows only.
-- graded rows and the reverse_holo approximation row remain NULL because
-- the TCGGO response exposes these averages at the card level, not per-variant.
--
-- NUMERIC(10,4) matches the precision used across all other price columns.
-- Both columns are nullable — not all cards have CardMarket listings.
--
-- Safe to run multiple times (ADD COLUMN IF NOT EXISTS).
-- =============================================================================

ALTER TABLE public.item_prices
  ADD COLUMN IF NOT EXISTS cm_30d_avg_eur NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS cm_7d_avg_eur  NUMERIC(10,4);

COMMENT ON COLUMN public.item_prices.cm_30d_avg_eur
  IS 'CardMarket 30-day rolling average price (EUR). '
     'Sourced from prices.cardmarket["30d_average"] in the TCGGO API response. '
     'Populated on item_type=''single'', variant=''normal'' rows only. NULL when unavailable.';

COMMENT ON COLUMN public.item_prices.cm_7d_avg_eur
  IS 'CardMarket 7-day rolling average price (EUR). '
     'Sourced from prices.cardmarket["7d_average"] in the TCGGO API response. '
     'Populated on item_type=''single'', variant=''normal'' rows only. NULL when unavailable.';
