-- Migration: get_set_image_stats RPC
-- Returns per-set image coverage: total cards and how many have a non-null image.
-- Used by the admin card-image upload tool to show ✅ / ⚠️ / ❌ beside each set.
--
-- Run this once in your Supabase SQL editor or via CLI:
--   supabase db push

CREATE OR REPLACE FUNCTION get_set_image_stats()
RETURNS TABLE (
  set_id         TEXT,
  total_cards    BIGINT,
  cards_with_images BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    set_id,
    COUNT(*)       AS total_cards,
    COUNT(image)   AS cards_with_images   -- COUNT ignores NULLs
  FROM cards
  GROUP BY set_id;
$$;
