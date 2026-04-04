-- ============================================================
-- Lumidex — Card Graded Prices Migration
-- Adds: card_graded_prices table
--
-- Stores eBay last-sold graded card prices per grading company
-- and grade. Separate from card_prices (which holds TCGPlayer
-- and CardMarket data) because:
--   - Multiple companies: PSA, CGC, ACE
--   - Multiple grades per company: 1–10
--   - Source is always eBay last-sold (not TCGPlayer/CM)
--
-- Run once in Supabase SQL editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.card_graded_prices (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id         uuid         NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,

  -- Grading company — one of the three supported providers
  grading_company text         NOT NULL CHECK (grading_company IN ('PSA', 'CGC', 'ACE')),

  -- Numeric grade (1–10 for PSA/CGC/ACE)
  grade           integer      NOT NULL CHECK (grade >= 1 AND grade <= 10),

  -- Average of cleaned (outlier-removed) sold prices in USD
  avg_price_usd   numeric(10, 2) NOT NULL,

  -- Number of eBay listings used to compute the average (after outlier removal)
  sample_size     integer      NOT NULL DEFAULT 1,

  -- When this row was last fetched/updated
  fetched_at      timestamptz  NOT NULL DEFAULT now(),

  -- One row per (card, company, grade) — upserted on each sync
  CONSTRAINT card_graded_prices_unique UNIQUE (card_id, grading_company, grade)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS card_graded_prices_card_id_idx
  ON public.card_graded_prices (card_id);

CREATE INDEX IF NOT EXISTS card_graded_prices_company_idx
  ON public.card_graded_prices (grading_company);

CREATE INDEX IF NOT EXISTS card_graded_prices_fetched_at_idx
  ON public.card_graded_prices (fetched_at DESC);

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE public.card_graded_prices ENABLE ROW LEVEL SECURITY;

-- Public read — anyone can see graded prices
CREATE POLICY "card_graded_prices_public_read"
  ON public.card_graded_prices FOR SELECT USING (true);

-- Only admins may write
CREATE POLICY "card_graded_prices_admin_insert"
  ON public.card_graded_prices FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "card_graded_prices_admin_update"
  ON public.card_graded_prices FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "card_graded_prices_admin_delete"
  ON public.card_graded_prices FOR DELETE
  USING (public.is_admin());
