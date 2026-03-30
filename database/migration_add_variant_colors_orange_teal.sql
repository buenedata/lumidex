-- ============================================================
-- Migration: Add orange and teal to variants color check constraint
-- Run this in the Supabase SQL editor
-- ============================================================

-- Drop the existing check constraint (name may vary — check with:
--   SELECT conname FROM pg_constraint WHERE conrelid = 'public.variants'::regclass AND contype = 'c';
-- The most common name is variants_color_check)
ALTER TABLE public.variants
  DROP CONSTRAINT IF EXISTS variants_color_check;

-- Recreate with the expanded color list
ALTER TABLE public.variants
  ADD CONSTRAINT variants_color_check
    CHECK (color IN ('green', 'blue', 'purple', 'red', 'pink', 'yellow', 'gray', 'orange', 'teal'));
