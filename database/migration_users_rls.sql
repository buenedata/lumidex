-- ============================================================
-- Lumidex — Users Table RLS Policy
-- Allows any authenticated user to read any profile row.
-- Without this policy, the client-side supabase instance
-- (which is subject to RLS) cannot read other users' rows,
-- causing the "User not found" error on profile pages.
--
-- Run once in Supabase SQL editor.
-- ============================================================

-- Enable RLS on users table if not already enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Allow any authenticated user to read any profile
CREATE POLICY "Authenticated users can view any profile"
  ON public.users FOR SELECT
  USING (auth.role() = 'authenticated');

-- Users can only update their own profile
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- Users can only insert their own profile row
CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);
