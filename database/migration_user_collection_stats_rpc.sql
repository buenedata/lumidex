-- Migration: get_user_collection_stats RPC
--
-- Returns two accurate DB-side aggregates for a user's collection:
--   total_quantity  – SUM of all quantity values across every variant row
--   distinct_cards  – COUNT of distinct card_id values (regardless of quantity or variant count)
--
-- Why an RPC instead of a client-side sum?
-- PostgREST's max_rows setting (default 1 000) silently caps plain .select() fetches,
-- which caused the dashboard to show truncated totals when a user owns more than 1 000
-- variant rows. A SECURITY DEFINER set-returning function bypasses that cap because the
-- result is a single aggregated row, not a raw table scan.

CREATE OR REPLACE FUNCTION get_user_collection_stats(p_user_id uuid)
RETURNS TABLE (
  total_quantity bigint,
  distinct_cards bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(quantity), 0)::bigint  AS total_quantity,
    COUNT(DISTINCT card_id)::bigint     AS distinct_cards
  FROM user_card_variants
  WHERE user_id = p_user_id
    AND quantity > 0;
$$;

-- Allow all authenticated users to execute this function
GRANT EXECUTE ON FUNCTION get_user_collection_stats(uuid) TO authenticated;
