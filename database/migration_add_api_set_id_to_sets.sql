-- ============================================================
-- Migration: add api_set_id to sets
-- Stores the tcggo.com RapidAPI episode ID (integer as text)
-- so the nightly cron can automatically re-sync product prices
-- without requiring the admin to re-enter it each time.
-- ============================================================

alter table public.sets
  add column if not exists api_set_id text;

comment on column public.sets.api_set_id is
  'tcggo.com / cardmarket-api-tcg RapidAPI episode ID (integer stored as text). '
  'Used by importProductPricing to sync sealed-product price data.';
