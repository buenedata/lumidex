-- Storage buckets setup for Pokemon TCG Collection app
-- Note: Buckets must be created via Supabase Dashboard or API, not SQL
-- This file documents the required bucket configuration

/*
BUCKET CONFIGURATION FOR SUPABASE DASHBOARD:

1. card-images
   - Public: true
   - File size limit: 5MB (5242880 bytes)
   - Allowed MIME types: image/jpeg, image/png, image/webp, image/avif
   - Description: Pokemon card images (small and large)

2. set-images
   - Public: true
   - File size limit: 10MB (10485760 bytes)
   - Allowed MIME types: image/jpeg, image/png, image/webp, image/avif, image/svg+xml
   - Description: Set logos, symbols, and background images

3. profile-pictures
   - Public: true
   - File size limit: 2MB (2097152 bytes)
   - Allowed MIME types: image/jpeg, image/png, image/webp, image/avif
   - Description: User profile pictures

4. banner-pictures
   - Public: true
   - File size limit: 5MB (5242880 bytes)
   - Allowed MIME types: image/jpeg, image/png, image/webp, image/avif
   - Description: User banner/cover pictures
*/

-- RLS policies will be automatically created when buckets are set up via dashboard
-- The policies below are for reference and will be applied automatically:

/*
AUTOMATIC RLS POLICIES CREATED:

For card-images and set-images buckets:
- Public read access (anyone can view images)
- Authenticated users can upload/update (for admin functions)

For profile-pictures and banner-pictures buckets:
- Public read access (anyone can view profile/banner images)
- Users can only upload/update/delete their own images (folder-based security)
- Folder structure: {user-id}/filename.ext

MANUAL SETUP STEPS:
1. Go to Supabase Dashboard > Storage
2. Create the 4 buckets listed above with specified settings
3. Policies will be automatically configured for public read access
4. For user-specific buckets, ensure folder-based RLS is enabled
*/

-- This migration serves as documentation only
-- Actual bucket creation must be done via Supabase Dashboard
SELECT 'Storage buckets must be created via Supabase Dashboard - see comments above for configuration' as setup_instructions;