-- Fix the database constraint to allow 1st_edition variant
-- This script updates the existing check constraint

-- First, let's see what constraints exist
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'user_collections'::regclass;

-- Drop the existing constraint if it exists
DO $$
BEGIN
    -- Check if the constraint exists and drop it
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'check_valid_variant' 
        AND table_name = 'user_collections'
    ) THEN
        ALTER TABLE user_collections DROP CONSTRAINT check_valid_variant;
        RAISE NOTICE 'Dropped existing check_valid_variant constraint';
    END IF;
    
    -- Also check for other variant-related constraints
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'user_collections_variant_check' 
        AND table_name = 'user_collections'
    ) THEN
        ALTER TABLE user_collections DROP CONSTRAINT user_collections_variant_check;
        RAISE NOTICE 'Dropped existing user_collections_variant_check constraint';
    END IF;
END $$;

-- Add the new constraint that includes 1st_edition
ALTER TABLE user_collections 
ADD CONSTRAINT user_collections_variant_check 
CHECK (variant IN ('normal', 'holo', 'reverse_holo', 'pokeball_pattern', 'masterball_pattern', '1st_edition'));

-- Verify the constraint was added
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'user_collections'::regclass 
AND conname LIKE '%variant%';

COMMENT ON CONSTRAINT user_collections_variant_check ON user_collections IS 'Ensures variant is one of the valid types including 1st_edition';