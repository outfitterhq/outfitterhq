-- Fix hunt-photos storage policies for iOS signed URL generation
-- The createSignedURL was failing with RLS error. This ensures SELECT works properly.

-- Drop all existing hunt-photos policies to start clean
DROP POLICY IF EXISTS "Authenticated upload read hunt-photos" ON storage.objects;
DROP POLICY IF EXISTS "hunt-photos authenticated read" ON storage.objects;
DROP POLICY IF EXISTS "hunt-photos authenticated insert" ON storage.objects;
DROP POLICY IF EXISTS "hunt-photos authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "hunt-photos authenticated delete" ON storage.objects;
DROP POLICY IF EXISTS "Service role full access hunt-photos" ON storage.objects;

-- 1) Service role: full access (used by API)
CREATE POLICY "Service role full access hunt-photos"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'hunt-photos')
WITH CHECK (bucket_id = 'hunt-photos');

-- 2) SELECT (read/download/signed URL): allow outfitter members and linked clients
-- Using LOWER on both sides for case-insensitive matching
CREATE POLICY "hunt-photos read access"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'hunt-photos'
  AND (
    -- Outfitter members can read their outfitter's photos
    EXISTS (
      SELECT 1 FROM outfitter_memberships om
      WHERE om.user_id = auth.uid()
        AND om.status = 'active'
        AND LOWER((storage.foldername(name))[1]) = LOWER(om.outfitter_id::text)
    )
    OR
    -- Clients can read photos from their linked outfitter
    EXISTS (
      SELECT 1 FROM clients c
      WHERE LOWER(c.email) = LOWER(auth.jwt() ->> 'email')
        AND LOWER((storage.foldername(name))[1]) = LOWER(c.outfitter_id::text)
    )
  )
);

-- 3) INSERT: only outfitter members can upload
CREATE POLICY "hunt-photos insert access"
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

-- 4) UPDATE: only outfitter members
CREATE POLICY "hunt-photos update access"
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

-- 5) DELETE: only outfitter members
CREATE POLICY "hunt-photos delete access"
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

-- Also fix lodge-photos storage policies while we're at it
DROP POLICY IF EXISTS "lodge-photos read access" ON storage.objects;
DROP POLICY IF EXISTS "lodge-photos insert access" ON storage.objects;
DROP POLICY IF EXISTS "lodge-photos update access" ON storage.objects;
DROP POLICY IF EXISTS "lodge-photos delete access" ON storage.objects;
DROP POLICY IF EXISTS "Service role full access lodge-photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read lodge-photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload lodge-photos" ON storage.objects;

-- Service role full access for lodge-photos
CREATE POLICY "Service role full access lodge-photos"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'lodge-photos')
WITH CHECK (bucket_id = 'lodge-photos');

-- SELECT: all authenticated users can read lodge photos
CREATE POLICY "lodge-photos read access"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'lodge-photos');

-- INSERT/UPDATE/DELETE: only outfitter members
CREATE POLICY "lodge-photos write access"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'lodge-photos'
  AND EXISTS (
    SELECT 1 FROM outfitter_memberships om
    WHERE om.user_id = auth.uid()
      AND om.status = 'active'
  )
);

CREATE POLICY "lodge-photos update access"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'lodge-photos'
  AND EXISTS (
    SELECT 1 FROM outfitter_memberships om
    WHERE om.user_id = auth.uid()
      AND om.status = 'active'
  )
)
WITH CHECK (
  bucket_id = 'lodge-photos'
  AND EXISTS (
    SELECT 1 FROM outfitter_memberships om
    WHERE om.user_id = auth.uid()
      AND om.status = 'active'
  )
);

CREATE POLICY "lodge-photos delete access"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'lodge-photos'
  AND EXISTS (
    SELECT 1 FROM outfitter_memberships om
    WHERE om.user_id = auth.uid()
      AND om.status = 'active'
  )
);
