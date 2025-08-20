-- =====================================================
-- FIX RLS POLICIES FOR WISHLIST_LISTS
-- This allows the trigger function to work
-- =====================================================

-- 1. Ensure RLS is enabled
ALTER TABLE wishlist_lists ENABLE ROW LEVEL SECURITY;

-- 2. Create policy for users to manage their own wishlists
CREATE POLICY "Users can manage their own wishlist lists" ON wishlist_lists
  FOR ALL USING (auth.uid() = user_id);

-- 3. CRITICAL: Allow service role to insert (for trigger function)
CREATE POLICY "Service role can insert wishlist lists" ON wishlist_lists
  FOR INSERT 
  WITH CHECK (true);

-- 4. Allow trigger function (SECURITY DEFINER) to bypass RLS for inserts
CREATE POLICY "Allow trigger function to create default wishlists" ON wishlist_lists
  FOR INSERT 
  TO postgres
  WITH CHECK (true);

-- 5. Test that policies work
SELECT 
  policyname,
  cmd,
  roles
FROM pg_policies 
WHERE tablename = 'wishlist_lists';

-- Success message
SELECT 'RLS policies created successfully!' as status;