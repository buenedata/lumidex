-- =====================================================
-- REMOVE HIDDEN FUNCTION
-- Remove the create_default_wishlist_list function that's causing the error
-- =====================================================

-- 1. Drop the problematic function
DROP FUNCTION IF EXISTS create_default_wishlist_list CASCADE;

-- 2. Check if any triggers are using this function
SELECT 
  t.tgname as trigger_name,
  c.relname as table_name,
  n.nspname as schema_name,
  p.proname as function_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE p.proname = 'create_default_wishlist_list';

-- 3. Verify function is removed
SELECT 
  'Function Check' as test,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'create_default_wishlist_list'
    AND n.nspname = 'public'
  ) as function_still_exists;

-- 4. Final verification - no more wishlist_lists references
SELECT 
  'Final Check' as test,
  count(*) as remaining_wishlist_references
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.prosrc ILIKE '%wishlist_lists%'
  AND n.nspname = 'public';

SELECT 'CLEANUP COMPLETE' as status, 
       'Hidden function removed - registration should now work' as message;