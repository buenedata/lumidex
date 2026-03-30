-- ============================================================
-- Migration: Collection Goal for user_sets
-- Run this once in the Supabase SQL editor (safe to re-run).
-- ============================================================

-- 1. Add collection_goal column to user_sets
--    Defaults to 'normal' for all existing rows.
ALTER TABLE public.user_sets
  ADD COLUMN IF NOT EXISTS collection_goal text NOT NULL DEFAULT 'normal'
  CHECK (collection_goal IN ('normal', 'masterset', 'grandmasterset'));

-- 2. Add a unique constraint on (user_id, set_id) so that the PATCH
--    endpoint can use ON CONFLICT DO UPDATE (upsert) correctly.
--    Without this constraint, Supabase/PostgREST cannot resolve conflicts.
ALTER TABLE public.user_sets
  DROP CONSTRAINT IF EXISTS user_sets_user_id_set_id_key;

ALTER TABLE public.user_sets
  ADD CONSTRAINT user_sets_user_id_set_id_key UNIQUE (user_id, set_id);

-- 3. Optional: index for filtering by goal type
CREATE INDEX IF NOT EXISTS user_sets_collection_goal_idx
  ON public.user_sets (collection_goal);

-- ============================================================
-- Summary of changes
-- ============================================================
-- user_sets
--   + collection_goal  text  NOT NULL  DEFAULT 'normal'
--                      CHECK IN ('normal','masterset','grandmasterset')
--   + UNIQUE (user_id, set_id)   ← required for upsert in PATCH /api/user-sets
-- ============================================================
