-- ============================================================
-- Lumidex — Auto-Friend Admin Migration
-- Adds: trigger that automatically creates an accepted friendship
--       between the admin account and every new user on registration.
-- Also backfills accepted friendships for all existing users.
-- Covers both registration paths:
--   • Email/password  → public.users INSERT via handle_new_confirmed_user()
--   • OAuth           → public.users INSERT via app/auth/callback/route.ts
-- Run once in Supabase SQL editor.
-- ============================================================

-- ── Trigger function ─────────────────────────────────────────────────────────
-- Fires AFTER INSERT on public.users.
-- Looks up the admin (role = 'admin') and creates an accepted friendship.
-- SECURITY DEFINER is required because the friendships_requester_insert RLS
-- policy checks auth.uid() = requester_id, which is null in a trigger context.
-- SET search_path = public is a security best practice for SECURITY DEFINER fns.
CREATE OR REPLACE FUNCTION public.handle_new_user_admin_friendship()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
BEGIN
  -- Find the primary admin account
  SELECT id INTO v_admin_id
  FROM public.users
  WHERE role = 'admin'
  LIMIT 1;

  -- Skip if no admin account exists yet (e.g. fresh database before first admin)
  -- or if the new user IS the admin (avoid self-friendship)
  IF v_admin_id IS NULL OR v_admin_id = NEW.id THEN
    RETURN NEW;
  END IF;

  -- Insert an accepted friendship: admin as requester, new user as addressee.
  -- ON CONFLICT DO NOTHING makes this idempotent — safe to re-run or replay.
  INSERT INTO public.friendships (requester_id, addressee_id, status)
  VALUES (v_admin_id, NEW.id, 'accepted')
  ON CONFLICT (requester_id, addressee_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ── Trigger ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE TRIGGER handle_new_user_admin_friendship
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_admin_friendship();

-- ── Backfill: existing users ──────────────────────────────────────────────────
-- Creates accepted friendships between the admin and every existing user who
-- does not already have one. Uses ON CONFLICT DO NOTHING so it is safe to
-- re-run without creating duplicates.
DO $$
DECLARE
  v_admin_id uuid;
BEGIN
  SELECT id INTO v_admin_id
  FROM public.users
  WHERE role = 'admin'
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE NOTICE 'No admin account found — skipping backfill.';
    RETURN;
  END IF;

  INSERT INTO public.friendships (requester_id, addressee_id, status)
  SELECT v_admin_id, u.id, 'accepted'
  FROM public.users u
  WHERE u.id <> v_admin_id
    AND NOT EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE (f.requester_id = v_admin_id AND f.addressee_id = u.id)
         OR (f.requester_id = u.id       AND f.addressee_id = v_admin_id)
    )
  ON CONFLICT (requester_id, addressee_id) DO NOTHING;

  RAISE NOTICE 'Backfill complete — admin friendship rows inserted for all existing users.';
END;
$$;
