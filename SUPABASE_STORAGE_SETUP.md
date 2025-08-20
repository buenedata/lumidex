# Supabase Storage Setup Guide

## 🚀 Quick Setup for Faster Image Loading

To dramatically improve image loading performance, create these storage buckets in your Supabase Dashboard:

### 📁 Storage Buckets to Create

Go to **Supabase Dashboard > Storage** and create these 4 buckets:

#### 1. `card-images`
- **Public**: ✅ Yes (allows reading images on website)
- **File size limit**: 5MB
- **Allowed MIME types**: `image/jpeg`, `image/png`, `image/webp`, `image/avif`
- **Purpose**: Pokemon card images (small and large)

#### 2. `set-images`
- **Public**: ✅ Yes (allows reading images on website)
- **File size limit**: 10MB
- **Allowed MIME types**: `image/jpeg`, `image/png`, `image/webp`, `image/avif`, `image/svg+xml`
- **Purpose**: Set logos, symbols, and background images

#### 3. `profile-pictures`
- **Public**: ✅ Yes (allows viewing profile pictures)
- **File size limit**: 2MB
- **Allowed MIME types**: `image/jpeg`, `image/png`, `image/webp`, `image/avif`
- **Purpose**: User profile pictures

#### 4. `banner-pictures`
- **Public**: ✅ Yes (allows viewing banner pictures)
- **File size limit**: 5MB
- **Allowed MIME types**: `image/jpeg`, `image/png`, `image/webp`, `image/avif`
- **Purpose**: User banner/cover pictures

### 🔐 Important: Public vs Upload Permissions

**"Public" bucket setting** = Anyone can **read/view** images (required for website display)
**Upload permissions** = Controlled by RLS policies (very restrictive)

This means:
- ✅ All images are viewable on your website
- ❌ Users cannot upload card/set images (service role only)
- ✅ Users can only upload their own profile/banner pictures

## 🔧 Setup Steps

### Step 1: Create Storage Buckets
Create the 4 buckets above in your Supabase Dashboard > Storage

### Step 2: Apply Storage Policies
**Important**: Storage policies must be created via the Supabase Dashboard, not SQL.

Follow the detailed guide: [`SUPABASE_STORAGE_POLICIES_DASHBOARD_GUIDE.md`](SUPABASE_STORAGE_POLICIES_DASHBOARD_GUIDE.md)

This creates RLS policies that control **who can upload/delete** (even though buckets are public for reading):
- Card/set images: Service role only
- Profile/banner images: User-specific folder security

### Step 3: Run Image Migration
```bash
node scripts/migrate-images-to-supabase.js
```

### Step 4: Verify Setup
- Check that buckets are created and public
- Verify policies are applied (see verification query in SQL file)
- Test image migration script

**Expected performance improvement**: 50-80% faster image loading

## 📋 Bucket URLs

After creation, your images will be accessible at:
```
https://[your-project].supabase.co/storage/v1/object/public/card-images/[filename]
https://[your-project].supabase.co/storage/v1/object/public/set-images/[filename]
https://[your-project].supabase.co/storage/v1/object/public/profile-pictures/[filename]
https://[your-project].supabase.co/storage/v1/object/public/banner-pictures/[filename]
```

## 🔒 Security Model Explained

### Bucket "Public" Setting
- **What it means**: Anyone can **read/view** images via URL
- **Why needed**: Your website needs to display images to all visitors
- **What it doesn't mean**: It does NOT allow anyone to upload

### RLS Policies (Upload Control)
These control **who can upload/delete**, even though buckets are public for reading:

#### Card & Set Images
- **Read**: Anyone (public bucket setting)
- **Upload/Delete**: Service role only (migration scripts, admin functions)
- **User restriction**: Regular users CANNOT upload card or set images

#### Profile & Banner Images
- **Read**: Anyone (public bucket setting)
- **Upload**: Users can upload from their computer to their own folder
- **Replace**: When users upload new image, old one is automatically deleted
- **Folder security**: `{user-id}/filename.ext` ensures users only access their own images

### Setup Files
- **Bucket creation**: [`supabase/migrations/20240110000000_create_storage_buckets.sql`](supabase/migrations/20240110000000_create_storage_buckets.sql)
- **RLS policies**: [`SUPABASE_STORAGE_POLICIES_DASHBOARD_GUIDE.md`](SUPABASE_STORAGE_POLICIES_DASHBOARD_GUIDE.md) (Dashboard setup)

## ⚡ Performance Benefits

- **Global CDN**: Images served from edge locations worldwide
- **Automatic optimization**: WebP/AVIF conversion when supported
- **Better caching**: 1-year cache TTL vs external API limitations
- **No rate limits**: Unlike external Pokemon TCG API
- **Faster loading**: Direct CDN delivery vs third-party redirects