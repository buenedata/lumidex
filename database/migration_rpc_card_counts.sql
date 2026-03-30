-- ============================================================
-- Migration: Supabase RPC — get_user_card_counts_by_set
-- Purpose : Aggregate distinct owned card counts per set in
--           Postgres instead of pulling all user_card_variants
--           rows into Node.js and aggregating in JS.
--
-- Before : SELECT card_id, quantity, cards(set_id) ... → N rows
-- After  : RPC returns one row per set  → ~150 rows max
--
-- Run in: Supabase SQL Editor (or supabase db push)
-- ============================================================

create or replace function get_user_card_counts_by_set(p_user_id uuid)
returns table(set_id text, card_count bigint)
language sql
stable
security definer
as $$
  select
    c.set_id,
    count(distinct ucv.card_id) as card_count
  from user_card_variants ucv
  join cards c on ucv.card_id = c.id
  where ucv.user_id = p_user_id
    and ucv.quantity > 0
  group by c.set_id;
$$;

-- Grant execute to the anon and authenticated roles so the
-- Supabase client (using the anon/publishable key) can call it.
grant execute on function get_user_card_counts_by_set(uuid) to anon, authenticated;
