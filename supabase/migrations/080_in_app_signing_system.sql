-- =============================================================================
-- In-App Signing System (Phase 1)
-- Replaces DocuSign with a minimal-but-legally-strong signing flow.
-- Tables: contract_versions, signature_events (append-only audit)
-- =============================================================================

-- =============================================================================
-- 1. Contract ID sequence (HC-YYYY-NNNNNN format)
-- =============================================================================
CREATE SEQUENCE IF NOT EXISTS contract_id_seq START 1;

-- Function to generate next Contract ID (e.g. HC-2026-000123)
CREATE OR REPLACE FUNCTION generate_contract_id()
RETURNS TEXT AS $$
DECLARE
  v_year TEXT;
  v_seq INTEGER;
  v_id TEXT;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');
  v_seq := nextval('contract_id_seq');
  v_id := 'HC-' || v_year || '-' || LPAD(v_seq::TEXT, 6, '0');
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Add contract_id to hunt_contracts (nullable for existing; set when ready_to_sign)
ALTER TABLE hunt_contracts ADD COLUMN IF NOT EXISTS contract_id TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_hunt_contracts_contract_id ON hunt_contracts(contract_id);

-- =============================================================================
-- 2. Contract Versions (immutable PDF snapshots)
-- =============================================================================
CREATE TABLE IF NOT EXISTS contract_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES hunt_contracts(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready_to_sign', 'signed_locked')),
  -- PDF snapshot
  storage_path TEXT NOT NULL,
  file_size_bytes BIGINT,
  sha256_hash TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Contract ID for PDF footer (e.g. HC-2026-000123)
  display_contract_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contract_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_contract_versions_contract ON contract_versions(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_versions_status ON contract_versions(status);

COMMENT ON TABLE contract_versions IS 'Immutable PDF snapshots per version. Once signed_locked, no updates.';

-- =============================================================================
-- 3. Signature Events (append-only audit ledger)
-- =============================================================================
CREATE TABLE IF NOT EXISTS signature_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  contract_id UUID NOT NULL REFERENCES hunt_contracts(id) ON DELETE CASCADE,
  version_id UUID REFERENCES contract_versions(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_role TEXT,  -- 'client' | 'admin' | 'system'
  user_email TEXT,
  typed_name TEXT,  -- For signed event: signer's typed legal name
  timestamp_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signature_events_contract ON signature_events(contract_id);
CREATE INDEX IF NOT EXISTS idx_signature_events_version ON signature_events(version_id);
CREATE INDEX IF NOT EXISTS idx_signature_events_type ON signature_events(event_type);
CREATE INDEX IF NOT EXISTS idx_signature_events_timestamp ON signature_events(timestamp_utc);

COMMENT ON TABLE signature_events IS 'Append-only audit ledger. event_type: version_created, version_hash_recorded, econsent_given, version_viewed, signed, certificate_generated, version_locked, signed_copy_emailed, fully_executed';

-- RLS: Append-only (INSERT only for authorized; no UPDATE/DELETE)
ALTER TABLE signature_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access signature_events" ON signature_events;
CREATE POLICY "Service role full access signature_events"
  ON signature_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can only INSERT (via API with proper checks)
-- No SELECT/UPDATE/DELETE for regular users - admin views via service role
DROP POLICY IF EXISTS "Allow insert signature_events" ON signature_events;
CREATE POLICY "Allow insert signature_events"
  ON signature_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Admins/owners can SELECT their outfitter's events
DROP POLICY IF EXISTS "Admins can read signature_events" ON signature_events;
CREATE POLICY "Admins can read signature_events"
  ON signature_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hunt_contracts hc
      JOIN outfitter_memberships om ON om.outfitter_id = hc.outfitter_id AND om.user_id = auth.uid()
      WHERE hc.id = signature_events.contract_id
        AND om.status = 'active'
        AND om.role IN ('owner', 'admin')
    )
  );

-- Clients can SELECT events for their own contracts
DROP POLICY IF EXISTS "Clients can read own signature_events" ON signature_events;
CREATE POLICY "Clients can read own signature_events"
  ON signature_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hunt_contracts hc
      WHERE hc.id = signature_events.contract_id
        AND hc.client_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- =============================================================================
-- 4. RLS for contract_versions
-- =============================================================================
ALTER TABLE contract_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access contract_versions" ON contract_versions;
CREATE POLICY "Service role full access contract_versions"
  ON contract_versions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can manage contract_versions" ON contract_versions;
CREATE POLICY "Admins can manage contract_versions"
  ON contract_versions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hunt_contracts hc
      JOIN outfitter_memberships om ON om.outfitter_id = hc.outfitter_id AND om.user_id = auth.uid()
      WHERE hc.id = contract_versions.contract_id
        AND om.status = 'active'
        AND om.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Clients can view contract_versions for own" ON contract_versions;
CREATE POLICY "Clients can view contract_versions for own"
  ON contract_versions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hunt_contracts hc
      WHERE hc.id = contract_versions.contract_id
        AND hc.client_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- =============================================================================
-- 5. Storage bucket: contract-documents
-- Create bucket manually: Supabase Dashboard → Storage → New bucket → contract-documents (private)
-- Path format: {outfitter_id}/{contract_id}/v{version}_unsigned.pdf | v{version}_signed.pdf | v{version}_certificate.pdf
-- =============================================================================
-- Policies for contract-documents (bucket must exist)
DROP POLICY IF EXISTS "Service role full access contract-documents" ON storage.objects;
CREATE POLICY "Service role full access contract-documents"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'contract-documents')
  WITH CHECK (bucket_id = 'contract-documents');

