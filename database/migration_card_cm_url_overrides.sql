-- Migration: card_cm_url_overrides
-- Per-card, per-variant CardMarket URL overrides.
--
-- The pokemontcg.io API returns a single cardmarket.url per card which is stored
-- in card_prices.cm_url. For some cards (e.g. Charmander/151) that URL points to
-- the wrong CardMarket product version (e.g. V3 instead of V1 for the standard
-- non-holo printing, or V5 for the Cosmos Holo variant).
--
-- This table allows admins to supply the correct CardMarket product URL for each
-- variant of a card. When an override exists it takes precedence over cm_url.
--
-- Reverse Holo URLs are AUTO-DERIVED at display time:
--   reverse holo URL = base_url + ?isReverseHolo=Y
-- where base_url = overrides['normal'] ?? card_prices.cm_url
--
-- Run this in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS card_cm_url_overrides (
  id          uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id     uuid         NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  variant_key text         NOT NULL,   -- e.g. 'normal', 'reverse', 'cosmos_holo', 'masterball'
  cm_url      text         NOT NULL,
  created_at  timestamptz  DEFAULT now(),
  updated_at  timestamptz  DEFAULT now(),
  CONSTRAINT unique_card_variant_cmurl UNIQUE (card_id, variant_key)
);

CREATE INDEX IF NOT EXISTS idx_ccuo_card_id ON card_cm_url_overrides(card_id);

-- Enable RLS
ALTER TABLE card_cm_url_overrides ENABLE ROW LEVEL SECURITY;

-- Anyone (incl. unauthenticated) can read — CM URLs are public data
CREATE POLICY "ccuo_read_all"
  ON card_cm_url_overrides FOR SELECT
  USING (true);

-- Service-role (supabaseAdmin) bypasses RLS — no explicit write policy needed.
