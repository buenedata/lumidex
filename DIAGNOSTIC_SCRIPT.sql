-- =====================================================
-- DIAGNOSTIC SCRIPT - Find the Hidden wishlist_lists Table
-- =====================================================

-- 1. Check ALL schemas for wishlist_lists table
SELECT 
  schemaname, 
  tablename, 
  tableowner,
  hasindexes,
  hasrules,
  hastriggers
FROM pg_tables 
WHERE tablename = 'wishlist_lists';

-- 2. Check current search_path
SHOW search_path;

-- 3. Check if we can actually see/access the table
DO $$
BEGIN
  BEGIN
    PERFORM 1 FROM wishlist_lists LIMIT 1;
    RAISE NOTICE 'SUCCESS: Can access wishlist_lists table';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ERROR: Cannot access wishlist_lists table: %', SQLERRM;
  END;
END $$;

-- 4. Try to describe the table structure if it exists
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'wishlist_lists' 
ORDER BY ordinal_position;

-- 5. Check if trigger function exists
SELECT 
  proname,
  pronamespace::regnamespace as schema_name
FROM pg_proc 
WHERE proname = 'create_default_wishlist_list';

-- 6. Force check with explicit schema reference
SELECT count(*) as record_count 
FROM public.wishlist_lists;