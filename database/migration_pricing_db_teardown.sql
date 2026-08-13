-- Migration: pricing_db_teardown
-- Purpose: Remove pricing-specific tables and columns after full pricing removal from application code.
-- Safe to run: application code no longer references item_prices, collection_value_snapshots,
--              or sets.prices_last_synced_at. Verified via npx next build (pass) post-removal.
-- Date: 2026-08-13

-- ── Drop item_prices table ────────────────────────────────────
-- RLS policies and indexes are handled by CASCADE.
DROP TABLE IF EXISTS public.item_prices CASCADE;

-- ── Drop collection_value_snapshots table ─────────────────────
DROP TABLE IF EXISTS public.collection_value_snapshots CASCADE;

-- ── Drop sets.prices_last_synced_at column ────────────────────
ALTER TABLE public.sets
DROP COLUMN IF EXISTS prices_last_synced_at;

-- NOTE: users.preferred_currency retained — still actively used by:
--   • app/browse/page.tsx      → reads preferred_currency from DB to set display currency
--   • components/profile/SettingsModal.tsx / FirstTimeSetupModal.tsx → writes it on profile save
--   • components/profile/SettingsForm.tsx  → renders currency picker UI control
--   • app/profile/[id]/page.tsx            → reads it from loaded user profile
