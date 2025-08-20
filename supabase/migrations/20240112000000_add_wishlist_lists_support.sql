-- =====================================================
-- ADD WISHLIST LISTS SUPPORT
-- =====================================================
-- This migration adds support for multiple wishlist lists per user

-- Create wishlist_lists table
CREATE TABLE IF NOT EXISTS wishlist_lists (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(name) >= 1 AND length(name) <= 100),
  description TEXT CHECK (length(description) <= 500),
  is_default BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, name)
);

-- Add wishlist_list_id to existing wishlists table
ALTER TABLE wishlists ADD COLUMN IF NOT EXISTS wishlist_list_id UUID REFERENCES wishlist_lists(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_wishlist_lists_user_id ON wishlist_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_lists_is_default ON wishlist_lists(user_id, is_default);
CREATE INDEX IF NOT EXISTS idx_wishlists_list_id ON wishlists(wishlist_list_id);

-- Add updated_at trigger for wishlist_lists
CREATE TRIGGER update_wishlist_lists_updated_at BEFORE UPDATE ON wishlist_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on wishlist_lists
ALTER TABLE wishlist_lists ENABLE ROW LEVEL SECURITY;

-- Wishlist lists policies
CREATE POLICY "Users can view their own wishlist lists" ON wishlist_lists
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own wishlist lists" ON wishlist_lists
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Public wishlist lists are viewable by everyone" ON wishlist_lists
  FOR SELECT USING (is_public = true);

-- Function to create default wishlist list for new users
CREATE OR REPLACE FUNCTION create_default_wishlist_list()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO wishlist_lists (user_id, name, description, is_default)
  VALUES (NEW.id, 'My Wishlist', 'Default wishlist', true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create default wishlist list for new users
CREATE TRIGGER create_default_wishlist_list_trigger
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION create_default_wishlist_list();

-- Function to migrate existing wishlist items to default list
CREATE OR REPLACE FUNCTION migrate_existing_wishlists()
RETURNS void AS $$
DECLARE
  user_record RECORD;
  default_list_id UUID;
BEGIN
  -- For each user with existing wishlist items but no wishlist lists
  FOR user_record IN 
    SELECT DISTINCT w.user_id 
    FROM wishlists w 
    LEFT JOIN wishlist_lists wl ON w.user_id = wl.user_id 
    WHERE wl.id IS NULL
  LOOP
    -- Create default wishlist list for this user
    INSERT INTO wishlist_lists (user_id, name, description, is_default)
    VALUES (user_record.user_id, 'My Wishlist', 'Default wishlist', true)
    RETURNING id INTO default_list_id;
    
    -- Update all existing wishlist items to belong to this default list
    UPDATE wishlists 
    SET wishlist_list_id = default_list_id 
    WHERE user_id = user_record.user_id AND wishlist_list_id IS NULL;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run the migration for existing data
SELECT migrate_existing_wishlists();

-- Drop the migration function as it's no longer needed
DROP FUNCTION migrate_existing_wishlists();

-- Update the unique constraint on wishlists to include wishlist_list_id
-- First drop the old constraint
ALTER TABLE wishlists DROP CONSTRAINT IF EXISTS wishlists_user_id_card_id_key;

-- Add new constraint that allows same card in different lists
ALTER TABLE wishlists ADD CONSTRAINT wishlists_list_card_unique 
  UNIQUE(wishlist_list_id, card_id);

-- Make wishlist_list_id NOT NULL after migration
-- (We'll do this in a separate step to ensure all existing data is migrated)
UPDATE wishlists SET wishlist_list_id = (
  SELECT id FROM wishlist_lists 
  WHERE wishlist_lists.user_id = wishlists.user_id 
  AND is_default = true 
  LIMIT 1
) WHERE wishlist_list_id IS NULL;

-- Now make it NOT NULL
ALTER TABLE wishlists ALTER COLUMN wishlist_list_id SET NOT NULL;

COMMENT ON TABLE wishlist_lists IS 'User-created wishlist collections';
COMMENT ON TABLE wishlists IS 'Individual wishlist items belonging to wishlist lists';