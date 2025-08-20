-- Complete RLS Policy Fix for Profiles Table
-- Run these commands in your Supabase SQL Editor

-- 1. Enable RLS on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to start fresh
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- 3. Create comprehensive policies for all operations

-- Allow users to view their own profile
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT 
    USING (auth.uid() = id);

-- Allow users to insert their own profile (for new users)
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE 
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 4. Verify policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;

-- 5. Test that the banner_url column exists
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name IN ('avatar_url', 'banner_url')
ORDER BY column_name;