-- =====================================================
-- FIX COLLECTION PERMISSIONS
-- Grant proper permissions to collection-related tables
-- =====================================================

-- 1. Grant permissions on user_collections table
GRANT ALL PRIVILEGES ON TABLE user_collections TO postgres;
GRANT ALL PRIVILEGES ON TABLE user_collections TO supabase_admin;
GRANT ALL PRIVILEGES ON TABLE user_collections TO authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_collections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_collections TO service_role;

-- 2. Grant permissions on cards table
GRANT ALL PRIVILEGES ON TABLE cards TO postgres;
GRANT ALL PRIVILEGES ON TABLE cards TO supabase_admin;
GRANT ALL PRIVILEGES ON TABLE cards TO authenticator;
GRANT SELECT ON TABLE cards TO authenticated;
GRANT SELECT ON TABLE cards TO service_role;
GRANT SELECT ON TABLE cards TO anon;

-- 3. Grant permissions on sets table
GRANT ALL PRIVILEGES ON TABLE sets TO postgres;
GRANT ALL PRIVILEGES ON TABLE sets TO supabase_admin;
GRANT ALL PRIVILEGES ON TABLE sets TO authenticator;
GRANT SELECT ON TABLE sets TO authenticated;
GRANT SELECT ON TABLE sets TO service_role;
GRANT SELECT ON TABLE sets TO anon;

-- 4. Ensure RLS is enabled on user_collections
ALTER TABLE user_collections ENABLE ROW LEVEL SECURITY;

-- 5. Create basic RLS policies for user_collections (if they don't exist)
DROP POLICY IF EXISTS "Users can view their own collections" ON user_collections;
CREATE POLICY "Users can view their own collections"
ON user_collections FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own collections" ON user_collections;
CREATE POLICY "Users can insert their own collections"
ON user_collections FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own collections" ON user_collections;
CREATE POLICY "Users can update their own collections"
ON user_collections FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own collections" ON user_collections;
CREATE POLICY "Users can delete their own collections"
ON user_collections FOR DELETE
USING (auth.uid() = user_id);

-- 6. Test access
SELECT 
  'Collection Access Test' as test,
  has_table_privilege('authenticated', 'user_collections', 'SELECT') as can_select,
  has_table_privilege('authenticated', 'user_collections', 'INSERT') as can_insert,
  has_table_privilege('authenticated', 'cards', 'SELECT') as can_read_cards,
  has_table_privilege('authenticated', 'sets', 'SELECT') as can_read_sets;

SELECT 'COLLECTION PERMISSIONS FIXED' as status, 
       'Card collection should now work without redirect loops' as message;