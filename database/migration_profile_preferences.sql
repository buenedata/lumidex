-- ============================================================
-- Lumidex – Profile Preferences Migration
-- Adds display_name, banner_url, bio, location, setup_completed
-- and all user preference columns to the users table.
-- Run once in Supabase SQL editor.
-- ============================================================

-- ── New columns on users ─────────────────────────────────────

alter table public.users
  add column if not exists display_name          text,
  add column if not exists banner_url            text,
  add column if not exists bio                   text,
  add column if not exists location              text,
  add column if not exists setup_completed       boolean not null default false,
  add column if not exists preferred_language    text    not null default 'en',
  add column if not exists preferred_currency    text    not null default 'USD',
  add column if not exists price_source          text    not null default 'tcgplayer',
  add column if not exists grey_out_unowned      boolean not null default true,
  add column if not exists profile_private       boolean not null default false,
  add column if not exists show_portfolio_value  text    not null default 'public';

-- ── Optional: add check constraints for enum-like columns ────

-- price_source must be one of two values
alter table public.users
  drop constraint if exists users_price_source_check;
alter table public.users
  add constraint users_price_source_check
    check (price_source in ('tcgplayer', 'cardmarket'));

-- show_portfolio_value must be one of three values
alter table public.users
  drop constraint if exists users_show_portfolio_value_check;
alter table public.users
  add constraint users_show_portfolio_value_check
    check (show_portfolio_value in ('public', 'friends_only', 'private'));

-- ── Update schema.sql comment (informational) ────────────────
-- Remember to sync database/schema.sql after running this.
