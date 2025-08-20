-- =====================================================
-- FINAL COMPLETE FIX - Ensure Everything Exists
-- This will recreate everything needed for user registration
-- =====================================================

-- 1. First, check if wishlist_lists actually exists
SELECT 
  'Table Check' as test,
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'wishlist_lists' 
    AND table_schema = 'public'
  ) as table_exists;

-- 2. Create wishlist_lists table if it doesn't exist
CREATE TABLE IF NOT EXISTS wishlist_lists (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- 3. Create updated_at trigger for wishlist_lists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_wishlist_lists_updated_at ON wishlist_lists;
CREATE TRIGGER update_wishlist_lists_updated_at
    BEFORE UPDATE ON wishlist_lists
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 4. Enable RLS on wishlist_lists
ALTER TABLE wishlist_lists ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for wishlist_lists
DROP POLICY IF EXISTS "Users can view their own wishlist_lists" ON wishlist_lists;
CREATE POLICY "Users can view their own wishlist_lists"
ON wishlist_lists FOR SELECT
USING (auth.uid() = user_id OR is_public = true);

DROP POLICY IF EXISTS "Users can insert their own wishlist_lists" ON wishlist_lists;
CREATE POLICY "Users can insert their own wishlist_lists"
ON wishlist_lists FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own wishlist_lists" ON wishlist_lists;
CREATE POLICY "Users can update their own wishlist_lists"
ON wishlist_lists FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own wishlist_lists" ON wishlist_lists;
CREATE POLICY "Users can delete their own wishlist_lists"
ON wishlist_lists FOR DELETE
USING (auth.uid() = user_id);

-- 6. Create/recreate the trigger function
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

-- 7. Create/recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created_default_wishlist ON profiles;
CREATE TRIGGER on_auth_user_created_default_wishlist
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_default_wishlist();

-- 8. Test everything works with a dummy user
DO $$
DECLARE
    test_user_id UUID := gen_random_uuid();
    wishlist_count INTEGER;
BEGIN
    -- Insert test profile (should trigger wishlist creation)
    INSERT INTO profiles (
        id, 
        username, 
        display_name, 
        created_at, 
        updated_at
    ) VALUES (
        test_user_id,
        'test_final_' || extract(epoch from now()),
        'Final Test User',
        NOW(),
        NOW()
    );
    
    -- Check if wishlist was created
    SELECT count(*) INTO wishlist_count 
    FROM wishlist_lists 
    WHERE user_id = test_user_id AND is_default = true;
    
    IF wishlist_count > 0 THEN
        RAISE NOTICE '✅ SUCCESS: Complete system working - profile and default wishlist created';
    ELSE
        RAISE NOTICE '❌ FAILURE: Profile created but no default wishlist found';
    END IF;
    
    -- Clean up test data
    DELETE FROM wishlist_lists WHERE user_id = test_user_id;
    DELETE FROM profiles WHERE id = test_user_id;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ ERROR during final test: %', SQLERRM;
    -- Try to clean up anyway
    BEGIN
        DELETE FROM wishlist_lists WHERE user_id = test_user_id;
        DELETE FROM profiles WHERE id = test_user_id;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;
END $$;

-- 9. Final verification
SELECT 
  'FINAL STATUS' as test,
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wishlist_lists') 
    THEN '❌ CRITICAL: wishlist_lists table still missing'
    WHEN NOT EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'handle_new_user_default_wishlist')
    THEN '❌ CRITICAL: trigger function still missing'  
    WHEN NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created_default_wishlist')
    THEN '❌ CRITICAL: trigger not attached'
    ELSE '✅ ALL SYSTEMS GO: Table, function, and trigger all present'
  END as status;

-- 10. Show table structure for verification
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'wishlist_lists' 
AND table_schema = 'public'
ORDER BY ordinal_position;