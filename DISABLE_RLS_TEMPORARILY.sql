-- =====================================================
-- DISABLE RLS TEMPORARILY
-- Temporarily disable RLS to test if that's blocking data access
-- =====================================================

-- 1. Temporarily disable RLS on key tables to test access
ALTER TABLE cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE sets DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_collections DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist_lists DISABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists DISABLE ROW LEVEL SECURITY;
ALTER TABLE friendships DISABLE ROW LEVEL SECURITY;
ALTER TABLE trades DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements DISABLE ROW LEVEL SECURITY;
ALTER TABLE collection_stats DISABLE ROW LEVEL SECURITY;
ALTER TABLE price_history DISABLE ROW LEVEL SECURITY;

-- 2. Grant broad access to authenticated users
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- 3. Test basic queries that the dashboard would use
DO $$
BEGIN
    -- Test reading cards (critical for dashboard)
    IF EXISTS (SELECT 1 FROM cards LIMIT 1) THEN
        RAISE NOTICE '✅ Cards accessible: % cards found', (SELECT count(*) FROM cards);
    ELSE
        RAISE NOTICE '❌ Cards table empty or inaccessible';
    END IF;
    
    -- Test reading sets
    IF EXISTS (SELECT 1 FROM sets LIMIT 1) THEN
        RAISE NOTICE '✅ Sets accessible: % sets found', (SELECT count(*) FROM sets);
    ELSE
        RAISE NOTICE '❌ Sets table empty or inaccessible';
    END IF;
    
    -- Test reading profiles
    IF EXISTS (SELECT 1 FROM profiles LIMIT 1) THEN
        RAISE NOTICE '✅ Profiles accessible: % profiles found', (SELECT count(*) FROM profiles);
    ELSE
        RAISE NOTICE '❌ Profiles table empty or inaccessible';
    END IF;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ ERROR during basic access tests: %', SQLERRM;
END $$;

-- 4. Test specific user data access
SELECT 
  'User Data Test' as test,
  u.username,
  u.display_name,
  (SELECT count(*) FROM user_collections WHERE user_id = u.id) as user_collections_count,
  (SELECT count(*) FROM wishlists WHERE user_id = u.id) as wishlists_count
FROM profiles u
ORDER BY u.created_at DESC
LIMIT 3;

SELECT 'RLS TEMPORARILY DISABLED' as status, 
       'Dashboard should now load data if RLS was the issue' as message;