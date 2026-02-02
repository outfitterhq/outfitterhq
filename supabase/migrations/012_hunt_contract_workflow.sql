-- Migration: Hunt Contract Workflow (Simplified - No Auto-Triggers)
-- This version creates the schema without automatic contract generation triggers
-- Contract generation can be triggered manually via API

-- =============================================================================
-- 0a. CLEAN SLATE: Drop existing objects to allow re-running migration
-- =============================================================================
DROP TRIGGER IF EXISTS trigger_generate_hunt_contract ON calendar_events;
DROP TRIGGER IF EXISTS trigger_insert_hunt_contract ON calendar_events;
DROP TRIGGER IF EXISTS trigger_lock_questionnaire_on_guide ON calendar_events;
DROP TRIGGER IF EXISTS contract_templates_updated_at ON contract_templates;
DROP TRIGGER IF EXISTS hunt_contracts_updated_at ON hunt_contracts;

DROP FUNCTION IF EXISTS generate_hunt_contract_on_tag_trigger() CASCADE;
DROP FUNCTION IF EXISTS insert_hunt_contract_after() CASCADE;
DROP FUNCTION IF EXISTS lock_questionnaire_on_guide_assignment() CASCADE;

DROP VIEW IF EXISTS hunts_pending_tag_outcome;

DROP TABLE IF EXISTS hunt_contracts CASCADE;
DROP TABLE IF EXISTS contract_templates CASCADE;

-- =============================================================================
-- 0b. Add client_email to private_land_tags for tracking purchases
-- =============================================================================
ALTER TABLE private_land_tags 
ADD COLUMN IF NOT EXISTS client_email TEXT;

