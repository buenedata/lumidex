# Security: RLS & Access Control Fixes

## Context

Supabase Security Advisor flagged 9 critical issues. All stem from tables in `public` schema missing `ENABLE ROW LEVEL SECURITY` or missing specific operation policies.

## Issues to Fix

| Table / Object | Issue | Fix |
|---|---|---|
| `public.cards` | RLS disabled, no policies | Enable RLS + public SELECT + admin write |
| `public.user_cards` | RLS disabled, only UPDATE policy exists | Enable RLS + add SELECT, INSERT, DELETE policies |
| `public.user_sets` | RLS disabled, only SELECT policy exists | Enable RLS + add INSERT, UPDATE, DELETE policies |
| `public.ebay_oauth_tokens` | RLS disabled + sensitive columns exposed | Enable RLS, no policies (service role only) |
| `public.ebay_webhooks` | RLS disabled | Enable RLS, no policies (service role only) |
| `public.accepted_friends` | Security Definer View | Recreate with `security_invoker = true` |

## Migration File to Create

**File:** `database/migration_security_rls_fixes.sql`

```sql
-- ============================================================
-- Lumidex — Security: Enable RLS & fix access control gaps
-- Resolves all CRITICAL findings from the Supabase Security Advisor.
-- Run once in Supabase SQL editor.
-- ============================================================

-- ── 1. public.cards ───────────────────────────────────────────────────────────
-- Pokemon card reference data — public read, admin write only.
-- All writes go through supabaseAdmin (service role, bypasses RLS),
-- but the policies below explicitly document the intent and block
-- PostgREST writes from anon/authenticated roles.

ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Anyone can view cards"
  ON public.cards FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Admins can manage cards"
  ON public.cards FOR ALL USING (public.is_admin());


-- ── 2. public.user_cards ─────────────────────────────────────────────────────
-- Legacy collection table. Already has an UPDATE policy in schema.sql
-- but RLS was never enabled so the policy was silently ignored.
-- Adding the missing SELECT / INSERT / DELETE policies.

ALTER TABLE public.user_cards ENABLE ROW LEVEL SECURITY;

-- Existing policy (already in schema.sql):
--   "Users can update their own cards." — keep as-is

CREATE POLICY IF NOT EXISTS "Users can view their own cards"
  ON public.user_cards FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert their own cards"
  ON public.user_cards FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete their own cards"
  ON public.user_cards FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Admins can manage all user_cards"
  ON public.user_cards FOR ALL USING (public.is_admin());


-- ── 3. public.user_sets ───────────────────────────────────────────────────────
-- Tracks which sets each user is collecting.
-- Already has SELECT policy in schema.sql but RLS was never enabled.
-- Adding missing INSERT / UPDATE / DELETE policies.

ALTER TABLE public.user_sets ENABLE ROW LEVEL SECURITY;

-- Existing policy (already in schema.sql):
--   "Authenticated users can view any user's sets" — keep as-is

CREATE POLICY IF NOT EXISTS "Users can insert their own sets"
  ON public.user_sets FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update their own sets"
  ON public.user_sets FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete their own sets"
  ON public.user_sets FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Admins can manage all user_sets"
  ON public.user_sets FOR ALL USING (public.is_admin());


-- ── 4. public.ebay_oauth_tokens ───────────────────────────────────────────────
-- Stores sensitive eBay client-credentials OAuth token.
-- ONLY accessed via supabaseAdmin (service role) in server-side API routes.
-- Enabling RLS with NO policies means anon + authenticated roles are blocked
-- via PostgREST. Service role always bypasses RLS.

ALTER TABLE public.ebay_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- No policies — intentional. Service role only.


-- ── 5. public.ebay_webhooks ───────────────────────────────────────────────────
-- Stores raw eBay notification payloads.
-- ONLY written via supabaseAdmin in the webhook handler API route.
-- Same pattern as ebay_oauth_tokens — service role only, no PostgREST access.

ALTER TABLE public.ebay_webhooks ENABLE ROW LEVEL SECURITY;

-- No policies — intentional. Service role only.


-- ── 6. public.accepted_friends view ──────────────────────────────────────────
-- Recreate with security_invoker = true so the view respects the calling
-- user's RLS context rather than running as the view owner (postgres).
-- The underlying friendships table has proper RLS (friendships_parties_select),
-- so security_invoker correctly limits each user to their own friendships.
-- The RLS policies on user_sets and user_card_variants that reference this
-- view continue to work correctly after this change.

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
```

## How to Apply

1. Open **Supabase Dashboard → SQL Editor**
2. Paste the full SQL above and click **Run**
3. Go to **Security Advisor** and refresh — all 6 CRITICAL items should be resolved
4. Test the app — login, view collection, add/remove sets, friend features

## Important Notes

- `CREATE POLICY IF NOT EXISTS` is safe to re-run — won't duplicate existing policies
- `ebay_oauth_tokens` and `ebay_webhooks` intentionally have NO policies — the service role (`supabaseAdmin`) bypasses RLS and can still read/write them. Anon/authenticated PostgREST access is correctly blocked.
- The `accepted_friends` view change requires Postgres 15+ (Supabase Pro is on PG15+)
- After enabling RLS on `user_cards` and `user_sets`, existing app behaviour is unchanged — the code already uses `supabaseAdmin` for admin writes and `supabase` (authenticated client) for user operations matching the new policies

## Verification Queries (run after migration)

```sql
-- Confirm RLS is enabled on all target tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('cards','user_cards','user_sets','ebay_oauth_tokens','ebay_webhooks');
-- Expected: rowsecurity = true for all 5

-- Confirm accepted_friends is now security_invoker
SELECT viewname, definition
FROM pg_views
WHERE schemaname = 'public' AND viewname = 'accepted_friends';
```
