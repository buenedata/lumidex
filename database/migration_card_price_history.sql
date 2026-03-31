-- ============================================================
-- Lumidex — Card Price History Migration
-- Adds: card_price_history table for time-series price charting
-- Run once in Supabase SQL editor.
-- ============================================================
-- Each time the admin price sync runs, one row per variant per
-- card is inserted here. This powers the line chart on the
-- Price tab of the card detail modal.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.card_price_history (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id      uuid        NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,

  -- Which variant this price point is for
  -- Matches the tcgp_* column suffixes in card_prices
  variant_key  text        NOT NULL,   -- 'normal' | 'reverse_holo' | 'holo' | '1st_edition'

  -- Price in USD (TCGPlayer) or EUR (CardMarket)
  price_usd    numeric(10, 2) NOT NULL,

  -- Which data source this row came from
  source       text        NOT NULL DEFAULT 'tcgplayer', -- 'tcgplayer' | 'cardmarket'

  -- When this price was recorded
  recorded_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
-- Primary lookup: all history for a card, newest first
CREATE INDEX IF NOT EXISTS cph_card_id_recorded_idx
  ON public.card_price_history (card_id, recorded_at DESC);

-- Filter by variant within a card's history
CREATE INDEX IF NOT EXISTS cph_card_variant_idx
  ON public.card_price_history (card_id, variant_key, recorded_at DESC);

-- Source filter (if we ever need to separate TCGPlayer vs CM history)
CREATE INDEX IF NOT EXISTS cph_source_idx
  ON public.card_price_history (source);

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE public.card_price_history ENABLE ROW LEVEL SECURITY;

-- Anyone can read price history (public price data)
CREATE POLICY "card_price_history_public_read"
  ON public.card_price_history FOR SELECT
  USING (true);

-- Only admins can insert price history rows (done by sync route)
CREATE POLICY "card_price_history_admin_insert"
  ON public.card_price_history FOR INSERT
  WITH CHECK (public.is_admin());

-- Admins can delete (e.g., to purge bad data)
CREATE POLICY "card_price_history_admin_delete"
  ON public.card_price_history FOR DELETE
  USING (public.is_admin());
