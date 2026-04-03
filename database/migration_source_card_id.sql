-- ============================================================
-- Migration: add source_card_id to cards
-- Purpose: allows "reprint" cards (e.g. Prize Pack series) to
--          inherit their image from the original printing without
--          duplicating storage.  Collection tracking stays fully
--          independent because user_card_variants references
--          card.id, which is unique per DB row.
-- ============================================================

ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS source_card_id uuid
    REFERENCES public.cards(id)
    ON DELETE SET NULL;

COMMENT ON COLUMN public.cards.source_card_id IS
  'FK to the canonical/original card row for this printing. '
  'When set, display layers use COALESCE(own image, source image) '
  'so reprint sets (Prize Pack, etc.) show the right art without '
  're-uploading or duplicating the storage file.';

-- Index for the FK so the join is fast even with many cards
CREATE INDEX IF NOT EXISTS cards_source_card_id_idx
  ON public.cards (source_card_id)
  WHERE source_card_id IS NOT NULL;
