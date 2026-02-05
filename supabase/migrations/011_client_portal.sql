-- Migration: Client Portal Tables
-- Stores questionnaire responses, pre-draw submissions, and payment tracking

-- =============================================================================
-- 1. Client Questionnaires Table (matches iOS PreHuntQuestionnaire)
-- =============================================================================
CREATE TABLE IF NOT EXISTS client_questionnaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  outfitter_id UUID NOT NULL REFERENCES outfitters(id) ON DELETE CASCADE,
  
  -- Contact info
  full_name TEXT NOT NULL,
  mailing_address TEXT,
  contact_phone TEXT,
  email TEXT NOT NULL,
  dob DATE,
  
  -- Emergency contact
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  global_rescue_member_number TEXT,
  
  -- Preferences
  food_allergies TEXT,
  food_preferences TEXT,
  drink_preferences TEXT,
  
  -- Health/Accommodations
  specific_accommodation TEXT,
  physical_limitations TEXT,
  health_concerns TEXT,
  
  -- General
  general_notes TEXT,
  
  -- Metadata
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One questionnaire per client per outfitter (can update)
  UNIQUE(client_id, outfitter_id)
);

-- =============================================================================
-- 2. Pre-Draw Species Selections (child table for pre-draw submissions)
-- =============================================================================
CREATE TABLE IF NOT EXISTS predraw_species_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL, -- will reference client_predraw_submissions
  species TEXT NOT NULL,
  choice_index INT NOT NULL, -- 1st choice, 2nd choice, etc.
  weapon TEXT, -- Rifle, Bow, Muzzleloader
  code_or_unit TEXT,
  dates TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 3. Client Pre-Draw Submissions Table (matches iOS PreDrawSubmission)
-- =============================================================================
CREATE TABLE IF NOT EXISTS client_predraw_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  outfitter_id UUID NOT NULL REFERENCES outfitters(id) ON DELETE CASCADE,
  
  -- NMDGF & License Info
  nmdgf_username TEXT,
  height TEXT,
  weight TEXT,
  eye_color TEXT,
  hair_color TEXT,
  dob TEXT,
  drivers_license_number TEXT,
  drivers_license_state TEXT,
  ssn_last4 TEXT,
  passport_number TEXT,
  
  -- Payment authorization
  credit_card_last4 TEXT,
  exp_mm TEXT,
  exp_yyyy TEXT,
  
  -- Species comments
  elk_comments TEXT,
  deer_comments TEXT,
  antelope_comments TEXT,
  
  -- Contract acknowledgment
  acknowledged_contract BOOLEAN DEFAULT false,
  
  -- Application submission choice
  submit_choice TEXT DEFAULT 'authorize_g3', -- 'authorize_g3' or 'submit_myself'
  
  -- DocuSign tracking
  docusign_envelope_id TEXT,
  docusign_status TEXT DEFAULT 'pending', -- pending, sent, signed, completed, declined
  
  -- Metadata
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  year INT DEFAULT EXTRACT(YEAR FROM NOW()),
  
  -- One submission per client per outfitter per year
  UNIQUE(client_id, outfitter_id, year)
);

-- Add foreign key for species selections
-- Drop constraint if it exists, then add it
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_predraw_submission' 
    AND table_name = 'predraw_species_selections'
  ) THEN
    ALTER TABLE predraw_species_selections DROP CONSTRAINT fk_predraw_submission;
  END IF;
END $$;

ALTER TABLE predraw_species_selections 
  ADD CONSTRAINT fk_predraw_submission 
  FOREIGN KEY (submission_id) 
  REFERENCES client_predraw_submissions(id) 
  ON DELETE CASCADE;

-- =============================================================================
-- 4. Client Payments Table (placeholder for future payment tracking)
-- =============================================================================
CREATE TABLE IF NOT EXISTS client_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  outfitter_id UUID NOT NULL REFERENCES outfitters(id) ON DELETE CASCADE,
  hunt_id UUID REFERENCES calendar_events(id) ON DELETE SET NULL,
  
  -- Payment plan
  payment_plan TEXT DEFAULT 'two', -- 'full', 'two', 'three'
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  -- Individual payment tracking
  label TEXT NOT NULL, -- 'Deposit (40%)', 'Final (60%)', etc.
  amount DECIMAL(10,2) NOT NULL,
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  is_paid BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 5. Add DocuSign tracking to documents table
-- =============================================================================
ALTER TABLE documents 
  ADD COLUMN IF NOT EXISTS docusign_envelope_id TEXT,
  ADD COLUMN IF NOT EXISTS docusign_status TEXT DEFAULT 'pending';

-- =============================================================================
-- 6. Indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_client_questionnaires_client ON client_questionnaires(client_id);
CREATE INDEX IF NOT EXISTS idx_client_questionnaires_outfitter ON client_questionnaires(outfitter_id);

CREATE INDEX IF NOT EXISTS idx_client_predraw_client ON client_predraw_submissions(client_id);
CREATE INDEX IF NOT EXISTS idx_client_predraw_outfitter ON client_predraw_submissions(outfitter_id);
CREATE INDEX IF NOT EXISTS idx_client_predraw_year ON client_predraw_submissions(year);
CREATE INDEX IF NOT EXISTS idx_predraw_selections_submission ON predraw_species_selections(submission_id);

