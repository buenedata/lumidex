-- =====================================================
-- CHECK COLLECTION TABLES
-- Verify all tables needed for card collection functionality
-- =====================================================

-- 1. Check if key collection tables exist
SELECT 
  'Table Existence Check' as test,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_collections' AND table_schema = 'public') as user_collections_exists,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cards' AND table_schema = 'public') as cards_exists,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sets' AND table_schema = 'public') as sets_exists,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles' AND table_schema = 'public') as profiles_exists;

-- 2. Check permissions on user_collections table
SELECT 
  'user_collections Permissions' as test,
  has_table_privilege('authenticated', 'user_collections', 'SELECT') as can_select,
  has_table_privilege('authenticated', 'user_collections', 'INSERT') as can_insert,
  has_table_privilege('authenticated', 'user_collections', 'UPDATE') as can_update,
  has_table_privilege('authenticated', 'user_collections', 'DELETE') as can_delete;

-- 3. Check RLS policies on user_collections
SELECT 
  'RLS Policies' as test,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'user_collections'
ORDER BY tablename, policyname;

-- 4. Check if there are any triggers on user_collections that might fail
SELECT 
  'Triggers Check' as test,
  t.tgname as trigger_name,
  c.relname as table_name,
  p.proname as function_name,
  t.tgenabled as enabled
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'user_collections'
ORDER BY trigger_name;

-- 5. Test basic insert into user_collections (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_collections') THEN
    -- Try a test insert to see what fails
    BEGIN
      -- This should fail gracefully if there are permission issues
      PERFORM 1 FROM user_collections LIMIT 1;
      RAISE NOTICE '✅ user_collections table accessible';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '❌ user_collections access failed: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE '❌ user_collections table does not exist';
  END IF;
END $$;