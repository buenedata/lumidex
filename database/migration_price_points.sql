-- =============================================================================
-- migration_price_points.sql
-- =============================================================================
-- Creates the `price_points` table, which is the new source of truth for
-- pricing data across all sources (TCGPlayer, Cardmarket, eBay).
--
-- This migration is safe to run on an existing database.
-- The table is created with IF NOT EXISTS to prevent errors on re-runs.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- TABLE: price_points
-- -----------------------------------------------------------------------------
-- Stores individual price observations for a card, keyed by source, variant,
-- condition, and optional grading information.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS price_points (
  -- Primary key: auto-generated UUID
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign key to the card this price applies to
  card_id        uuid         NOT NULL REFERENCES cards(id) ON DELETE CASCADE,

  -- The pricing source; restricted to known integrations
  source         text         NOT NULL CHECK (source IN ('tcgplayer', 'cardmarket', 'ebay')),

  -- Optional variant key (e.g. 'normal', 'holo', 'reverse', 'pokeball', 'masterball')
  variant_key    text,

  -- Price value with 4 decimal places for precision across currencies
  price          numeric(10,4) NOT NULL,

  -- ISO 4217 currency code; defaults to USD
  currency       text         NOT NULL DEFAULT 'USD',

  -- Optional condition descriptor (e.g. 'NM', 'LP', 'MP', 'HP', 'DMG')
  condition      text,

  -- Whether this price is for a graded copy of the card
  is_graded      boolean      NOT NULL DEFAULT false,

  -- Numeric grade value (e.g. 9.5, 10.0); only relevant when is_graded = true
  grade          numeric(4,1),

  -- Grading company name (e.g. 'PSA', 'BGS', 'CGC'); only relevant when is_graded = true
  grading_company text,

  -- Timestamp when this price point was recorded
  recorded_at    timestamptz  NOT NULL DEFAULT now()
);


-- -----------------------------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------------------------
-- Index on card_id for fast lookups by card
-- Index on source for filtering by pricing provider
-- Index on variant_key for filtering by card variant
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_price_points_card_id
  ON price_points (card_id);

CREATE INDEX IF NOT EXISTS idx_price_points_source
  ON price_points (source);

CREATE INDEX IF NOT EXISTS idx_price_points_variant_key
  ON price_points (variant_key);


-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
-- Enable RLS so that access is controlled at the row level via policies.
-- -----------------------------------------------------------------------------

ALTER TABLE price_points ENABLE ROW LEVEL SECURITY;

-- Allow any authenticated or anonymous user to read price points
-- Drop first (idempotent), then recreate
DROP POLICY IF EXISTS "price_points_select_public" ON price_points;
CREATE POLICY "price_points_select_public"
  ON price_points
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Only admin users may insert new price points
DROP POLICY IF EXISTS "price_points_insert_admin" ON price_points;
CREATE POLICY "price_points_insert_admin"
  ON price_points
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
  );

-- Only admin users may update existing price points
DROP POLICY IF EXISTS "price_points_update_admin" ON price_points;
CREATE POLICY "price_points_update_admin"
  ON price_points
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
  );

-- Only admin users may delete price points
DROP POLICY IF EXISTS "price_points_delete_admin" ON price_points;
CREATE POLICY "price_points_delete_admin"
  ON price_points
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
  );
