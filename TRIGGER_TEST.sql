-- =====================================================
-- TEST IF TRIGGER IS WORKING
-- =====================================================

-- 1. Check if trigger is attached to profiles table
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'profiles'
  AND trigger_name LIKE '%wishlist%';

-- 2. Test trigger by creating a test profile
INSERT INTO profiles (
  id, 
  username, 
  display_name, 
  privacy_level, 
  show_collection_value, 
  preferred_currency, 
  preferred_language
) VALUES (
  gen_random_uuid(), 
  'test_trigger_user', 
  'Test User', 
  'public', 
  true, 
  'EUR', 
  'en'
) RETURNING id;

-- 3. Check if trigger created a wishlist for the test user
SELECT 
  wl.user_id,
  wl.name,
  wl.is_default,
  p.username
FROM wishlist_lists wl
JOIN profiles p ON wl.user_id = p.id
WHERE p.username = 'test_trigger_user';

-- 4. Clean up test data
DELETE FROM profiles WHERE username = 'test_trigger_user';