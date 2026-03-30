-- Migration: add language column to sets table
-- 'en' = English (default — all existing sets are English)
-- 'ja' = Japanese (for future Japanese set imports)
--
-- Run this once against your Supabase database.

ALTER TABLE public.sets
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';
