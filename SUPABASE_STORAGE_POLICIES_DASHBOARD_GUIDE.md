# Supabase Storage Policies Setup Guide (Dashboard)

Since storage policies cannot be created via SQL migrations, you need to set them up through the Supabase Dashboard.

## 🔧 Setting Up Storage Policies via Dashboard

### Step 1: Navigate to Storage Policies
1. Go to **Supabase Dashboard**
2. Select your project
3. Go to **Storage** > **Policies**

### Step 2: Create Policies for Each Bucket

#### For `card-images` bucket:

**Policy 1: Public Read Access**
- **Policy name**: `Public read access for card images`
- **Allowed operation**: `SELECT`
- **Target roles**: `public`
- **Policy definition**: 
  ```sql
  bucket_id = 'card-images'
  ```

**Policy 2: Service Role Upload**
- **Policy name**: `Service role can upload card images`
- **Allowed operation**: `INSERT`
- **Target roles**: `service_role`
- **Policy definition**: 
  ```sql
  bucket_id = 'card-images'
  ```

**Policy 3: Service Role Update**
- **Policy name**: `Service role can update card images`
- **Allowed operation**: `UPDATE`
- **Target roles**: `service_role`
- **Policy definition**: 
  ```sql
  bucket_id = 'card-images'
  ```

**Policy 4: Service Role Delete**
- **Policy name**: `Service role can delete card images`
- **Allowed operation**: `DELETE`
- **Target roles**: `service_role`
- **Policy definition**: 
  ```sql
  bucket_id = 'card-images'
  ```

#### For `set-images` bucket:

**Policy 1: Public Read Access**
- **Policy name**: `Public read access for set images`
- **Allowed operation**: `SELECT`
- **Target roles**: `public`
- **Policy definition**: 
  ```sql
  bucket_id = 'set-images'
  ```

**Policy 2: Service Role Upload**
- **Policy name**: `Service role can upload set images`
- **Allowed operation**: `INSERT`
- **Target roles**: `service_role`
- **Policy definition**: 
  ```sql
  bucket_id = 'set-images'
  ```

**Policy 3: Service Role Update**
- **Policy name**: `Service role can update set images`
- **Allowed operation**: `UPDATE`
- **Target roles**: `service_role`
- **Policy definition**: 
  ```sql
  bucket_id = 'set-images'
  ```

**Policy 4: Service Role Delete**
- **Policy name**: `Service role can delete set images`
- **Allowed operation**: `DELETE`
- **Target roles**: `service_role`
- **Policy definition**: 
  ```sql
  bucket_id = 'set-images'
  ```

#### For `profile-pictures` bucket:

**Policy 1: Public Read Access**
- **Policy name**: `Public read access for profile pictures`
- **Allowed operation**: `SELECT`
- **Target roles**: `public`
- **Policy definition**: 
  ```sql
  bucket_id = 'profile-pictures'
  ```

**Policy 2: Users Upload Own**
- **Policy name**: `Users can upload their own profile pictures`
- **Allowed operation**: `INSERT`
- **Target roles**: `authenticated`
- **Policy definition**: 
  ```sql
  bucket_id = 'profile-pictures' AND auth.uid()::text = (storage.foldername(name))[1]
  ```

**Policy 3: Users Update Own**
- **Policy name**: `Users can update their own profile pictures`
- **Allowed operation**: `UPDATE`
- **Target roles**: `authenticated`
- **Policy definition**: 
  ```sql
  bucket_id = 'profile-pictures' AND auth.uid()::text = (storage.foldername(name))[1]
  ```

**Policy 4: Users Delete Own**
- **Policy name**: `Users can delete their own profile pictures`
- **Allowed operation**: `DELETE`
- **Target roles**: `authenticated`
- **Policy definition**: 
  ```sql
  bucket_id = 'profile-pictures' AND auth.uid()::text = (storage.foldername(name))[1]
  ```

#### For `banner-pictures` bucket:

**Policy 1: Public Read Access**
- **Policy name**: `Public read access for banner pictures`
- **Allowed operation**: `SELECT`
- **Target roles**: `public`
- **Policy definition**: 
  ```sql
  bucket_id = 'banner-pictures'
  ```

**Policy 2: Users Upload Own**
- **Policy name**: `Users can upload their own banner pictures`
- **Allowed operation**: `INSERT`
- **Target roles**: `authenticated`
- **Policy definition**: 
  ```sql
  bucket_id = 'banner-pictures' AND auth.uid()::text = (storage.foldername(name))[1]
  ```

**Policy 3: Users Update Own**
- **Policy name**: `Users can update their own banner pictures`
- **Allowed operation**: `UPDATE`
- **Target roles**: `authenticated`
- **Policy definition**: 
  ```sql
  bucket_id = 'banner-pictures' AND auth.uid()::text = (storage.foldername(name))[1]
  ```

**Policy 4: Users Delete Own**
- **Policy name**: `Users can delete their own banner pictures`
- **Allowed operation**: `DELETE`
- **Target roles**: `authenticated`
- **Policy definition**: 
  ```sql
  bucket_id = 'banner-pictures' AND auth.uid()::text = (storage.foldername(name))[1]
  ```

## 🔒 Security Summary

- **Card & Set Images**: Only service role can manage, public can read
- **Profile & Banner Images**: Users can manage their own (folder-based), public can read
- **Folder Structure**: User images stored as `{user-id}/filename.ext`

## ✅ Verification

After creating all policies, verify by:
1. Checking that all buckets show the correct number of policies
2. Testing image upload with your migration script
3. Testing user profile/banner image upload functionality

## 📝 Notes

- **Service Role**: Used by migration scripts and admin functions
- **Authenticated**: Regular logged-in users
- **Public**: Anyone (including anonymous users)
- **Folder Security**: `(storage.foldername(name))[1]` extracts the first folder name (user ID)