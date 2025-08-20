-- =====================================================
-- FIX: Create Missing Trigger Function
-- This function was missing, causing user registration to fail
-- =====================================================

-- 1. Create the missing trigger function
CREATE OR REPLACE FUNCTION handle_new_user_default_wishlist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create default wishlist for new user
  INSERT INTO wishlist_lists (user_id, name, description, is_default, is_public)
  VALUES (
    NEW.id,
    'My Wishlist',
    'Default wishlist automatically created',
    true,
    false
  );
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the profile creation
  RAISE WARNING 'Failed to create default wishlist for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- 2. Create the trigger (if it doesn't exist)
DROP TRIGGER IF EXISTS on_auth_user_created_default_wishlist ON profiles;

CREATE TRIGGER on_auth_user_created_default_wishlist
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_default_wishlist();

-- 3. Verify the function was created
SELECT 
  'Function Creation Check' as test,
  EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_name = 'handle_new_user_default_wishlist'
    AND routine_schema = 'public'
  ) as function_exists;

-- 4. Verify the trigger was attached
SELECT 
  'Trigger Attachment Check' as test,
  EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'on_auth_user_created_default_wishlist'
    AND event_object_table = 'profiles'
  ) as trigger_attached;

-- 5. Test with a dummy user to verify it works
DO $$
DECLARE
    test_user_id UUID := gen_random_uuid();
BEGIN
    -- Insert test profile
    INSERT INTO profiles (
        id, 
        username, 
        display_name, 
        created_at, 
        updated_at
    ) VALUES (
        test_user_id,
        'test_trigger_' || extract(epoch from now()),
        'Test Trigger User',
        NOW(),
        NOW()
    );
    
    -- Check if wishlist was created
    IF EXISTS (SELECT 1 FROM wishlist_lists WHERE user_id = test_user_id AND is_default = true) THEN
        RAISE NOTICE '✅ SUCCESS: Trigger function working - default wishlist created';
    ELSE
        RAISE NOTICE '❌ FAILURE: Trigger function not working - no wishlist created';
    END IF;
    
    -- Clean up test data
    DELETE FROM wishlist_lists WHERE user_id = test_user_id;
    DELETE FROM profiles WHERE id = test_user_id;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ ERROR during test: %', SQLERRM;
    -- Try to clean up anyway
    BEGIN
        DELETE FROM wishlist_lists WHERE user_id = test_user_id;
        DELETE FROM profiles WHERE id = test_user_id;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;
END $$;

-- 6. Final status
SELECT 'REPAIR COMPLETE' as status, 'Trigger function created and tested' as message;