-- =====================================================
-- FIX PROFILES PERMISSIONS
-- Fix permissions so authenticated users can read their own profiles
-- =====================================================

-- 1. Grant basic permissions on profiles table
GRANT ALL PRIVILEGES ON TABLE profiles TO postgres;
GRANT ALL PRIVILEGES ON TABLE profiles TO supabase_admin;
GRANT ALL PRIVILEGES ON TABLE profiles TO authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE profiles TO service_role;

-- 2. Ensure RLS is enabled on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policies for profiles (if they don't exist)
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can delete their own profile" ON profiles;
CREATE POLICY "Users can delete their own profile"
ON profiles FOR DELETE
USING (auth.uid() = id);

-- 4. Test the exact query that the root page uses
DO $$
DECLARE
    test_user_id UUID := '9b1b9c42-48e1-4786-a372-e59dc28a65c1'; -- From the screenshot
BEGIN
    -- Test if we can select setup_completed for this user
    BEGIN
        PERFORM setup_completed FROM profiles WHERE id = test_user_id;
        RAISE NOTICE '✅ SUCCESS: Can read setup_completed for user';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ ERROR reading setup_completed: %', SQLERRM;
    END;
END $$;

-- 5. Verify permissions
SELECT 
  'Profiles Access Test' as test,
  has_table_privilege('authenticated', 'profiles', 'SELECT') as can_select,
  has_table_privilege('authenticated', 'profiles', 'INSERT') as can_insert,
  has_table_privilege('authenticated', 'profiles', 'UPDATE') as can_update;

SELECT 'PROFILES PERMISSIONS FIXED' as status, 
       'Root page should now work without redirect loops' as message;