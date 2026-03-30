-- ============================================================
-- Migration: Add set symbol support
-- Adds symbol_url column to sets table + creates set-symbols bucket
-- Run this in the Supabase SQL editor
-- ============================================================

-- 1. Add symbol_url column to sets table
ALTER TABLE public.sets
  ADD COLUMN IF NOT EXISTS symbol_url text;

-- ============================================================
-- 2. Create the set-symbols storage bucket
--    (public = true so images can be served without auth)
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'set-symbols',
  'set-symbols',
  true,
  5242880,           -- 5 MB limit
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/svg+xml','image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. Storage RLS policies for set-symbols bucket
-- ============================================================

-- Allow anyone to read set symbol images
CREATE POLICY "Public read set-symbols"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'set-symbols');

-- Allow authenticated admins to insert new symbol images
CREATE POLICY "Admin insert set-symbols"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'set-symbols'
    AND auth.role() = 'authenticated'
  );

-- Allow authenticated admins to update (upsert) symbol images
CREATE POLICY "Admin update set-symbols"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'set-symbols'
    AND auth.role() = 'authenticated'
  );

-- Allow authenticated admins to delete symbol images
CREATE POLICY "Admin delete set-symbols"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'set-symbols'
    AND auth.role() = 'authenticated'
  );
