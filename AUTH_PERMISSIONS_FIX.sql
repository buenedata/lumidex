-- =====================================================
-- AUTH PERMISSIONS FIX
-- Grant proper permissions to auth system for wishlist_lists
-- =====================================================

-- 1. Check current table ownership and permissions
SELECT 
  schemaname,
  tablename,
  tableowner,
  hasindexes,
  hasrules,
  hastriggers
FROM pg_tables 
WHERE tablename = 'wishlist_lists';

-- 2. Check what roles exist
SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb 
FROM pg_roles 
WHERE rolname IN ('postgres', 'supabase_admin', 'authenticator', 'anon', 'authenticated', 'service_role')
ORDER BY rolname;

-- 3. Grant explicit permissions to all auth-related roles
GRANT ALL PRIVILEGES ON TABLE wishlist_lists TO postgres;
GRANT ALL PRIVILEGES ON TABLE wishlist_lists TO supabase_admin;
GRANT ALL PRIVILEGES ON TABLE wishlist_lists TO authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE wishlist_lists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE wishlist_lists TO service_role;

-- 4. Ensure the sequence is accessible (for UUID generation)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO anon;

-- 5. Grant permissions on the trigger function
GRANT EXECUTE ON FUNCTION handle_new_user_default_wishlist() TO postgres;
GRANT EXECUTE ON FUNCTION handle_new_user_default_wishlist() TO supabase_admin;
GRANT EXECUTE ON FUNCTION handle_new_user_default_wishlist() TO authenticator;
GRANT EXECUTE ON FUNCTION handle_new_user_default_wishlist() TO authenticated;
GRANT EXECUTE ON FUNCTION handle_new_user_default_wishlist() TO service_role;

-- 6. Ensure profiles table permissions (in case that's the issue)
GRANT ALL PRIVILEGES ON TABLE profiles TO postgres;
GRANT ALL PRIVILEGES ON TABLE profiles TO supabase_admin;
GRANT ALL PRIVILEGES ON TABLE profiles TO authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE profiles TO service_role;

-- 7. Test with the service_role context (simulating auth system)
SET ROLE service_role;

-- Try to access the table as service_role
SELECT 'Service Role Test' as test, 
       EXISTS(SELECT 1 FROM wishlist_lists LIMIT 1) as can_access_wishlist_lists,
       EXISTS(SELECT 1 FROM profiles LIMIT 1) as can_access_profiles;

RESET ROLE;

-- 8. Test trigger function execution permissions
DO $$
DECLARE
    test_user_id UUID := gen_random_uuid();
BEGIN
    -- Test if we can insert into profiles as different roles
    SET ROLE authenticated;
    
    -- This should work now
    INSERT INTO profiles (
        id, 
        username, 
        display_name, 
        created_at, 
        updated_at
    ) VALUES (
        test_user_id,
        'auth_test_' || extract(epoch from now()),
        'Auth Test User',
        NOW(),
        NOW()
    );
    
    -- Check if wishlist was created
    IF EXISTS (SELECT 1 FROM wishlist_lists WHERE user_id = test_user_id) THEN
        RAISE NOTICE '✅ SUCCESS: Auth role can create profiles and trigger wishlist creation';
    ELSE
        RAISE NOTICE '❌ FAILURE: Profile created but no wishlist found with auth role';
    END IF;
    
    -- Clean up
    DELETE FROM wishlist_lists WHERE user_id = test_user_id;
    DELETE FROM profiles WHERE id = test_user_id;
    
    RESET ROLE;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ ERROR with authenticated role: %', SQLERRM;
    RESET ROLE;
    -- Try to clean up anyway
    BEGIN
        DELETE FROM wishlist_lists WHERE user_id = test_user_id;
        DELETE FROM profiles WHERE id = test_user_id;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;
END $$;

-- 9. Final status check
SELECT 
  'PERMISSIONS STATUS' as test,
  has_table_privilege('authenticated', 'wishlist_lists', 'SELECT') as auth_can_select,
  has_table_privilege('authenticated', 'wishlist_lists', 'INSERT') as auth_can_insert,
  has_table_privilege('service_role', 'wishlist_lists', 'SELECT') as service_can_select,
  has_table_privilege('service_role', 'wishlist_lists', 'INSERT') as service_can_insert;