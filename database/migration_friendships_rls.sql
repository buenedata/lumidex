-- ============================================================
-- Lumidex — Friendships RLS Supplement
-- Adds policies so accepted friends can view each other's
-- user_sets and user_card_variants (needed for profile page
-- set/progress display when visiting a friend's profile).
-- Run AFTER migration_friendships.sql
-- ============================================================

-- ── user_sets: accepted friends can SELECT ────────────────────────────────────
CREATE POLICY "Friends can view each other's sets"
  ON public.user_sets FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.accepted_friends af
      WHERE af.user_id  = auth.uid()
        AND af.friend_id = user_sets.user_id
    )
  );

-- ── user_card_variants: accepted friends can SELECT (for card counts / progress) ─
CREATE POLICY "Friends can view each other's card variants"
  ON public.user_card_variants FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.accepted_friends af
      WHERE af.user_id   = auth.uid()
        AND af.friend_id = user_card_variants.user_id
    )
  );

-- ── INDEX: speed up accepted_friends lookups in RLS ────────────────────────────
-- (Only needed once; safe to re-run thanks to IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS friendships_accepted_requester_idx
  ON public.friendships (requester_id) WHERE status = 'accepted';

CREATE INDEX IF NOT EXISTS friendships_accepted_addressee_idx
  ON public.friendships (addressee_id) WHERE status = 'accepted';