-- Admins can read/write their outfitter's folder
DROP POLICY IF EXISTS "Admins can manage contract-documents" ON storage.objects;
CREATE POLICY "Admins can manage contract-documents"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'contract-documents'
    AND EXISTS (
      SELECT 1 FROM outfitter_memberships om
      WHERE om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('owner', 'admin')
        AND LOWER((storage.foldername(name))[1]) = LOWER(om.outfitter_id::text)
    )
  )
  WITH CHECK (
    bucket_id = 'contract-documents'
    AND EXISTS (
      SELECT 1 FROM outfitter_memberships om
      WHERE om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('owner', 'admin')
        AND LOWER((storage.foldername(name))[1]) = LOWER(om.outfitter_id::text)
    )
  );

-- Clients can read (signed PDFs) for their linked outfitter
DROP POLICY IF EXISTS "Clients can read contract-documents" ON storage.objects;
CREATE POLICY "Clients can read contract-documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'contract-documents'
    AND EXISTS (
      SELECT 1 FROM clients c
      JOIN client_outfitter_links col ON col.client_id = c.id AND col.is_active
      WHERE c.email = (SELECT email FROM auth.users WHERE id = auth.uid())
        AND LOWER((storage.foldername(name))[1]) = LOWER(col.outfitter_id::text)
    )
  );

-- =============================================================================
-- 6. Consent text version (for audit)
-- =============================================================================
CREATE TABLE IF NOT EXISTS econsent_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL UNIQUE,
  consent_text TEXT NOT NULL,
  effective_from TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE econsent_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read econsent_versions" ON econsent_versions;
CREATE POLICY "Anyone can read econsent_versions"
  ON econsent_versions FOR SELECT
  TO authenticated
  USING (true);

-- Insert default consent version
INSERT INTO econsent_versions (version, consent_text) VALUES
  ('1.0', E'ELECTRONIC SIGNATURES AND RECORDS DISCLOSURE

You agree to use electronic signatures and electronic records. You may withdraw consent by contacting your outfitter. You can download a copy of this document for your records at any time.

By clicking "I consent" below, you acknowledge that you have read and agree to the foregoing.')
ON CONFLICT (version) DO NOTHING;

COMMENT ON TABLE econsent_versions IS 'Tracks consent text versions for audit (consent_text_version in signature_events)';
