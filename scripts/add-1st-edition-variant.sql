-- Add 1st Edition variant support to the database
-- This script adds the '1st_edition' variant to the existing variant system

-- First, let's check if we need to add a variant enum type
-- The current schema doesn't have a variant enum, so we need to add a check constraint

-- Add a check constraint to allow '1st_edition' as a valid variant
-- Note: The current schema doesn't have a variant column constraint, 
-- but we should add one for data integrity

-- Add the variant column constraint if it doesn't exist
DO $$
BEGIN
    -- Check if the constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'user_collections_variant_check' 
        AND table_name = 'user_collections'
    ) THEN
        -- Add the constraint with all valid variants including 1st_edition
        ALTER TABLE user_collections 
        ADD CONSTRAINT user_collections_variant_check 
        CHECK (variant IN ('normal', 'holo', 'reverse_holo', 'pokeball_pattern', 'masterball_pattern', '1st_edition'));
    ELSE
        -- Drop and recreate the constraint to include 1st_edition
        ALTER TABLE user_collections DROP CONSTRAINT user_collections_variant_check;
        ALTER TABLE user_collections 
        ADD CONSTRAINT user_collections_variant_check 
        CHECK (variant IN ('normal', 'holo', 'reverse_holo', 'pokeball_pattern', 'masterball_pattern', '1st_edition'));
    END IF;
END $$;

-- Add the variant column if it doesn't exist (it should exist based on the current usage)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_collections' 
        AND column_name = 'variant'
    ) THEN
        ALTER TABLE user_collections ADD COLUMN variant TEXT DEFAULT 'normal';
    END IF;
END $$;

-- Update the unique constraint to include variant if needed
-- The current schema has UNIQUE(user_id, card_id, condition, is_foil)
-- We need to update it to include variant for proper uniqueness
DO $$
BEGIN
    -- Check if the current unique constraint exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'user_collections_user_id_card_id_condition_is_foil_key' 
        AND table_name = 'user_collections'
    ) THEN
        -- Drop the old constraint
        ALTER TABLE user_collections DROP CONSTRAINT user_collections_user_id_card_id_condition_is_foil_key;
        
        -- Add new constraint that includes variant
        ALTER TABLE user_collections 
        ADD CONSTRAINT user_collections_user_id_card_id_variant_condition_is_foil_key 
        UNIQUE(user_id, card_id, variant, condition, is_foil);
    END IF;
END $$;

-- Create an index on the variant column for better performance
CREATE INDEX IF NOT EXISTS idx_user_collections_variant ON user_collections(variant);

COMMENT ON COLUMN user_collections.variant IS 'Card variant type: normal, holo, reverse_holo, pokeball_pattern, masterball_pattern, 1st_edition';