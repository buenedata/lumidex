-- Add setup completion tracking to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS setup_completed BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS setup_completed_at TIMESTAMPTZ;

-- Update existing users to have setup completed (since they're already using the app)
UPDATE profiles 
SET setup_completed = true, setup_completed_at = NOW() 
WHERE setup_completed IS NULL OR setup_completed = false;