ALTER TABLE private_land_tags 
ADD COLUMN IF NOT EXISTS outfitter_id UUID REFERENCES outfitters(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_private_land_tags_client ON private_land_tags(client_email) 
  WHERE client_email IS NOT NULL;

-- =============================================================================
-- 1. Add Hunt Type and Tag Status to calendar_events (hunts)
-- =============================================================================

ALTER TABLE calendar_events 
ADD COLUMN IF NOT EXISTS hunt_type TEXT DEFAULT 'draw';

DO $$ 
BEGIN
  ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS calendar_events_hunt_type_check;
  ALTER TABLE calendar_events ADD CONSTRAINT calendar_events_hunt_type_check 
    CHECK (hunt_type IN ('draw', 'private_land'));
EXCEPTION WHEN others THEN NULL;
END $$;

ALTER TABLE calendar_events 
ADD COLUMN IF NOT EXISTS tag_status TEXT DEFAULT 'pending';

DO $$ 
BEGIN
  ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS calendar_events_tag_status_check;
  ALTER TABLE calendar_events ADD CONSTRAINT calendar_events_tag_status_check 
    CHECK (tag_status IN ('pending', 'applied', 'drawn', 'unsuccessful', 'confirmed'));
EXCEPTION WHEN others THEN NULL;
END $$;

ALTER TABLE calendar_events 
ADD COLUMN IF NOT EXISTS questionnaire_locked BOOLEAN DEFAULT false;

ALTER TABLE calendar_events 
ADD COLUMN IF NOT EXISTS contract_generated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_calendar_events_tag_status ON calendar_events(tag_status);
CREATE INDEX IF NOT EXISTS idx_calendar_events_hunt_type ON calendar_events(hunt_type);

-- =============================================================================
-- 2. Contract Templates Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS contract_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outfitter_id UUID NOT NULL REFERENCES outfitters(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default Hunt Contract',
  description TEXT,
  content TEXT NOT NULL,
  template_type TEXT NOT NULL DEFAULT 'hunt_contract'
    CHECK (template_type IN ('hunt_contract', 'waiver', 'pre_draw_agreement')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_templates_outfitter ON contract_templates(outfitter_id);
CREATE INDEX IF NOT EXISTS idx_contract_templates_type ON contract_templates(template_type);

-- =============================================================================
-- 3. Hunt Contracts Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS hunt_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outfitter_id UUID NOT NULL REFERENCES outfitters(id) ON DELETE CASCADE,
  hunt_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  template_id UUID REFERENCES contract_templates(id) ON DELETE SET NULL,
  client_email TEXT NOT NULL,
  client_name TEXT,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_client_completion'
    CHECK (status IN (
      'draft',
      'pending_client_completion', 
      'ready_for_signature',
      'sent_to_docusign',
      'client_signed',
      'fully_executed',
      'cancelled'
    )),
  client_completed_at TIMESTAMPTZ,
  client_completion_data JSONB,
  docusign_envelope_id TEXT,
  docusign_status TEXT DEFAULT 'not_sent'
    CHECK (docusign_status IN ('not_sent', 'sent', 'delivered', 'signed', 'completed', 'declined', 'voided')),
  docusign_sent_at TIMESTAMPTZ,
  client_signed_at TIMESTAMPTZ,
  admin_signed_at TIMESTAMPTZ,
  signed_document_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(hunt_id)
);

CREATE INDEX IF NOT EXISTS idx_hunt_contracts_outfitter ON hunt_contracts(outfitter_id);
CREATE INDEX IF NOT EXISTS idx_hunt_contracts_hunt ON hunt_contracts(hunt_id);
CREATE INDEX IF NOT EXISTS idx_hunt_contracts_client ON hunt_contracts(client_email);
CREATE INDEX IF NOT EXISTS idx_hunt_contracts_status ON hunt_contracts(status);

-- =============================================================================
-- 4. Row Level Security for hunt_contracts
-- =============================================================================
ALTER TABLE hunt_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients can view own hunt contracts" ON hunt_contracts;
CREATE POLICY "Clients can view own hunt contracts"
  ON hunt_contracts FOR SELECT
  USING (client_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Clients can complete own hunt contracts" ON hunt_contracts;
CREATE POLICY "Clients can complete own hunt contracts"
  ON hunt_contracts FOR UPDATE
  USING (
    client_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND status = 'pending_client_completion'
  )
  WITH CHECK (client_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Guides can view assigned hunt contracts" ON hunt_contracts;
CREATE POLICY "Guides can view assigned hunt contracts"
  ON hunt_contracts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM calendar_events ce
      JOIN guides g ON (g.username = ce.guide_username OR g.email = ce.guide_username)
      WHERE ce.id = hunt_contracts.hunt_id AND g.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can manage hunt contracts" ON hunt_contracts;
CREATE POLICY "Admins can manage hunt contracts"
  ON hunt_contracts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM outfitter_memberships
      WHERE outfitter_memberships.outfitter_id = hunt_contracts.outfitter_id
        AND outfitter_memberships.user_id = auth.uid()
        AND outfitter_memberships.status = 'active'
        AND outfitter_memberships.role IN ('owner', 'admin')
    )
  );

-- =============================================================================
-- 5. Row Level Security for contract_templates
-- =============================================================================
ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage contract templates" ON contract_templates;
CREATE POLICY "Admins can manage contract templates"
  ON contract_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM outfitter_memberships
      WHERE outfitter_memberships.outfitter_id = contract_templates.outfitter_id
        AND outfitter_memberships.user_id = auth.uid()
        AND outfitter_memberships.status = 'active'
        AND outfitter_memberships.role IN ('owner', 'admin')
    )
  );

-- =============================================================================
-- 6. Updated_at triggers for new tables
-- =============================================================================
CREATE OR REPLACE FUNCTION update_contract_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contract_templates_updated_at
  BEFORE UPDATE ON contract_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_contract_templates_updated_at();

CREATE OR REPLACE FUNCTION update_hunt_contracts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER hunt_contracts_updated_at
  BEFORE UPDATE ON hunt_contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_hunt_contracts_updated_at();

-- =============================================================================
-- 7. Helper view for admin
-- =============================================================================
CREATE OR REPLACE VIEW hunts_pending_tag_outcome AS
SELECT 
  ce.id,
  ce.outfitter_id,
  ce.title,
  ce.client_email,
  ce.guide_username,
  ce.hunt_type,
  ce.tag_status,
  ce.species,
  ce.unit,
  ce.start_time,
  ce.end_time,
  ce.status,
  ce.contract_generated_at
FROM calendar_events ce
WHERE ce.tag_status IN ('pending', 'applied')
  AND ce.client_email IS NOT NULL;

GRANT SELECT ON hunts_pending_tag_outcome TO authenticated;

-- =============================================================================
-- Done! Contract generation is handled via API, not triggers
-- =============================================================================
