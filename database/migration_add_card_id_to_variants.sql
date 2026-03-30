-- Migration: add card_id to variants
-- Allows a variant to be scoped to a single card instead of being global.
--
-- A variant with card_id IS NULL  → global variant  (existing behaviour, unchanged)
-- A variant with card_id NOT NULL → card-specific variant (only applies to that card)
--
-- Run this in the Supabase SQL Editor.

ALTER TABLE public.variants
  ADD COLUMN IF NOT EXISTS card_id uuid REFERENCES public.cards(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_variants_card_id ON public.variants(card_id);

-- Comment to document the intent
COMMENT ON COLUMN public.variants.card_id IS
  'When set, this variant is scoped exclusively to the referenced card. '
  'NULL means the variant is a global catalog entry available to all cards.';
