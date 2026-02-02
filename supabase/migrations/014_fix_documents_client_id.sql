-- Fix documents table: Add client_id column for iOS client queries
-- This fixes the "Failed to load" error in the Documents tab

-- =============================================================================
-- 1. ADD CLIENT_ID COLUMN TO DOCUMENTS TABLE
-- =============================================================================
ALTER TABLE documents ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE CASCADE;

-- Create index for client lookups
CREATE INDEX IF NOT EXISTS idx_documents_client ON documents(client_id) WHERE client_id IS NOT NULL;

-- =============================================================================
-- 2. MIGRATE EXISTING DATA (if any documents have linked_type = 'client')
-- =============================================================================
UPDATE documents 
SET client_id = linked_id::uuid 
WHERE linked_type = 'client' 
  AND linked_id IS NOT NULL 
  AND client_id IS NULL;

-- =============================================================================
-- 3. FIX CLIENT RLS POLICIES FOR DOCUMENTS
-- The policies in migration 013 reference client_id which now exists
-- =============================================================================

-- Drop and recreate client document policies with correct pattern
DROP POLICY IF EXISTS "Clients can view own documents" ON documents;
CREATE POLICY "Clients can view own documents"
  ON documents
  FOR SELECT
  USING (
    client_id IN (
      SELECT c.id FROM clients c WHERE c.email = (auth.jwt() ->> 'email')
    )
  );

DROP POLICY IF EXISTS "Clients can update own documents" ON documents;
CREATE POLICY "Clients can update own documents"
  ON documents
  FOR UPDATE
  USING (
    client_id IN (
      SELECT c.id FROM clients c WHERE c.email = (auth.jwt() ->> 'email')
    )
  );

-- Allow clients to insert documents (for waiver signatures, etc.)
DROP POLICY IF EXISTS "Clients can insert own documents" ON documents;
CREATE POLICY "Clients can insert own documents"
  ON documents
  FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT c.id FROM clients c WHERE c.email = (auth.jwt() ->> 'email')
    )
  );

-- =============================================================================
-- 4. ADD CLIENT_NAME COLUMN (for display in iOS without joining)
-- =============================================================================
ALTER TABLE documents ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS description TEXT;

-- =============================================================================
-- 5. VERIFY RLS IS ENABLED
-- =============================================================================
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Summary:
-- - Added client_id column to documents table
-- - Created index for efficient client lookups  
-- - Fixed RLS policies to use auth.jwt() ->> 'email' pattern
-- - Added helper columns (client_name, title, description)
-- 
-- The iOS ClientMyDocumentsView queries will now work:
--   .eq("client_id", value: clientId.uuidString)
-- =============================================================================
