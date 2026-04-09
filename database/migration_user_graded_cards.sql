-- ============================================================
-- Lumidex — User Graded Cards Migration
-- Adds: user_graded_cards table
--
-- Stores graded copies of cards in a user's collection.
-- A graded card is one that has been submitted to a third-party
-- grading company (PSA, Beckett, CGC, TAG, ACE) and returned
-- in a sealed case with an official grade label.
--
-- Separate from user_card_variants because:
--   - Grade is a text label (e.g. "GEM-MT 10", "Black Label 10")
--   - Grading company adds a second key dimension
--   - These are conceptually distinct from raw card copies
--
-- Run once in Supabase SQL editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_graded_cards (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owner
  user_id          uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- The base card being graded
  card_id          uuid        NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,

  -- Which variant of the card was graded (e.g. Holofoil, Reverse Holo).
  -- NULL means the variant is unknown or the user didn't specify.
  variant_id       uuid        REFERENCES public.variants(id) ON DELETE SET NULL,

  -- Grading company
  grading_company  text        NOT NULL
                     CHECK (grading_company IN ('PSA', 'BECKETT', 'CGC', 'TAG', 'ACE')),

  -- Grade label as issued by the grading company.
  -- Stored as text to handle all edge-cases:
  --   PSA:     "GEM-MT 10", "MINT 9", "NM-MT 8", etc.
  --   BECKETT: "Black Label 10", "Pristine 10", "Gem Mint 9.5", etc.
  --   CGC:     "Pristine 10", "Gem Mint 10", "Mint+ 9.5", etc.
  --   TAG:     "GEM MINT 10", "Pristine 10", "MINT 9", etc.
  --   ACE:     "GEM MINT 10", "MINT 9", "NM-MT 8", etc.
  grade            text        NOT NULL,

  -- Number of copies at this company/grade combination.
  -- Rows with quantity = 0 are deleted rather than stored.
  quantity         integer     NOT NULL DEFAULT 1
                     CHECK (quantity >= 1),

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  -- One row per (user, card, variant, company, grade) combination.
  -- variant_id is included in the unique key so the same card graded
  -- in two different variants is stored as two rows.
  CONSTRAINT user_graded_cards_unique
    UNIQUE (user_id, card_id, variant_id, grading_company, grade)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS user_graded_cards_user_id_idx
  ON public.user_graded_cards (user_id);

CREATE INDEX IF NOT EXISTS user_graded_cards_card_id_idx
  ON public.user_graded_cards (card_id);

CREATE INDEX IF NOT EXISTS user_graded_cards_user_card_idx
  ON public.user_graded_cards (user_id, card_id);

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE public.user_graded_cards ENABLE ROW LEVEL SECURITY;

-- Users can view their own graded cards
CREATE POLICY "user_graded_cards_select_own"
  ON public.user_graded_cards FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own graded cards
CREATE POLICY "user_graded_cards_insert_own"
  ON public.user_graded_cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own graded cards
CREATE POLICY "user_graded_cards_update_own"
  ON public.user_graded_cards FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own graded cards
CREATE POLICY "user_graded_cards_delete_own"
  ON public.user_graded_cards FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can do anything
CREATE POLICY "user_graded_cards_admin_all"
  ON public.user_graded_cards FOR ALL
  USING (public.is_admin());
