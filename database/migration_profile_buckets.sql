-- ============================================================
-- Lumidex – Profile Storage Buckets Migration
-- Creates the `avatars` and `banners` Supabase Storage buckets
-- with public read + owner-only write RLS policies.
-- Run once in Supabase SQL editor.
-- ============================================================

-- ── Create buckets ───────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'avatars',
    'avatars',
    true,
    2097152,   -- 2 MB
    array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
  )
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'banners',
    'banners',
    true,
    5242880,   -- 5 MB
    array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
  )
on conflict (id) do nothing;

-- ── RLS: avatars bucket ──────────────────────────────────────

-- Public read: anyone can view avatars
create policy "Avatars are publicly readable."
  on storage.objects for select
  using ( bucket_id = 'avatars' );

-- Owner upload: users can only upload to their own folder ({userId}/*)
create policy "Users can upload their own avatar."
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner update: users can overwrite their own avatar
create policy "Users can update their own avatar."
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner delete: users can remove their own avatar
create policy "Users can delete their own avatar."
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── RLS: banners bucket ──────────────────────────────────────

-- Public read
create policy "Banners are publicly readable."
  on storage.objects for select
  using ( bucket_id = 'banners' );

-- Owner upload
create policy "Users can upload their own banner."
  on storage.objects for insert
  with check (
    bucket_id = 'banners'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner update
create policy "Users can update their own banner."
  on storage.objects for update
  using (
    bucket_id = 'banners'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner delete
create policy "Users can delete their own banner."
  on storage.objects for delete
  using (
    bucket_id = 'banners'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );
