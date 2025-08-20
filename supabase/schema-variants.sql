-- =====================================================
-- POKEMON TCG COLLECTION - VARIANT SUPPORT UPDATE
-- =====================================================
-- This script updates the user_collections table to support card variants

-- First, let's add a variant column to the user_collections table
ALTER TABLE user_collections ADD COLUMN IF NOT EXISTS variant TEXT DEFAULT 'normal';

-- Update the unique constraint to include variant
ALTER TABLE user_collections DROP CONSTRAINT IF EXISTS user_collections_user_id_card_id_condition_is_foil_key;

-- Add new unique constraint that includes variant
ALTER TABLE user_collections ADD CONSTRAINT user_collections_unique_variant 
  UNIQUE(user_id, card_id, condition, is_foil, variant);

-- Create an index for better performance on variant queries
CREATE INDEX IF NOT EXISTS idx_user_collections_variant ON user_collections(variant);

-- Update existing records to have 'normal' variant if they don't have one
UPDATE user_collections SET variant = 'normal' WHERE variant IS NULL;

-- Make variant column NOT NULL now that all records have a value
ALTER TABLE user_collections ALTER COLUMN variant SET NOT NULL;

-- Add check constraint for valid variants
ALTER TABLE user_collections ADD CONSTRAINT check_valid_variant 
  CHECK (variant IN ('normal', 'holo', 'reverse_holo', 'pokeball_pattern', 'masterball_pattern'));

-- Create a view for easier variant querying
CREATE OR REPLACE VIEW user_collection_variants AS
SELECT 
  uc.user_id,
  uc.card_id,
  uc.variant,
  SUM(uc.quantity) as total_quantity,
  array_agg(DISTINCT uc.condition) as conditions,
  MAX(uc.created_at) as latest_added,
  c.name as card_name,
  c.number as card_number,
  s.name as set_name
FROM user_collections uc
JOIN cards c ON uc.card_id = c.id
JOIN sets s ON c.set_id = s.id
GROUP BY uc.user_id, uc.card_id, uc.variant, c.name, c.number, s.name;

-- Create a function to get all variants for a user's card
CREATE OR REPLACE FUNCTION get_user_card_variants(user_uuid UUID, card_uuid TEXT)
RETURNS TABLE (
  variant TEXT,
  total_quantity BIGINT,
  conditions TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    uc.variant,
    SUM(uc.quantity) as total_quantity,
    array_agg(DISTINCT uc.condition::TEXT) as conditions
  FROM user_collections uc
  WHERE uc.user_id = user_uuid AND uc.card_id = card_uuid
  GROUP BY uc.variant;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate the collection stats function to account for variants
DROP FUNCTION IF EXISTS calculate_collection_stats(UUID);

CREATE OR REPLACE FUNCTION calculate_collection_stats(user_uuid UUID)
RETURNS TABLE (
  total_cards BIGINT,
  unique_cards BIGINT,
  total_value_eur NUMERIC,
  sets_with_cards BIGINT,
  total_variants BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(uc.quantity), 0) as total_cards,
    COUNT(DISTINCT uc.card_id) as unique_cards,
    COALESCE(SUM(uc.quantity * COALESCE(c.cardmarket_avg_sell_price, 0)), 0) as total_value_eur,
    COUNT(DISTINCT c.set_id) as sets_with_cards,
    COUNT(DISTINCT CONCAT(uc.card_id, '-', uc.variant)) as total_variants
  FROM user_collections uc
  LEFT JOIN cards c ON uc.card_id = c.id
  WHERE uc.user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- VARIANT SUPPORT UPDATE COMPLETE!
-- =====================================================

/*
This update adds proper variant support to the user_collections table:

✅ Added 'variant' column to store card variant type
✅ Updated unique constraint to allow multiple variants of same card
✅ Added check constraint for valid variant values
✅ Created view for easier variant querying
✅ Added function to get all variants for a specific card
✅ Updated collection stats to include variant count

Valid variants:
- 'normal' (default, non-holo)
- 'holo' (holographic)
- 'reverse_holo' (reverse holographic)
- 'pokeball_pattern' (special pokeball pattern)
- 'masterball_pattern' (special masterball pattern)

Now users can add multiple variants of the same card to their collection!
*/