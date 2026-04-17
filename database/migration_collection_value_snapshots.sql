-- ============================================================
-- Lumidex — Migration: collection_value_snapshots
-- Purpose: Stores daily collection value snapshots for
--          the Portfolio Value Over Time Pro feature.
-- Run once in Supabase SQL editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.collection_value_snapshots (
  id              uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid            NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Truncated to calendar day (UTC); used as the unique key per user/day
  snapshot_date   date            NOT NULL DEFAULT current_date,

  -- Total portfolio value in EUR at time of snapshot.
  -- Computed as: SUM(item_prices.price * user_card_variants.quantity)
  -- for all owned cards with a known normal-variant EUR price.
  total_value_eur numeric(12, 2)  NOT NULL DEFAULT 0,

  -- Distinct card variants owned with quantity > 0
  card_count      integer         NOT NULL DEFAULT 0,

  -- Distinct sets with at least one owned card
  set_count       integer         NOT NULL DEFAULT 0,

  created_at      timestamptz     NOT NULL DEFAULT now(),

  -- One snapshot per user per calendar day
  CONSTRAINT collection_value_snapshots_user_date_key UNIQUE (user_id, snapshot_date)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
-- Primary lookup: history for a user ordered newest first
CREATE INDEX IF NOT EXISTS cvs_user_date_idx
  ON public.collection_value_snapshots (user_id, snapshot_date DESC);

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE public.collection_value_snapshots ENABLE ROW LEVEL SECURITY;

-- Users can read their own snapshots only
CREATE POLICY "Users can read own snapshots"
  ON public.collection_value_snapshots
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only the service role can write (snapshot endpoint uses supabaseAdmin)
CREATE POLICY "Service role manages snapshots"
  ON public.collection_value_snapshots
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── Comments ──────────────────────────────────────────────────────────────────
COMMENT ON TABLE public.collection_value_snapshots IS
  'Daily collection value snapshots for Pro users. One row per (user_id, snapshot_date). Written by /api/analytics/portfolio-snapshot or lazily by /api/analytics/portfolio-history on first visit of each day.';

COMMENT ON COLUMN public.collection_value_snapshots.total_value_eur IS
  'Sum of (item_prices.price × user_card_variants.quantity) for all owned cards with a known normal-variant EUR price from item_prices.';

COMMENT ON COLUMN public.collection_value_snapshots.snapshot_date IS
  'Calendar date (UTC) of the snapshot. Used as the unique key — only one snapshot per user per day.';

COMMENT ON COLUMN public.collection_value_snapshots.card_count IS
  'Count of distinct card_id values in user_card_variants where quantity > 0.';

COMMENT ON COLUMN public.collection_value_snapshots.set_count IS
  'Count of distinct set_id values across owned cards with quantity > 0.';
