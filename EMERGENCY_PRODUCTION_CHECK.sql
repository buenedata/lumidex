-- =====================================================
-- EMERGENCY PRODUCTION VERIFICATION
-- Check if we're in the right database and all pieces exist
-- =====================================================

-- 1. Verify we're in the correct Supabase project
SELECT 
  'Current Database Check' as test,
  current_database() as database_name,
  current_user as current_user,
  inet_server_addr() as server_ip;

-- 2. Check if wishlist_lists table exists AT ALL
SELECT 
  'Table Existence Check' as test,
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'wishlist_lists' 
    AND table_schema = 'public'
  ) as table_exists;

-- 3. If it exists, check basic access
SELECT 
  'Table Access Check' as test,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wishlist_lists') 
    THEN (SELECT count(*) FROM wishlist_lists)::text || ' records'
    ELSE 'TABLE DOES NOT EXIST'
  END as result;

-- 4. Check if the trigger function exists
SELECT 
  'Trigger Function Check' as test,
  EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_name = 'handle_new_user_default_wishlist'
    AND routine_schema = 'public'
  ) as function_exists;

-- 5. Check if trigger is attached to profiles table
SELECT 
  'Trigger Attachment Check' as test,
  EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'on_auth_user_created_default_wishlist'
    AND event_object_table = 'profiles'
  ) as trigger_attached;

-- 6. Test the EXACT operation that's failing
-- Simulate what happens when a new user profile is created
DO $$
DECLARE
    test_user_id UUID := gen_random_uuid();
    test_result TEXT;
BEGIN
    -- Try to insert a test profile (this should trigger the wishlist creation)
    BEGIN
        INSERT INTO profiles (
            id, 
            username, 
            display_name, 
            created_at, 
            updated_at
        ) VALUES (
            test_user_id,
            'test_user_' || extract(epoch from now()),
            'Test User',
            NOW(),
            NOW()
        );
        
        -- Check if wishlist was created
        IF EXISTS (SELECT 1 FROM wishlist_lists WHERE user_id = test_user_id) THEN
            test_result := 'SUCCESS: Profile and wishlist created successfully';
        ELSE
            test_result := 'PARTIAL: Profile created but NO wishlist found';
        END IF;
        
        -- Clean up test data
        DELETE FROM wishlist_lists WHERE user_id = test_user_id;
        DELETE FROM profiles WHERE id = test_user_id;
        
    EXCEPTION WHEN OTHERS THEN
        test_result := 'ERROR: ' || SQLERRM;
        -- Try to clean up anyway
        BEGIN
            DELETE FROM wishlist_lists WHERE user_id = test_user_id;
            DELETE FROM profiles WHERE id = test_user_id;
        EXCEPTION WHEN OTHERS THEN
            NULL; -- Ignore cleanup errors
        END;
    END;
    
    RAISE NOTICE 'Simulation Test Result: %', test_result;
END $$;

-- 7. Check RLS policies on wishlist_lists
SELECT 
  'RLS Policy Check' as test,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'wishlist_lists'
ORDER BY policyname;

-- 8. Final summary
SELECT 
  'SUMMARY' as test,
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wishlist_lists') 
    THEN '❌ CRITICAL: wishlist_lists table does not exist'
    WHEN NOT EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'handle_new_user_default_wishlist')
    THEN '❌ CRITICAL: trigger function does not exist'  
    WHEN NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created_default_wishlist')
    THEN '❌ CRITICAL: trigger not attached to profiles table'
    ELSE '✅ All components exist - check simulation results above'
  END as diagnosis;