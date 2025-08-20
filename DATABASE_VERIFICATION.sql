-- =====================================================
-- DATABASE VERIFICATION SCRIPT
-- Run this in Supabase Dashboard → SQL Editor to verify current state
-- =====================================================

-- 1. Check if wishlist_lists table exists
SELECT 
  schemaname, 
  tablename, 
  tableowner 
FROM pg_tables 
WHERE tablename = 'wishlist_lists';

-- 2. Check if the trigger function exists
SELECT 
  proname as function_name,
  prosrc as function_body
FROM pg_proc 
WHERE proname = 'create_default_wishlist_list';

-- 3. Check if the trigger exists on profiles table
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'create_default_wishlist_list_trigger';

-- 4. List all tables to see what exists
SELECT schemaname, tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- 5. Check current database connection info
SELECT current_database(), current_schema(), current_user;

-- 6. If wishlist_lists exists, check its structure
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'wishlist_lists') THEN
    RAISE NOTICE 'wishlist_lists table EXISTS - checking structure...';
  ELSE
    RAISE NOTICE 'wishlist_lists table DOES NOT EXIST!';
  END IF;
END $$;