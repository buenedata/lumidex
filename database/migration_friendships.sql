-- ============================================================
-- Lumidex — Friendships Migration
-- Adds: friendships table for the social / trading layer
-- Run once in Supabase SQL editor.
-- ============================================================
-- Friendships are directional (requester → addressee) but
-- the accepted state is treated as symmetric. The Friends tab
-- in the card modal queries accepted friendships to show which
-- friends own a particular card.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.friendships (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id  uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  addressee_id  uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status        text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- Prevent duplicate requests in the same direction
  CONSTRAINT friendships_pair_key UNIQUE (requester_id, addressee_id),
  -- Prevent self-friending
  CONSTRAINT friendships_no_self CHECK (requester_id != addressee_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
-- All requests sent by a user (outgoing)
CREATE INDEX IF NOT EXISTS friendships_requester_idx
  ON public.friendships (requester_id, status);

-- All requests received by a user (incoming)
CREATE INDEX IF NOT EXISTS friendships_addressee_idx
  ON public.friendships (addressee_id, status);

-- ── updated_at trigger ────────────────────────────────────────────────────────
CREATE TRIGGER handle_updated_at_friendships
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Users can see any friendship they are a party to (either side)
CREATE POLICY "friendships_parties_select"
  ON public.friendships FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Authenticated users can send a friend request (they must be the requester)
CREATE POLICY "friendships_requester_insert"
  ON public.friendships FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

-- Either party can update the status (accept / decline / block)
CREATE POLICY "friendships_parties_update"
  ON public.friendships FOR UPDATE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Either party can remove a friendship
CREATE POLICY "friendships_parties_delete"
  ON public.friendships FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Admins can manage all friendships
CREATE POLICY "friendships_admin_all"
  ON public.friendships FOR ALL
  USING (public.is_admin());

-- ── Helper view: accepted_friends ─────────────────────────────────────────────
-- Returns a denormalised list of (user_id, friend_id) pairs for accepted
-- friendships, symmetric — each accepted friendship appears in BOTH directions.
-- Used by the Friends tab API route.
CREATE OR REPLACE VIEW public.accepted_friends AS
  -- requester → addressee
  SELECT requester_id AS user_id, addressee_id AS friend_id
  FROM   public.friendships
  WHERE  status = 'accepted'
  UNION ALL
  -- addressee → requester (symmetric)
  SELECT addressee_id AS user_id, requester_id AS friend_id
  FROM   public.friendships
  WHERE  status = 'accepted';
