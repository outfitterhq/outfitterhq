-- Fix: createSignedURL was failing with "new row violates row-level security policy" for clients.
-- FOR ALL policies apply WITH CHECK in some code paths; splitting into SELECT (read) vs INSERT/UPDATE
-- so client reads (signed URLs) only need USING, and only outfitters can write.

-- Drop old and any existing 065 policy names so this migration is idempotent.
DROP POLICY IF EXISTS "Authenticated upload read hunt-photos" ON storage.objects;
DROP POLICY IF EXISTS "hunt-photos authenticated read" ON storage.objects;
DROP POLICY IF EXISTS "hunt-photos authenticated insert" ON storage.objects;
DROP POLICY IF EXISTS "hunt-photos authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "hunt-photos authenticated delete" ON storage.objects;

-- SELECT only: outfitters and linked clients can read (createSignedURL uses this).
-- Path format: {outfitter_id}/hunt-closeouts/... so first path segment = outfitter_id.
CREATE POLICY "hunt-photos authenticated read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'hunt-photos'
  AND (
    EXISTS (
      SELECT 1 FROM outfitter_memberships om
      WHERE om.user_id = auth.uid()
        AND om.status = 'active'
        AND LOWER((storage.foldername(name))[1]) = LOWER(om.outfitter_id::text)
    )
    OR
    EXISTS (
      SELECT 1 FROM clients c
      JOIN client_outfitter_links col ON col.client_id = c.id AND col.is_active = true
      WHERE LOWER(c.email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
        AND LOWER((storage.foldername(name))[1]) = LOWER(col.outfitter_id::text)
    )
  )
);

-- INSERT: only outfitter members (no client uploads).
CREATE POLICY "hunt-photos authenticated insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'hunt-photos'
  AND EXISTS (
    SELECT 1 FROM outfitter_memberships om
    WHERE om.user_id = auth.uid()
      AND om.status = 'active'
      AND LOWER((storage.foldername(name))[1]) = LOWER(om.outfitter_id::text)
  )
);

-- UPDATE: only outfitter members.
CREATE POLICY "hunt-photos authenticated update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'hunt-photos'
  AND EXISTS (
    SELECT 1 FROM outfitter_memberships om
    WHERE om.user_id = auth.uid()
      AND om.status = 'active'
      AND LOWER((storage.foldername(name))[1]) = LOWER(om.outfitter_id::text)
  )
)
WITH CHECK (
  bucket_id = 'hunt-photos'
  AND EXISTS (
    SELECT 1 FROM outfitter_memberships om
    WHERE om.user_id = auth.uid()
      AND om.status = 'active'
      AND LOWER((storage.foldername(name))[1]) = LOWER(om.outfitter_id::text)
  )
);

-- DELETE: only outfitter members.
CREATE POLICY "hunt-photos authenticated delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'hunt-photos'
  AND EXISTS (
    SELECT 1 FROM outfitter_memberships om
    WHERE om.user_id = auth.uid()
      AND om.status = 'active'
      AND LOWER((storage.foldername(name))[1]) = LOWER(om.outfitter_id::text)
  )
);
