-- ============================================================
-- Lumidex — Security: Enable RLS & fix access control gaps
-- Resolves all CRITICAL findings from the Supabase Security Advisor.
-- Run once in Supabase SQL editor.
-- ============================================================


-- ── 1. public.cards ───────────────────────────────────────────────────────────
-- Pokemon card reference data — public read, admin write only.
-- All writes go through supabaseAdmin (service role, bypasses RLS),
-- but the policies below block PostgREST writes from anon/authenticated roles.

ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'cards' AND policyname = 'Anyone can view cards'
  ) THEN
    CREATE POLICY "Anyone can view cards"
      ON public.cards FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'cards' AND policyname = 'Admins can manage cards'
  ) THEN
    CREATE POLICY "Admins can manage cards"
      ON public.cards FOR ALL USING (public.is_admin());
  END IF;
END $$;


-- ── 2. public.user_cards ─────────────────────────────────────────────────────
-- Legacy collection table. Already has an UPDATE policy in schema.sql
-- but RLS was never enabled so the policy was silently ignored.
-- Adding the missing SELECT / INSERT / DELETE policies.

ALTER TABLE public.user_cards ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_cards' AND policyname = 'Users can view their own cards'
  ) THEN
    CREATE POLICY "Users can view their own cards"
      ON public.user_cards FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_cards' AND policyname = 'Users can insert their own cards'
  ) THEN
    CREATE POLICY "Users can insert their own cards"
      ON public.user_cards FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_cards' AND policyname = 'Users can delete their own cards'
  ) THEN
    CREATE POLICY "Users can delete their own cards"
      ON public.user_cards FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_cards' AND policyname = 'Admins can manage all user_cards'
  ) THEN
    CREATE POLICY "Admins can manage all user_cards"
      ON public.user_cards FOR ALL USING (public.is_admin());
  END IF;
END $$;


-- ── 3. public.user_sets ───────────────────────────────────────────────────────
-- Tracks which sets each user is collecting.
-- Already has SELECT policy in schema.sql but RLS was never enabled.
-- Adding missing INSERT / UPDATE / DELETE policies.

ALTER TABLE public.user_sets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_sets' AND policyname = 'Users can insert their own sets'
  ) THEN
    CREATE POLICY "Users can insert their own sets"
      ON public.user_sets FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_sets' AND policyname = 'Users can update their own sets'
  ) THEN
    CREATE POLICY "Users can update their own sets"
      ON public.user_sets FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_sets' AND policyname = 'Users can delete their own sets'
  ) THEN
    CREATE POLICY "Users can delete their own sets"
      ON public.user_sets FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_sets' AND policyname = 'Admins can manage all user_sets'
  ) THEN
    CREATE POLICY "Admins can manage all user_sets"
      ON public.user_sets FOR ALL USING (public.is_admin());
  END IF;
END $$;


-- ── 4. public.ebay_oauth_tokens ───────────────────────────────────────────────
-- Stores sensitive eBay client-credentials OAuth token.
-- ONLY accessed via supabaseAdmin (service role) in server-side API routes.
-- Enabling RLS with NO policies blocks anon + authenticated PostgREST access.
-- Service role always bypasses RLS and retains full access.

ALTER TABLE public.ebay_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- No policies — intentional. Service role only.


-- ── 5. public.ebay_webhooks ───────────────────────────────────────────────────
-- Stores raw eBay notification payloads.
-- ONLY written via supabaseAdmin in the webhook handler API route.
-- Same pattern as ebay_oauth_tokens — service role only.

ALTER TABLE public.ebay_webhooks ENABLE ROW LEVEL SECURITY;

-- No policies — intentional. Service role only.


-- ── 6. public.accepted_friends view ──────────────────────────────────────────
-- Recreate with security_invoker = true so the view respects the calling
-- user's RLS context rather than running as the view owner (postgres).
-- The underlying friendships table has proper RLS (friendships_parties_select
-- policy: auth.uid() = requester_id OR auth.uid() = addressee_id), so
-- security_invoker correctly limits each user to their own friendships.
-- The RLS policies on user_sets and user_card_variants that reference this
-- view continue to work correctly after this change.
-- Requires Postgres 15+ (Supabase Pro is on PG15+).

CREATE OR REPLACE VIEW public.accepted_friends
  WITH (security_invoker = true) AS
  -- requester → addressee
  SELECT requester_id AS user_id, addressee_id AS friend_id
  FROM   public.friendships
  WHERE  status = 'accepted'
  UNION ALL
  -- addressee → requester (symmetric)
  SELECT addressee_id AS user_id, requester_id AS friend_id
  FROM   public.friendships
  WHERE  status = 'accepted';


-- ── Verification (optional — paste separately to confirm results) ─────────────
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN ('cards','user_cards','user_sets','ebay_oauth_tokens','ebay_webhooks');
-- Expected: rowsecurity = true for all 5 rows
