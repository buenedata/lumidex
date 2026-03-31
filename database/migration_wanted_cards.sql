-- ============================================================
-- Lumidex — Wanted Cards Migration
-- Adds: wanted_cards table for user wishlist / wanted list
-- Run once in Supabase SQL editor.
-- ============================================================
-- Users can mark cards they want to acquire. This powers the
-- ★ star icon in the card detail modal and forms the foundation
-- for the upcoming trading / trade-matching feature.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.wanted_cards (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES public.users(id)  ON DELETE CASCADE,
  card_id    uuid        NOT NULL REFERENCES public.cards(id)  ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Each user can only want a given card once
  CONSTRAINT wanted_cards_user_card_key UNIQUE (user_id, card_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
-- All wanted cards for a user (My Wanted List page)
CREATE INDEX IF NOT EXISTS wanted_cards_user_id_idx
  ON public.wanted_cards (user_id);

-- All users who want a card (for trade-matching)
CREATE INDEX IF NOT EXISTS wanted_cards_card_id_idx
  ON public.wanted_cards (card_id);

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE public.wanted_cards ENABLE ROW LEVEL SECURITY;

-- Users can see their own wanted list
CREATE POLICY "wanted_cards_owner_select"
  ON public.wanted_cards FOR SELECT
  USING (auth.uid() = user_id);

-- Users can add cards to their own wanted list
CREATE POLICY "wanted_cards_owner_insert"
  ON public.wanted_cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can remove cards from their own wanted list
CREATE POLICY "wanted_cards_owner_delete"
  ON public.wanted_cards FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can manage any wanted list
CREATE POLICY "wanted_cards_admin_all"
  ON public.wanted_cards FOR ALL
  USING (public.is_admin());
