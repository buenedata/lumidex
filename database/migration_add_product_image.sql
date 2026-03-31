-- ============================================================
-- Migration: add image_url to set_products
-- Adds an image URL column so admins can attach a product image
-- (e.g. booster box art) to each sealed product row.
-- Run once in Supabase SQL editor.
-- ============================================================

ALTER TABLE public.set_products
  ADD COLUMN IF NOT EXISTS image_url text;
