-- Allow clients to READ hunt-photos for their linked outfitter (so Past Success photos show in iOS).
-- Run this in Supabase: SQL Editor → New query → paste and Run.
-- Keep your existing "Service role full access hunt-photos" policy; this only updates the authenticated policy.

-- Drop the existing authenticated policy (outfitter-only)
DROP POLICY IF EXISTS "Authenticated upload read hunt-photos" ON storage.objects;

-- Recreate: outfitter members can upload+read; clients can READ their linked outfitter's folder only.
-- Object paths in hunt-photos must be: {outfitter_id}/{filename} (first path segment = outfitter_id).
CREATE POLICY "Authenticated upload read hunt-photos"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'hunt-photos'
  AND (
    -- Outfitter members: read/upload their outfitter's folder
    EXISTS (
      SELECT 1 FROM outfitter_memberships om
      WHERE om.user_id = auth.uid()
        AND om.status = 'active'
        AND (storage.foldername(name))[1] = om.outfitter_id::text
    )
    OR
    -- Clients: read-only their linked outfitter's folder (for Past Success signed URLs)
    EXISTS (
      SELECT 1 FROM clients c
      JOIN client_outfitter_links col ON col.client_id = c.id AND col.is_active = true
      WHERE c.email = (SELECT email FROM auth.users WHERE id = auth.uid())
        AND (storage.foldername(name))[1] = col.outfitter_id::text
    )
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
