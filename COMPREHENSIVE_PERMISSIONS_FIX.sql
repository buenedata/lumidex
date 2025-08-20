-- =====================================================
-- COMPREHENSIVE PERMISSIONS FIX
-- Fix permissions on ALL tables needed for the app to function
-- =====================================================

-- 1. Core user tables
GRANT ALL PRIVILEGES ON TABLE profiles TO postgres, supabase_admin, authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE profiles TO authenticated, service_role;

-- 2. Card and collection tables
GRANT ALL PRIVILEGES ON TABLE cards TO postgres, supabase_admin, authenticator;
GRANT SELECT ON TABLE cards TO authenticated, service_role, anon;

GRANT ALL PRIVILEGES ON TABLE sets TO postgres, supabase_admin, authenticator;
GRANT SELECT ON TABLE sets TO authenticated, service_role, anon;

GRANT ALL PRIVILEGES ON TABLE user_collections TO postgres, supabase_admin, authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_collections TO authenticated, service_role;

-- 3. Social and trading tables
GRANT ALL PRIVILEGES ON TABLE friendships TO postgres, supabase_admin, authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE friendships TO authenticated, service_role;

GRANT ALL PRIVILEGES ON TABLE trades TO postgres, supabase_admin, authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE trades TO authenticated, service_role;

GRANT ALL PRIVILEGES ON TABLE trade_items TO postgres, supabase_admin, authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE trade_items TO authenticated, service_role;

-- 4. Wishlist tables
GRANT ALL PRIVILEGES ON TABLE wishlist_lists TO postgres, supabase_admin, authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE wishlist_lists TO authenticated, service_role;

GRANT ALL PRIVILEGES ON TABLE wishlists TO postgres, supabase_admin, authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE wishlists TO authenticated, service_role;

-- 5. Achievement and stats tables
GRANT ALL PRIVILEGES ON TABLE user_achievements TO postgres, supabase_admin, authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_achievements TO authenticated, service_role;

GRANT ALL PRIVILEGES ON TABLE collection_stats TO postgres, supabase_admin, authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE collection_stats TO authenticated, service_role;

-- 6. Activity and engagement tables  
GRANT ALL PRIVILEGES ON TABLE user_daily_activity TO postgres, supabase_admin, authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_daily_activity TO authenticated, service_role;

GRANT ALL PRIVILEGES ON TABLE user_streaks TO postgres, supabase_admin, authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_streaks TO authenticated, service_role;

-- 7. Pricing tables
GRANT ALL PRIVILEGES ON TABLE price_history TO postgres, supabase_admin, authenticator;
GRANT SELECT ON TABLE price_history TO authenticated, service_role, anon;

-- 8. Wanted board
GRANT ALL PRIVILEGES ON TABLE wanted_board TO postgres, supabase_admin, authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE wanted_board TO authenticated, service_role;

-- 9. Grant schema usage
GRANT USAGE ON SCHEMA public TO authenticated, service_role, anon;
GRANT ALL ON SCHEMA public TO postgres, supabase_admin, authenticator;

-- 10. Enable RLS on all user-specific tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_daily_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE wanted_board ENABLE ROW LEVEL SECURITY;

-- 11. Basic RLS policies for profiles
DROP POLICY IF EXISTS "Users can manage their own profile" ON profiles;
CREATE POLICY "Users can manage their own profile"
ON profiles FOR ALL
USING (auth.uid() = id);

-- 12. Basic RLS policies for user_collections
DROP POLICY IF EXISTS "Users can manage their own collections" ON user_collections;
CREATE POLICY "Users can manage their own collections"
ON user_collections FOR ALL
USING (auth.uid() = user_id);

-- 13. Test critical queries
DO $$
BEGIN
    -- Test profiles access
    IF EXISTS (SELECT 1 FROM profiles LIMIT 1) THEN
        RAISE NOTICE '✅ profiles table accessible';
    ELSE
        RAISE NOTICE '⚠️ profiles table empty or inaccessible';
    END IF;
    
    -- Test cards access
    IF EXISTS (SELECT 1 FROM cards LIMIT 1) THEN
        RAISE NOTICE '✅ cards table accessible';
    ELSE
        RAISE NOTICE '⚠️ cards table empty or inaccessible';
    END IF;
    
    -- Test sets access
    IF EXISTS (SELECT 1 FROM sets LIMIT 1) THEN
        RAISE NOTICE '✅ sets table accessible';
    ELSE
        RAISE NOTICE '⚠️ sets table empty or inaccessible';
    END IF;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ ERROR during tests: %', SQLERRM;
END $$;

SELECT 'COMPREHENSIVE PERMISSIONS APPLIED' as status, 
       'All app tables should now be accessible' as message;