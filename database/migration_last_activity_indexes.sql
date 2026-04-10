-- ============================================================
-- Migration: last_activity_indexes
-- Adds composite (user_id, updated_at DESC) indexes on the two
-- tables queried by GET /api/users/[id]/last-activity so that
-- "most recently added/updated items" lookups are fast.
-- Run once in the Supabase SQL editor.
-- ============================================================

CREATE INDEX IF NOT EXISTS ucv_user_id_updated_at_idx
  ON public.user_card_variants (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS usp_user_id_updated_at_idx
  ON public.user_sealed_products (user_id, updated_at DESC);
