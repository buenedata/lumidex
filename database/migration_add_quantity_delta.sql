-- ============================================================
-- Migration: add quantity_delta to user_card_variants
-- Stores the signed integer change from the last upsert so the
-- Last Activity section can show ↑ (increase) or ↓ (decrease).
-- NULL means the row predates this column or was set by the RPC.
-- Run once in the Supabase SQL editor.
-- ============================================================

ALTER TABLE public.user_card_variants
  ADD COLUMN IF NOT EXISTS quantity_delta integer;
