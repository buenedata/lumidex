-- =====================================================
-- FIND HIDDEN TRIGGERS - Check auth schema and system triggers
-- =====================================================

-- 1. Check ALL triggers in auth schema
SELECT 
  t.tgname as trigger_name,
  c.relname as table_name,
  n.nspname as schema_name,
  p.proname as function_name,
  t.tgenabled as enabled
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE n.nspname = 'auth'
ORDER BY schema_name, table_name, trigger_name;

-- 2. Check for ANY functions that contain 'wishlist' anywhere
SELECT 
  n.nspname as schema,
  p.proname as function_name,
  p.prosrc as source_code
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.prosrc ILIKE '%wishlist%'
ORDER BY schema, function_name;

-- 3. Check for any triggers that might call functions with wishlist
SELECT DISTINCT
  t.tgname as trigger_name,
  c.relname as table_name,
  n.nspname as schema_name,
  p.proname as function_name,
  p.prosrc as function_source
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE p.prosrc ILIKE '%wishlist%'
ORDER BY schema_name, table_name;

-- 4. Check if there are any constraints or policies that reference wishlist_lists
SELECT 
  'Constraint' as type,
  n.nspname as schema,
  c.relname as table_name,
  con.conname as name,
  pg_get_constraintdef(con.oid) as definition
FROM pg_constraint con
JOIN pg_class c ON con.conrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE pg_get_constraintdef(con.oid) ILIKE '%wishlist_lists%'

UNION ALL

SELECT 
  'Policy' as type,
  schemaname as schema,
  tablename as table_name,
  policyname as name,
  qual as definition
FROM pg_policies 
WHERE qual ILIKE '%wishlist_lists%'
   OR with_check ILIKE '%wishlist_lists%'
ORDER BY type, schema, table_name;

-- 5. Final check - any remaining references to wishlist_lists
SELECT 
  'Function' as type,
  n.nspname as schema,
  p.proname as name,
  'Contains wishlist_lists reference' as note
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.prosrc ILIKE '%wishlist_lists%'
ORDER BY schema, name;