-- ============================================================
-- Lumidex — Lists Public By Default Migration
-- Adds: lists_public_by_default column to users table
-- Run once in Supabase SQL editor.
-- ============================================================
-- Controls the default is_public value when a user creates a
-- new custom list.  Exposed in Settings and First Time Setup
-- under the Privacy section.
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS lists_public_by_default boolean NOT NULL DEFAULT false;
