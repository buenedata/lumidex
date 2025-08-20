-- =====================================================
-- LUMIDEX WISHLIST LISTS MIGRATION (FIXED VERSION)
-- Handles existing elements gracefully
-- Run this in Supabase Dashboard → SQL Editor
-- =====================================================

-- 1. Create wishlist_lists table (already exists based on error)
-- No action needed - table exists

-- 2. Add wishlist_list_id to existing wishlists table (if not exists)
ALTER TABLE wishlists ADD COLUMN IF NOT EXISTS wishlist_list_id UUID REFERENCES wishlist_lists(id) ON DELETE CASCADE;

-- 3. Create indexes for performance (if not exists)
CREATE INDEX IF NOT EXISTS idx_wishlist_lists_user_id ON wishlist_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_lists_is_default ON wishlist_lists(user_id, is_default);
CREATE INDEX IF NOT EXISTS idx_wishlists_list_id ON wishlists(wishlist_list_id);

-- 4. Enable RLS on wishlist_lists (safe to run multiple times)
ALTER TABLE wishlist_lists ENABLE ROW LEVEL SECURITY;

-- 5. Drop existing policies and recreate (to handle existing policies)
DROP POLICY IF EXISTS "Users can view their own wishlist lists" ON wishlist_lists;
DROP POLICY IF EXISTS "Users can manage their own wishlist lists" ON wishlist_lists;
DROP POLICY IF EXISTS "Public wishlist lists are viewable by everyone" ON wishlist_lists;

CREATE POLICY "Users can view their own wishlist lists" ON wishlist_lists
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own wishlist lists" ON wishlist_lists
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Public wishlist lists are viewable by everyone" ON wishlist_lists
  FOR SELECT USING (is_public = true);

-- 6. Create the trigger function to auto-create default wishlist
CREATE OR REPLACE FUNCTION create_default_wishlist_list()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO wishlist_lists (user_id, name, description, is_default)
  VALUES (NEW.id, 'My Wishlist', 'Default wishlist', true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Create the trigger on profiles table (drop first to avoid conflicts)
DROP TRIGGER IF EXISTS create_default_wishlist_list_trigger ON profiles;
CREATE TRIGGER create_default_wishlist_list_trigger
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION create_default_wishlist_list();

-- 8. Migrate existing users (create default wishlists for existing profiles)
INSERT INTO wishlist_lists (user_id, name, description, is_default)
SELECT p.id, 'My Wishlist', 'Default wishlist', true
FROM profiles p
LEFT JOIN wishlist_lists wl ON p.id = wl.user_id
WHERE wl.id IS NULL
ON CONFLICT (user_id, name) DO NOTHING;

-- 9. Update existing wishlist items to belong to default lists
UPDATE wishlists 
SET wishlist_list_id = (
  SELECT wl.id 
  FROM wishlist_lists wl 
  WHERE wl.user_id = wishlists.user_id 
  AND wl.is_default = true 
  LIMIT 1
) 
WHERE wishlist_list_id IS NULL;

-- 10. Make wishlist_list_id NOT NULL after migration (only if no NULL values remain)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM wishlists WHERE wishlist_list_id IS NULL) THEN
    ALTER TABLE wishlists ALTER COLUMN wishlist_list_id SET NOT NULL;
  END IF;
END $$;

-- 11. Update unique constraints (drop existing first)
ALTER TABLE wishlists DROP CONSTRAINT IF EXISTS wishlists_user_id_card_id_key;
ALTER TABLE wishlists DROP CONSTRAINT IF EXISTS wishlists_list_card_unique;
ALTER TABLE wishlists ADD CONSTRAINT wishlists_list_card_unique 
  UNIQUE(wishlist_list_id, card_id);

-- Migration completed successfully!
SELECT 'Fixed Wishlist Lists migration completed successfully!' as status;