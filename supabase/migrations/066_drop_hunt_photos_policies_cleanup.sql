-- One-time cleanup: drop hunt-photos policies so 065 can run.
-- Run this in Supabase SQL Editor first if 065 fails with "policy already exists".
DROP POLICY IF EXISTS "Authenticated upload read hunt-photos" ON storage.objects;
DROP POLICY IF EXISTS "hunt-photos authenticated read" ON storage.objects;
DROP POLICY IF EXISTS "hunt-photos authenticated insert" ON storage.objects;
DROP POLICY IF EXISTS "hunt-photos authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "hunt-photos authenticated delete" ON storage.objects;
