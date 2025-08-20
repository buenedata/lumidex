-- =====================================================
-- TEST RLS POLICIES ON WISHLIST_LISTS
-- =====================================================

-- 1. Check current RLS policies on wishlist_lists
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'wishlist_lists';

-- 2. Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'wishlist_lists';

-- 3. Test manual insert (this should work if RLS allows)
-- First get an existing user ID from profiles
SELECT id as existing_user_id 
FROM profiles 
LIMIT 1;

-- Note: Replace 'EXISTING_USER_ID' with actual ID from above query
-- INSERT INTO wishlist_lists (user_id, name, description, is_default)
-- VALUES ('EXISTING_USER_ID', 'Test Manual', 'Manual test', false);

-- 4. Check trigger exists on profiles
SELECT 
  trigger_name,
  event_manipulation,
  action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'profiles';