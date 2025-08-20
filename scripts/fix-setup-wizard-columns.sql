-- Fix Setup Wizard Issue - Add Missing Columns
-- This script adds the missing columns that cause the setup wizard to always appear
-- Run this if you're experiencing the setup wizard showing on every visit to localhost:3000

-- Add setup completion tracking columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS setup_completed BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS setup_completed_at TIMESTAMPTZ;

-- Add preferred price source column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_price_source TEXT DEFAULT 'cardmarket';

-- Add constraint for preferred_price_source if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'profiles_preferred_price_source_check'
    ) THEN
        ALTER TABLE profiles ADD CONSTRAINT profiles_preferred_price_source_check 
        CHECK (preferred_price_source IN ('cardmarket', 'tcgplayer'));
    END IF;
END $$;

-- Update existing users to have setup completed (optional - uncomment if needed)
-- UPDATE profiles 
-- SET setup_completed = true, setup_completed_at = NOW() 
-- WHERE setup_completed IS NULL OR setup_completed = false;

-- Add comment to document the column
COMMENT ON COLUMN profiles.preferred_price_source IS 'User preference for price data source: cardmarket (EUR) or tcgplayer (USD)';
COMMENT ON COLUMN profiles.setup_completed IS 'Whether the user has completed the initial setup wizard';
COMMENT ON COLUMN profiles.setup_completed_at IS 'Timestamp when the user completed the setup wizard';