CREATE INDEX IF NOT EXISTS idx_client_payments_client ON client_payments(client_id);
CREATE INDEX IF NOT EXISTS idx_client_payments_outfitter ON client_payments(outfitter_id);
CREATE INDEX IF NOT EXISTS idx_client_payments_hunt ON client_payments(hunt_id);

-- =============================================================================
-- 7. Row Level Security
-- =============================================================================

-- Questionnaires RLS
ALTER TABLE client_questionnaires ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients can view own questionnaires" ON client_questionnaires;
CREATE POLICY "Clients can view own questionnaires"
  ON client_questionnaires FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = client_questionnaires.client_id
        AND clients.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Clients can insert own questionnaires" ON client_questionnaires;
CREATE POLICY "Clients can insert own questionnaires"
  ON client_questionnaires FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = client_questionnaires.client_id
        AND clients.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Clients can update own questionnaires" ON client_questionnaires;
CREATE POLICY "Clients can update own questionnaires"
  ON client_questionnaires FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = client_questionnaires.client_id
        AND clients.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can view questionnaires for their outfitters" ON client_questionnaires;
CREATE POLICY "Admins can view questionnaires for their outfitters"
  ON client_questionnaires FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM outfitter_memberships
      WHERE outfitter_memberships.outfitter_id = client_questionnaires.outfitter_id
        AND outfitter_memberships.user_id = auth.uid()
        AND outfitter_memberships.status = 'active'
        AND outfitter_memberships.role IN ('owner', 'admin')
    )
  );

-- Pre-Draw Submissions RLS
ALTER TABLE client_predraw_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients can view own predraw submissions" ON client_predraw_submissions;
CREATE POLICY "Clients can view own predraw submissions"
  ON client_predraw_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = client_predraw_submissions.client_id
        AND clients.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Clients can insert own predraw submissions" ON client_predraw_submissions;
CREATE POLICY "Clients can insert own predraw submissions"
  ON client_predraw_submissions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = client_predraw_submissions.client_id
        AND clients.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Clients can update own predraw submissions" ON client_predraw_submissions;
CREATE POLICY "Clients can update own predraw submissions"
  ON client_predraw_submissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = client_predraw_submissions.client_id
        AND clients.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can view predraw for their outfitters" ON client_predraw_submissions;
CREATE POLICY "Admins can view predraw for their outfitters"
  ON client_predraw_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM outfitter_memberships
      WHERE outfitter_memberships.outfitter_id = client_predraw_submissions.outfitter_id
        AND outfitter_memberships.user_id = auth.uid()
        AND outfitter_memberships.status = 'active'
        AND outfitter_memberships.role IN ('owner', 'admin')
    )
  );

-- Species Selections RLS
ALTER TABLE predraw_species_selections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients can manage own species selections" ON predraw_species_selections;
CREATE POLICY "Clients can manage own species selections"
  ON predraw_species_selections FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM client_predraw_submissions ps
      JOIN clients c ON c.id = ps.client_id
      WHERE ps.id = predraw_species_selections.submission_id
        AND c.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can view species selections" ON predraw_species_selections;
CREATE POLICY "Admins can view species selections"
  ON predraw_species_selections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM client_predraw_submissions ps
      JOIN outfitter_memberships om ON om.outfitter_id = ps.outfitter_id
      WHERE ps.id = predraw_species_selections.submission_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('owner', 'admin')
    )
  );

-- Payments RLS
ALTER TABLE client_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients can view own payments" ON client_payments;
CREATE POLICY "Clients can view own payments"
  ON client_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = client_payments.client_id
        AND clients.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can manage payments for their outfitters" ON client_payments;
CREATE POLICY "Admins can manage payments for their outfitters"
  ON client_payments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM outfitter_memberships
      WHERE outfitter_memberships.outfitter_id = client_payments.outfitter_id
        AND outfitter_memberships.user_id = auth.uid()
        AND outfitter_memberships.status = 'active'
        AND outfitter_memberships.role IN ('owner', 'admin')
    )
  );

-- =============================================================================
-- 8. Update triggers for updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION update_client_questionnaires_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS client_questionnaires_updated_at ON client_questionnaires;
CREATE TRIGGER client_questionnaires_updated_at
  BEFORE UPDATE ON client_questionnaires
  FOR EACH ROW
  EXECUTE FUNCTION update_client_questionnaires_updated_at();

CREATE OR REPLACE FUNCTION update_client_predraw_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS client_predraw_updated_at ON client_predraw_submissions;
CREATE TRIGGER client_predraw_updated_at
  BEFORE UPDATE ON client_predraw_submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_client_predraw_updated_at();

CREATE OR REPLACE FUNCTION update_client_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS client_payments_updated_at ON client_payments;
CREATE TRIGGER client_payments_updated_at
  BEFORE UPDATE ON client_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_client_payments_updated_at();
