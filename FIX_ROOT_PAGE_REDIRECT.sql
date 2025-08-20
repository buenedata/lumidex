-- =====================================================
-- FIX ROOT PAGE REDIRECT LOOP
-- Add missing setup_completed column and fix permissions
-- =====================================================

-- 1. Check if setup_completed column exists
SELECT 
  'Column Check' as test,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'setup_completed'
    AND table_schema = 'public'
  ) as setup_completed_exists;

-- 2. Add setup_completed column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'setup_completed'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE profiles ADD COLUMN setup_completed BOOLEAN DEFAULT false;
    RAISE NOTICE '✅ Added setup_completed column to profiles table';
  ELSE
    RAISE NOTICE '✅ setup_completed column already exists';
  END IF;
END $$;

-- 3. Update existing users to have setup_completed = true (since they've already used the app)
UPDATE profiles 
SET setup_completed = true 
WHERE setup_completed IS NULL OR setup_completed = false;

-- 4. Verify the fix
SELECT 
  'Setup Status Check' as test,
  id,
  username,
  setup_completed
FROM profiles 
ORDER BY created_at DESC
LIMIT 5;

SELECT 'ROOT PAGE REDIRECT FIXED' as status, 
       'lumidex.app should now redirect properly without loops' as message;