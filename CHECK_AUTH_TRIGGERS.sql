-- =====================================================
-- CHECK AUTH TRIGGERS
-- Look for any triggers that might fire during auth operations
-- =====================================================

-- 1. Check ALL triggers in the database
SELECT 
  schemaname,
  tablename,
  triggername,
  tgtype,
  tgenabled,
  tgfoid::regproc as trigger_function
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE tgname NOT LIKE '%_pkey%'
  AND tgname NOT LIKE '%_fkey%'
ORDER BY schemaname, tablename, triggername;

-- 2. Check for any triggers on auth schema tables
SELECT 
  schemaname,
  tablename,
  triggername,
  tgtype,
  tgenabled,
  tgfoid::regproc as trigger_function
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'auth'
ORDER BY tablename, triggername;

-- 3. Check ALL functions that might reference wishlist_lists
SELECT 
  schemaname,
  funcname,
  rettype,
  argtypes
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE prosrc ILIKE '%wishlist_lists%'
   OR proname ILIKE '%wishlist%'
ORDER BY schemaname, funcname;

-- 4. Check for any policies that might reference wishlist_lists
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE qual ILIKE '%wishlist_lists%'
   OR with_check ILIKE '%wishlist_lists%'
ORDER BY schemaname, tablename, policyname;

-- 5. Check if there are any auth hooks or extensions
SELECT 
  'Extensions' as type,
  extname as name,
  extversion as version
FROM pg_extension
WHERE extname ILIKE '%auth%' OR extname ILIKE '%supabase%'

UNION ALL

SELECT 
  'Settings' as type,
  name,
  setting as version
FROM pg_settings 
WHERE name ILIKE '%auth%' AND name != 'authentication_timeout'
ORDER BY type, name;

-- 6. Look for any custom auth-related functions
SELECT 
  n.nspname as schema,
  p.proname as function_name,
  pg_get_function_result(p.oid) as return_type,
  pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE (p.proname ILIKE '%auth%' OR p.proname ILIKE '%user%' OR p.proname ILIKE '%profile%')
  AND n.nspname = 'public'
ORDER BY schema, function_name;