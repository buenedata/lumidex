-- Add banner_url column to profiles table if it doesn't exist
-- This script is safe to run multiple times

DO $$ 
BEGIN
    -- Check if banner_url column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'banner_url'
    ) THEN
        -- Add the banner_url column
        ALTER TABLE profiles ADD COLUMN banner_url TEXT;
        RAISE NOTICE 'Added banner_url column to profiles table';
    ELSE
        RAISE NOTICE 'banner_url column already exists in profiles table';
    END IF;
END $$;

-- Verify the columns exist
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name IN ('avatar_url', 'banner_url')
ORDER BY column_name;