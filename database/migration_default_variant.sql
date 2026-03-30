-- ============================================================
-- Migration: Add default_variant_id to cards table
-- Purpose: Stores which variant is added when a card tile is
--          double-clicked for quick-add.
-- Rules:
--   • Cards whose rarity implies holo-only availability
--     (Holo Rare, EX, V, VMAX, VSTAR, secret rares, etc.)
--     → default = Holo variant
--   • All other cards → default = Normal variant
-- ============================================================

-- 1. Add the column (idempotent)
ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS default_variant_id uuid
    REFERENCES public.variants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS cards_default_variant_idx
  ON public.cards(default_variant_id);

-- 2. Backfill: holo-type / EX / V / special rarity → Holo
UPDATE public.cards c
SET default_variant_id = v.id
FROM public.variants v
WHERE v.key = 'holo'
  AND c.default_variant_id IS NULL
  AND (
    c.rarity ILIKE '%holo%'
    OR c.rarity ILIKE '%ultra rare%'
    OR c.rarity ILIKE '%secret%'
    OR c.rarity ILIKE '% ex%'
    OR c.rarity ILIKE '% v%'
    OR c.name  ILIKE '% ex'
    OR c.name  ILIKE '% vmax'
    OR c.name  ILIKE '% vstar'
    OR c.name  ILIKE '% v'
  );

-- 3. Backfill: everything else → Normal
UPDATE public.cards c
SET default_variant_id = v.id
FROM public.variants v
WHERE v.key = 'normal'
  AND c.default_variant_id IS NULL;
