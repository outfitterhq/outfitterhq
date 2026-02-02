-- Client Account Sync + Admin Review: documents table and signing fields
-- Ensures documents exist with document_type, status, and signing timestamps.

-- Create documents table if it doesn't exist (used by API but may not be in migrations)
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outfitter_id UUID NOT NULL REFERENCES outfitters(id) ON DELETE CASCADE,
  linked_type TEXT,
  linked_id TEXT,
  storage_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add document_type: contract | waiver | questionnaire | other
ALTER TABLE documents ADD COLUMN IF NOT EXISTS document_type TEXT
  CHECK (document_type IS NULL OR document_type IN ('contract', 'waiver', 'questionnaire', 'other'));

-- Add status: not_submitted | submitted | client_signed | admin_signed | fully_executed
ALTER TABLE documents ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'not_submitted'
  CHECK (status IN ('not_submitted', 'submitted', 'client_signed', 'admin_signed', 'fully_executed'));

-- Signing timestamps
ALTER TABLE documents ADD COLUMN IF NOT EXISTS client_signed_at TIMESTAMPTZ;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS admin_signed_at TIMESTAMPTZ;

-- Indexes for client + outfitter lookups
CREATE INDEX IF NOT EXISTS idx_documents_outfitter ON documents(outfitter_id);
CREATE INDEX IF NOT EXISTS idx_documents_linked ON documents(outfitter_id, linked_id) WHERE linked_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status) WHERE status IS NOT NULL;

-- RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view documents for their outfitters" ON documents;
CREATE POLICY "Users can view documents for their outfitters"
  ON documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM outfitter_memberships
      WHERE outfitter_memberships.outfitter_id = documents.outfitter_id
        AND outfitter_memberships.user_id = auth.uid()
        AND outfitter_memberships.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Owners and admins can manage documents" ON documents;
CREATE POLICY "Owners and admins can manage documents"
  ON documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM outfitter_memberships
      WHERE outfitter_memberships.outfitter_id = documents.outfitter_id
        AND outfitter_memberships.user_id = auth.uid()
        AND outfitter_memberships.status = 'active'
        AND outfitter_memberships.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM outfitter_memberships
      WHERE outfitter_memberships.outfitter_id = documents.outfitter_id
        AND outfitter_memberships.user_id = auth.uid()
        AND outfitter_memberships.status = 'active'
        AND outfitter_memberships.role IN ('owner', 'admin')
    )
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS documents_updated_at ON documents;
CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_documents_updated_at();
