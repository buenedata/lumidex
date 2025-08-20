-- =====================================================
-- SIMPLE WISHLIST MIGRATION (GUARANTEED TO WORK)
-- Run this step by step in Supabase Dashboard
-- =====================================================

-- Step 1: Create the table (run this first)
CREATE TABLE wishlist_lists (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Step 2: Add column to wishlists (run this second)
ALTER TABLE wishlists ADD COLUMN wishlist_list_id UUID REFERENCES wishlist_lists(id) ON DELETE CASCADE;

-- Step 3: Enable RLS (run this third)
ALTER TABLE wishlist_lists ENABLE ROW LEVEL SECURITY;

-- Step 4: Create policies (run this fourth)
CREATE POLICY "Users can manage their own wishlist lists" ON wishlist_lists
  FOR ALL USING (auth.uid() = user_id);

-- Step 5: Create trigger function (run this fifth)
CREATE OR REPLACE FUNCTION create_default_wishlist_list()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO wishlist_lists (user_id, name, description, is_default)
  VALUES (NEW.id, 'My Wishlist', 'Default wishlist', true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Create trigger (run this sixth)
CREATE TRIGGER create_default_wishlist_list_trigger
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION create_default_wishlist_list();

-- Verification: Check if everything was created
SELECT 'SUCCESS: wishlist_lists table created!' as status
WHERE EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'wishlist_lists');