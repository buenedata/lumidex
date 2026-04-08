-- Migration: add cm_cosmos_holo to card_prices
--
-- Adds a dedicated CardMarket average-sell price column for the Cosmos Holo
-- variant. The pokemontcg.io API only returns one set of CardMarket prices
-- per card (the "standard" version), so Cosmos Holo prices cannot be fetched
-- automatically from that source and must be set manually via the admin UI.
--
-- Value is in EUR (matching all other cm_* price columns).
--
-- Run this in the Supabase SQL Editor.

ALTER TABLE public.card_prices
  ADD COLUMN IF NOT EXISTS cm_cosmos_holo numeric(10,2);
