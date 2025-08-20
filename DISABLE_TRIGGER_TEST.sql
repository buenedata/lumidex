-- =====================================================
-- DISABLE TRIGGER TEST
-- Temporarily disable the wishlist trigger to test basic registration
-- =====================================================

-- 1. Disable the trigger temporarily
DROP TRIGGER IF EXISTS on_auth_user_created_default_wishlist ON profiles;

-- 2. Verify trigger is removed
SELECT 
  'Trigger Status' as test,
  EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'on_auth_user_created_default_wishlist'
    AND event_object_table = 'profiles'
  ) as trigger_exists;

-- 3. Check if we can insert a test profile without trigger
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
        'no_trigger_test_' || extract(epoch from now()),
        'No Trigger Test User',
        NOW(),
        NOW()
    );
    
    RAISE NOTICE '✅ SUCCESS: Profile insertion works without trigger';
    
    -- Clean up test data
    DELETE FROM profiles WHERE id = test_user_id;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ ERROR even without trigger: %', SQLERRM;
    -- Try to clean up anyway
    BEGIN
        DELETE FROM profiles WHERE id = test_user_id;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;
END $$;

SELECT 'TEST COMPLETE' as status, 'Trigger disabled - test basic registration now' as message;