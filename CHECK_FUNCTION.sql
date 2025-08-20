-- =====================================================
-- CHECK TRIGGER FUNCTION DEFINITION
-- =====================================================

-- 1. Get the actual function definition
SELECT 
  proname,
  prosrc,
  provolatile,
  prosecdef,
  proowner
FROM pg_proc 
WHERE proname = 'create_default_wishlist_list';

-- 2. Check if function runs as postgres/definer
SELECT 
  f.proname,
  f.prosecdef as is_security_definer,
  r.rolname as owner_role
FROM pg_proc f
JOIN pg_roles r ON f.proowner = r.oid
WHERE f.proname = 'create_default_wishlist_list';

-- 3. Test the function manually to see exact error
SELECT create_default_wishlist_list();

-- 4. Check if there are any schema path issues in function
SHOW search_path;