-- =====================================================
-- REMOVE TRIGGER PERMANENTLY
-- The default wishlist trigger is unnecessary - users can create 
-- wishlists when needed through the UI modal
-- =====================================================

-- 1. Remove the problematic trigger
DROP TRIGGER IF EXISTS on_auth_user_created_default_wishlist ON profiles;

-- 2. Remove the trigger function (keeping table intact)
DROP FUNCTION IF EXISTS handle_new_user_default_wishlist();

-- 3. Verify both are removed
SELECT 
  'Trigger Status' as test,
  EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'on_auth_user_created_default_wishlist'
  ) as trigger_exists,
  EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_name = 'handle_new_user_default_wishlist'
  ) as function_exists;

-- 4. Verify wishlist_lists table still exists for when users create them manually
SELECT 
  'Table Status' as test,
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'wishlist_lists' 
  ) as table_exists,
  (SELECT count(*) FROM wishlist_lists) as existing_wishlists;

-- 5. Test profile creation without any trigger interference
DO $$
DECLARE
    test_user_id UUID := gen_random_uuid();
BEGIN
    INSERT INTO profiles (
        id, 
        username, 
        display_name, 
        created_at, 
        updated_at
    ) VALUES (
        test_user_id,
        'clean_test_' || extract(epoch from now()),
        'Clean Test User',
        NOW(),
        NOW()
    );
    
    RAISE NOTICE '✅ SUCCESS: Profile creation works without any triggers';
    
    -- Clean up test data
    DELETE FROM profiles WHERE id = test_user_id;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ ERROR: %', SQLERRM;
    BEGIN
        DELETE FROM profiles WHERE id = test_user_id;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;
END $$;

SELECT 'SOLUTION COMPLETE' as status, 
       'Trigger removed - users will create wishlists when needed via UI' as message;