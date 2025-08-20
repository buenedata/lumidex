-- Storage RLS Policies for Pokemon TCG Collection App
-- Run this AFTER creating the storage buckets via Supabase Dashboard

-- =============================================================================
-- CARD IMAGES BUCKET POLICIES
-- =============================================================================

-- Allow public read access for card images
CREATE POLICY "Public read access for card images" ON storage.objects
FOR SELECT USING (bucket_id = 'card-images');

-- Allow only service role to upload card images (admin/migration functions only)
CREATE POLICY "Service role can upload card images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'card-images'
  AND auth.role() = 'service_role'
);

-- Allow only service role to update card images (admin/migration functions only)
CREATE POLICY "Service role can update card images" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'card-images'
  AND auth.role() = 'service_role'
);

-- Allow only service role to delete card images (admin/migration functions only)
CREATE POLICY "Service role can delete card images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'card-images'
  AND auth.role() = 'service_role'
);

-- =============================================================================
-- SET IMAGES BUCKET POLICIES
-- =============================================================================

-- Allow public read access for set images
CREATE POLICY "Public read access for set images" ON storage.objects
FOR SELECT USING (bucket_id = 'set-images');

-- Allow only service role to upload set images (admin functions only)
CREATE POLICY "Service role can upload set images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'set-images'
  AND auth.role() = 'service_role'
);

-- Allow only service role to update set images (admin functions only)
CREATE POLICY "Service role can update set images" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'set-images'
  AND auth.role() = 'service_role'
);

-- Allow only service role to delete set images (admin functions only)
CREATE POLICY "Service role can delete set images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'set-images'
  AND auth.role() = 'service_role'
);

-- =============================================================================
-- PROFILE PICTURES BUCKET POLICIES
-- =============================================================================

-- Allow public read access for profile pictures
CREATE POLICY "Public read access for profile pictures" ON storage.objects
FOR SELECT USING (bucket_id = 'profile-pictures');

-- Allow users to upload their own profile pictures
-- Files should be organized as: {user-id}/profile.{ext}
-- Users upload from their computer and can replace existing images
CREATE POLICY "Users can upload their own profile pictures" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'profile-pictures'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own profile pictures (when replacing)
CREATE POLICY "Users can update their own profile pictures" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'profile-pictures'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own profile pictures (when replacing with new)
CREATE POLICY "Users can delete their own profile pictures" ON storage.objects
FOR DELETE USING (
  bucket_id = 'profile-pictures'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- =============================================================================
-- BANNER PICTURES BUCKET POLICIES
-- =============================================================================

-- Allow public read access for banner pictures
CREATE POLICY "Public read access for banner pictures" ON storage.objects
FOR SELECT USING (bucket_id = 'banner-pictures');

-- Allow users to upload their own banner pictures
-- Files should be organized as: {user-id}/banner.{ext}
-- Users upload from their computer and can replace existing images
CREATE POLICY "Users can upload their own banner pictures" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'banner-pictures'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own banner pictures (when replacing)
CREATE POLICY "Users can update their own banner pictures" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'banner-pictures'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own banner pictures (when replacing with new)
CREATE POLICY "Users can delete their own banner pictures" ON storage.objects
FOR DELETE USING (
  bucket_id = 'banner-pictures'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- =============================================================================
-- PERFORMANCE INDEXES
-- =============================================================================

-- Create indexes for better performance on storage queries
CREATE INDEX IF NOT EXISTS idx_storage_objects_bucket_id ON storage.objects(bucket_id);
CREATE INDEX IF NOT EXISTS idx_storage_objects_name ON storage.objects(name);
CREATE INDEX IF NOT EXISTS idx_storage_objects_bucket_name ON storage.objects(bucket_id, name);
CREATE INDEX IF NOT EXISTS idx_storage_objects_owner ON storage.objects(owner);

-- =============================================================================
-- HELPFUL COMMENTS
-- =============================================================================

COMMENT ON POLICY "Public read access for card images" ON storage.objects
IS 'Allow public access to Pokemon card images for fast loading in the app';

COMMENT ON POLICY "Service role can upload card images" ON storage.objects
IS 'Only service role (admin/migration scripts) can manage card images - users cannot upload these';

COMMENT ON POLICY "Public read access for set images" ON storage.objects
IS 'Allow public access to set logos, symbols, and backgrounds';

COMMENT ON POLICY "Service role can upload set images" ON storage.objects
IS 'Only service role (admin/migration scripts) can manage set images - users cannot upload these';

COMMENT ON POLICY "Users can upload their own profile pictures" ON storage.objects
IS 'Users can upload profile pictures from their computer and replace existing ones (old deleted, new uploaded)';

COMMENT ON POLICY "Users can upload their own banner pictures" ON storage.objects
IS 'Users can upload banner pictures from their computer and replace existing ones (old deleted, new uploaded)';

-- =============================================================================
-- VERIFICATION QUERY
-- =============================================================================

-- Run this to verify all policies are created correctly
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
ORDER BY policyname;