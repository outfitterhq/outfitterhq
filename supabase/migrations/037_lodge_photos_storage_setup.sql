-- Migration: Setup storage bucket for lodge photos
-- Note: Storage buckets must be created manually in Supabase Dashboard
-- This migration documents the required bucket configuration

-- Storage bucket name: "lodge-photos"
-- 
-- To create the bucket:
-- 1. Go to Supabase Dashboard → Storage
-- 2. Click "New bucket"
-- 3. Name: "lodge-photos"
-- 4. Public: false (private bucket)
-- 5. File size limit: 10MB
-- 6. Allowed MIME types: image/jpeg, image/jpg, image/png, image/webp
--
-- Storage policies will be handled by RLS on lodge_photos table
-- The API endpoints generate signed URLs for client access

COMMENT ON TABLE lodge_photos IS 'Lodge photo gallery. Storage bucket: lodge-photos (private, 10MB max, images only)';
