-- Storage policies for hunt-photos bucket
-- Run in Supabase SQL Editor. Create the bucket in Storage UI first if needed (name: hunt-photos).
-- Bucket id in storage.objects is lowercase; if your bucket shows as "HUNT-PHOTOS", the id is still 'hunt-photos'.

-- 1) Service role: full access (used by closeout API to upload and by signed URL generation)
DROP POLICY IF EXISTS "Service role full access hunt-photos" ON storage.objects;
CREATE POLICY "Service role full access hunt-photos"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'hunt-photos')
WITH CHECK (bucket_id = 'hunt-photos');

-- 2) Authenticated users: upload and read only in their outfitter's folder (path: {outfitter_id}/...)
DROP POLICY IF EXISTS "Authenticated upload read hunt-photos" ON storage.objects;
CREATE POLICY "Authenticated upload read hunt-photos"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'hunt-photos'
  AND EXISTS (
    SELECT 1 FROM outfitter_memberships om
    WHERE om.user_id = auth.uid()
      AND om.status = 'active'
      AND (storage.foldername(name))[1] = om.outfitter_id::text
  )
)
WITH CHECK (
  bucket_id = 'hunt-photos'
  AND EXISTS (
    SELECT 1 FROM outfitter_memberships om
    WHERE om.user_id = auth.uid()
      AND om.status = 'active'
      AND (storage.foldername(name))[1] = om.outfitter_id::text
  )
);
