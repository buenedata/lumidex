-- ============================================================
-- Lumidex — Card Prices Migration
-- Adds: cards.api_id, card_prices table, set_products table
-- Run once in Supabase SQL editor.
-- ============================================================

-- ── 1. Add api_id to cards ────────────────────────────────────────────────────
--   Stores the pokemontcg.io / RapidAPI card ID (e.g. "sv1-1").
--   Used as the primary key for price matching — avoids card-number ambiguity
--   across sets (card #25 exists in every set; sv1-25 is globally unique).

ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS api_id text;

-- Unique index (partial — only on non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS cards_api_id_idx
  ON public.cards (api_id)
  WHERE api_id IS NOT NULL;

-- ── 2. card_prices table ──────────────────────────────────────────────────────
--   One row per card. Upserted by the admin price-sync route.
--   TCGPlayer prices are in USD; CardMarket prices are in EUR.

CREATE TABLE IF NOT EXISTS public.card_prices (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id             uuid        NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,

  -- ── TCGPlayer prices (USD) ────────────────────────────────────────────────
  tcgp_normal         numeric(10, 2),   -- "normal" variant market price
  tcgp_reverse_holo   numeric(10, 2),   -- "reverseHolofoil" market price
  tcgp_holo           numeric(10, 2),   -- "holofoil" market price
  tcgp_1st_edition    numeric(10, 2),   -- "1stEditionHolofoil" / "1stEditionNormal"
  tcgp_market         numeric(10, 2),   -- best available market price
                                        --   (holofoil ?? reverseHolofoil ?? normal)

  -- ── TCGPlayer graded prices (USD) ─────────────────────────────────────────
  --   Keys confirmed on first sync via logged API response; may be null
  --   if the API does not return graded data for this card.
  tcgp_psa10          numeric(10, 2),   -- PSA 10 Gem Mint
  tcgp_psa9           numeric(10, 2),   -- PSA 9 Mint
  tcgp_bgs95          numeric(10, 2),   -- BGS 9.5 Gem Mint
  tcgp_bgs9           numeric(10, 2),   -- BGS 9 Mint
  tcgp_cgc10          numeric(10, 2),   -- CGC 10 Pristine

  -- ── CardMarket prices (EUR) ───────────────────────────────────────────────
  cm_avg_sell         numeric(10, 2),   -- averageSellPrice
  cm_low              numeric(10, 2),   -- lowPrice
  cm_trend            numeric(10, 2),   -- trendPrice
  cm_avg_30d          numeric(10, 2),   -- avg30

  -- ── Metadata ─────────────────────────────────────────────────────────────
  api_card_id         text,             -- raw API card ID e.g. "sv1-25" (audit/debug)
  tcgp_updated_at     text,             -- ISO date from TCGPlayer API response
  cm_updated_at       text,             -- ISO date from CardMarket API response
  fetched_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT card_prices_card_id_key UNIQUE (card_id)
);

-- RLS
ALTER TABLE public.card_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "card_prices_public_read"
  ON public.card_prices FOR SELECT USING (true);

CREATE POLICY "card_prices_admin_insert"
  ON public.card_prices FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "card_prices_admin_update"
  ON public.card_prices FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "card_prices_admin_delete"
  ON public.card_prices FOR DELETE
  USING (public.is_admin());

-- Indexes
CREATE INDEX IF NOT EXISTS card_prices_card_id_idx
  ON public.card_prices (card_id);

CREATE INDEX IF NOT EXISTS card_prices_fetched_at_idx
  ON public.card_prices (fetched_at DESC);

-- updated_at auto-trigger
CREATE TRIGGER handle_updated_at_card_prices
  BEFORE UPDATE ON public.card_prices
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── 3. set_products table ─────────────────────────────────────────────────────
--   Stores sealed product pricing per set.
--   Populated by the same sync route — conditional on the API having a
--   /products endpoint (skipped silently if absent).

CREATE TABLE IF NOT EXISTS public.set_products (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id          text        NOT NULL,   -- FK → sets.set_id (text PK)
  api_product_id  text,                   -- raw API product ID e.g. "sv1-booster-box"
  name            text        NOT NULL,   -- "Scarlet & Violet Booster Box"

  -- Product category normalised to one of:
  -- 'Booster Pack' | 'Booster Box' | 'ETB' | 'Collection' | 'Tin' | 'Other'
  product_type    text,

  -- ── TCGPlayer prices (USD) ────────────────────────────────────────────────
  tcgp_market     numeric(10, 2),
  tcgp_low        numeric(10, 2),
  tcgp_high       numeric(10, 2),
  tcgp_url        text,

  -- ── CardMarket prices (EUR) ───────────────────────────────────────────────
  cm_avg_sell     numeric(10, 2),
  cm_trend        numeric(10, 2),
  cm_url          text,

  fetched_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT set_products_api_product_id_key UNIQUE (api_product_id)
);

-- RLS
ALTER TABLE public.set_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "set_products_public_read"
  ON public.set_products FOR SELECT USING (true);

CREATE POLICY "set_products_admin_insert"
  ON public.set_products FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "set_products_admin_update"
  ON public.set_products FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "set_products_admin_delete"
  ON public.set_products FOR DELETE
  USING (public.is_admin());

-- Indexes
CREATE INDEX IF NOT EXISTS set_products_set_id_idx
  ON public.set_products (set_id);

CREATE INDEX IF NOT EXISTS set_products_product_type_idx
  ON public.set_products (product_type);

-- updated_at auto-trigger
CREATE TRIGGER handle_updated_at_set_products
  BEFORE UPDATE ON public.set_products
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
