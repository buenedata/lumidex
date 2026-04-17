-- ============================================================
-- Migration: Artist card counts RPC
-- Replaces JS-side aggregation over a limited card sample with a
-- single SQL GROUP BY query, giving accurate per-artist card counts.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_artist_card_counts(
  p_search TEXT DEFAULT NULL,
  p_limit  INT  DEFAULT 1000
)
RETURNS TABLE(
  name          TEXT,
  card_count    BIGINT,
  sample_images TEXT[]
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.artist                                                         AS name,
    COUNT(*)                                                         AS card_count,
    -- Collect up to 3 non-null image URLs for the artist thumbnail strip.
    -- ORDER BY (image IS NULL) ASC puts non-null rows first.
    ARRAY_REMOVE(
      (ARRAY_AGG(c.image ORDER BY (c.image IS NULL) ASC, c.created_at DESC))[1:3],
      NULL
    )                                                                AS sample_images
  FROM public.cards c
  WHERE
    c.artist IS NOT NULL
    AND c.artist <> ''
    AND LOWER(TRIM(c.artist)) <> 'n/a'
    AND (p_search IS NULL OR c.artist ILIKE '%' || p_search || '%')
  GROUP BY c.artist
  ORDER BY card_count DESC
  LIMIT p_limit;
$$;

-- Allow the anon and authenticated roles to call this function.
GRANT EXECUTE ON FUNCTION public.get_artist_card_counts(TEXT, INT) TO anon, authenticated;
