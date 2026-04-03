-- =============================================================================
-- migration_extend_price_history.sql
-- =============================================================================
-- Extends the existing `card_price_history` table with 3 new columns to
-- support graded card pricing data.
--
-- This migration is NON-DESTRUCTIVE and safe to run on an existing database:
--   - No existing columns are removed
--   - No existing column types are changed
--   - No constraints are added to existing columns
--   - All new columns use ADD COLUMN IF NOT EXISTS to prevent errors on re-runs
--
-- Existing `card_price_history` columns (preserved, unchanged):
--   id             uuid         PK
--   card_id        uuid         FK → cards.id
--   variant_key    text         NOT NULL
--   price_usd      numeric(10,2) NOT NULL
--   source         text         NOT NULL DEFAULT 'tcgplayer'
--   recorded_at    timestamptz  NOT NULL DEFAULT now()
-- =============================================================================


-- -----------------------------------------------------------------------------
-- ALTER TABLE: card_price_history
-- Add grading-related columns
-- -----------------------------------------------------------------------------
-- is_graded       — flags whether the recorded price is for a graded copy
-- grade           — the numeric grade value (e.g. 9.5, 10.0); nullable
-- grading_company — the company that issued the grade (e.g. PSA, BGS); nullable
-- -----------------------------------------------------------------------------

ALTER TABLE card_price_history
  ADD COLUMN IF NOT EXISTS is_graded       boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS grade           numeric(4,1),
  ADD COLUMN IF NOT EXISTS grading_company text;
