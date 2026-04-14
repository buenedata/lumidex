-- =============================================================================
-- migration_add_tcggo_id_to_cards.sql
-- =============================================================================
-- Adds tcggo_id (integer) to the cards table.
--
-- This is the internal card ID from tcggo.com / cardmarket-api-tcg RapidAPI.
-- It is populated automatically during set price syncs (when the set has an
-- api_set_id mapped to a CardMarket episode). Once stored, it enables the
-- admin to trigger per-card price-history backfills via /api/admin/prices/history-backfill.
--
-- Safe to run on an existing database (ADD COLUMN IF NOT EXISTS).
-- =============================================================================

ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS tcggo_id integer;

COMMENT ON COLUMN public.cards.tcggo_id IS
  'tcggo.com / cardmarket-api-tcg RapidAPI internal card ID. '
  'Populated during episode price sync; used for per-card CardMarket history price lookups.';

-- Index for lookups by tcggo_id (e.g. batch history backfill)
CREATE INDEX IF NOT EXISTS cards_tcggo_id_idx
  ON public.cards (tcggo_id)
  WHERE tcggo_id IS NOT NULL;
