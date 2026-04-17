-- =============================================================================
-- migration_item_prices.sql
-- =============================================================================
-- Creates the item_prices table — a unified price cache for singles, graded
-- cards, and sealed products sourced from the TCGGO API (primary) or
-- Cardmarket (fallback).
--
-- This replaces the old pricing system (card_prices, card_price_history,
-- card_graded_prices, price_points) which was torn down in
-- migration_pricing_teardown.sql. Do NOT reference those old tables here.
--
-- Safe to run on a clean database (CREATE TABLE IF NOT EXISTS).
-- Indexes use IF NOT EXISTS for full idempotency.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1 — TABLE
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.item_prices (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  item_id     text        NOT NULL,                       -- TCGGO internal ID (stored as text)
  item_type   text        NOT NULL,                       -- 'single' | 'graded' | 'product'
  variant     text        NOT NULL DEFAULT 'normal',      -- 'normal' | 'reverse_holo' | grade keys ('psa10', 'bgs9', …)
  price       numeric     NULL,                           -- NULL when price is unavailable / not fetched yet
  currency    text        NOT NULL DEFAULT 'EUR',
  source      text        NOT NULL,                       -- 'tcggo' | 'cardmarket'
  updated_at  timestamptz NOT NULL DEFAULT now(),

  -- Primary key
  CONSTRAINT item_prices_pkey PRIMARY KEY (id),

  -- One price row per item / type / variant combination
  CONSTRAINT item_prices_item_id_item_type_variant_key
    UNIQUE (item_id, item_type, variant),

  -- Guard against unknown item types
  CONSTRAINT item_prices_item_type_check
    CHECK (item_type IN ('single', 'graded', 'product')),

  -- Guard against unknown price sources
  CONSTRAINT item_prices_source_check
    CHECK (source IN ('tcggo', 'cardmarket'))
);

COMMENT ON TABLE public.item_prices IS
  'Unified price cache for singles, graded cards, and sealed products. '
  'Source: TCGGO API (primary) or Cardmarket (fallback). TTL: 24h.';


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2 — INDEXES
-- ─────────────────────────────────────────────────────────────────────────────

-- Primary lookup: fetch the price for a specific item/type/variant tuple.
CREATE INDEX IF NOT EXISTS idx_item_prices_lookup
  ON public.item_prices (item_id, item_type, variant);

-- Freshness check: find rows that have not been refreshed within the TTL window.
CREATE INDEX IF NOT EXISTS idx_item_prices_updated_at
  ON public.item_prices (updated_at);


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3 — ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.item_prices ENABLE ROW LEVEL SECURITY;

-- Public read: prices are not sensitive; any authenticated (or anon) user may
-- SELECT. Adjust to "authenticated" if anonymous reads should be blocked.
CREATE POLICY "item_prices: public read"
  ON public.item_prices
  FOR SELECT
  USING (true);

-- Write access is intentionally restricted to the service_role (server-side
-- price sync jobs). No client-side code should ever insert or mutate prices.
CREATE POLICY "item_prices: service_role write"
  ON public.item_prices
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
