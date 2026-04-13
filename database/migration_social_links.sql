-- Lumidex — Social Links Migration
-- Adds three nullable text columns to the users table so users can
-- optionally link their Cardmarket profile, Instagram and Facebook accounts.
-- Run once in Supabase SQL editor.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS social_cardmarket  text,
  ADD COLUMN IF NOT EXISTS social_instagram   text,
  ADD COLUMN IF NOT EXISTS social_facebook    text;
