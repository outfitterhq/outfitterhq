-- Migration: Draw Results (Lucky List) with DOB support
-- Admin inputs draw results, system creates hunts and contracts for winners

-- =============================================================================
-- PART 1: Add date_of_birth and hunter_id to clients table
-- =============================================================================

ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS date_of_birth DATE;

ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS hunter_id TEXT;

CREATE INDEX IF NOT EXISTS idx_clients_dob ON clients(date_of_birth) 
  WHERE date_of_birth IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clients_hunter_id ON clients(hunter_id) 
  WHERE hunter_id IS NOT NULL;

-- =============================================================================
-- PART 2: Create draw_results table (the "Lucky List")
-- =============================================================================

CREATE TABLE IF NOT EXISTS draw_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outfitter_id UUID NOT NULL REFERENCES outfitters(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_email TEXT,
  client_name TEXT,
  client_dob DATE,
  hunter_id TEXT,
  species TEXT NOT NULL,
  unit TEXT,
  tag_type TEXT,
  draw_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM NOW()),
  result_status TEXT NOT NULL DEFAULT 'drawn'
    CHECK (result_status IN ('drawn', 'unsuccessful', 'alternate')),
  hunt_created BOOLEAN DEFAULT false,
  hunt_id UUID REFERENCES calendar_events(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES hunt_contracts(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_draw_results_outfitter ON draw_results(outfitter_id);
CREATE INDEX IF NOT EXISTS idx_draw_results_client ON draw_results(client_email);
CREATE INDEX IF NOT EXISTS idx_draw_results_year ON draw_results(draw_year);
CREATE INDEX IF NOT EXISTS idx_draw_results_status ON draw_results(result_status);
CREATE INDEX IF NOT EXISTS idx_draw_results_dob ON draw_results(client_dob) WHERE client_dob IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_draw_results_hunter_id ON draw_results(hunter_id) WHERE hunter_id IS NOT NULL;

-- =============================================================================
-- PART 3: RLS for draw_results
-- =============================================================================

ALTER TABLE draw_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients can view own draw results" ON draw_results;
CREATE POLICY "Clients can view own draw results"
  ON draw_results FOR SELECT
  USING (LOWER(client_email) = LOWER(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "Admins can manage draw results" ON draw_results;
CREATE POLICY "Admins can manage draw results"
  ON draw_results FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM outfitter_memberships
      WHERE outfitter_memberships.outfitter_id = draw_results.outfitter_id
        AND outfitter_memberships.user_id = auth.uid()
        AND outfitter_memberships.status = 'active'
        AND outfitter_memberships.role IN ('owner', 'admin')
    )
  );

-- =============================================================================
-- PART 4: Function to find client by email, name+dob, or hunter_id
-- =============================================================================

CREATE OR REPLACE FUNCTION find_client_for_draw_result(
  p_email TEXT,
  p_name TEXT,
  p_dob DATE,
  p_hunter_id TEXT
) RETURNS UUID AS $$
DECLARE
  v_client_id UUID;
BEGIN
  IF p_email IS NOT NULL THEN
    SELECT id INTO v_client_id
    FROM clients
    WHERE LOWER(email) = LOWER(p_email)
    LIMIT 1;
    
    IF v_client_id IS NOT NULL THEN
      RETURN v_client_id;
    END IF;
  END IF;
  
  IF p_hunter_id IS NOT NULL THEN
    SELECT id INTO v_client_id
    FROM clients
    WHERE hunter_id = p_hunter_id
    LIMIT 1;
    
    IF v_client_id IS NOT NULL THEN
      RETURN v_client_id;
    END IF;
  END IF;
  
  IF p_name IS NOT NULL AND p_dob IS NOT NULL THEN
    SELECT id INTO v_client_id
    FROM clients
    WHERE date_of_birth = p_dob
      AND (
        LOWER(first_name || ' ' || last_name) = LOWER(p_name)
        OR LOWER(last_name || ', ' || first_name) = LOWER(p_name)
      )
    LIMIT 1;
    
    IF v_client_id IS NOT NULL THEN
      RETURN v_client_id;
    END IF;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- PART 5: Function to create hunt + contract from draw result
-- =============================================================================

CREATE OR REPLACE FUNCTION create_hunt_from_draw_result()
RETURNS TRIGGER AS $$
DECLARE
  v_hunt_id UUID;
  v_client_name TEXT;
  v_content TEXT;
  v_start_date TIMESTAMPTZ;
  v_end_date TIMESTAMPTZ;
  v_found_client_id UUID;
BEGIN
  IF NEW.result_status = 'drawn' AND NEW.hunt_created = false THEN
    
    v_found_client_id := find_client_for_draw_result(
      NEW.client_email,
      NEW.client_name,
      NEW.client_dob,
      NEW.hunter_id
    );
    
    IF v_found_client_id IS NOT NULL THEN
      NEW.client_id := v_found_client_id;
      
      IF NEW.client_email IS NULL THEN
        SELECT email INTO NEW.client_email
        FROM clients WHERE id = v_found_client_id;
      END IF;
    END IF;
    
    IF NEW.client_email IS NULL THEN
      RAISE EXCEPTION 'Cannot create hunt: No email found for draw result. Please provide client_email.';
    END IF;
    
    v_start_date := NOW() + INTERVAL '60 days';
    v_end_date := v_start_date + INTERVAL '5 days';
    
    IF NEW.client_name IS NULL THEN
      SELECT COALESCE(first_name || ' ' || last_name, NEW.client_email)
      INTO v_client_name
      FROM clients
      WHERE LOWER(email) = LOWER(NEW.client_email)
      LIMIT 1;
      
      IF v_client_name IS NULL THEN
        v_client_name := NEW.client_email;
      END IF;
      
      NEW.client_name := v_client_name;
    ELSE
      v_client_name := NEW.client_name;
    END IF;
    
    INSERT INTO calendar_events (
      outfitter_id,
      title,
      notes,
      start_time,
      end_time,
      client_email,
      species,
      unit,
      status,
      audience,
      hunt_type,
      tag_status
    ) VALUES (
      NEW.outfitter_id,
      NEW.species || ' Hunt - ' || COALESCE(NEW.tag_type, 'Draw'),
      'Draw winner: ' || v_client_name || 
        CASE WHEN NEW.client_dob IS NOT NULL THEN E'\nDOB: ' || NEW.client_dob ELSE '' END ||
        CASE WHEN NEW.hunter_id IS NOT NULL THEN E'\nHunter ID: ' || NEW.hunter_id ELSE '' END ||
        E'\nYear: ' || NEW.draw_year,
      v_start_date,
      v_end_date,
      NEW.client_email,
      NEW.species,
      NEW.unit,
      'Booked',
      'all',
      'draw',
      'drawn'
    )
    RETURNING id INTO v_hunt_id;
    
    NEW.hunt_id := v_hunt_id;
    NEW.hunt_created := true;
    
    v_content := 'HUNT CONTRACT - DRAW TAG' || E'\n\n' ||
      'Client: ' || v_client_name || E'\n' ||
      'Email: ' || NEW.client_email || E'\n' ||
      CASE WHEN NEW.client_dob IS NOT NULL THEN 'DOB: ' || NEW.client_dob || E'\n' ELSE '' END ||
      CASE WHEN NEW.hunter_id IS NOT NULL THEN 'Hunter ID: ' || NEW.hunter_id || E'\n' ELSE '' END ||
      E'\n' ||
      'Draw Results:' || E'\n' ||
      '- Year: ' || NEW.draw_year || E'\n' ||
      '- Species: ' || NEW.species || E'\n' ||
      '- Unit: ' || COALESCE(NEW.unit, 'Not specified') || E'\n' ||
      '- Tag Type: ' || COALESCE(NEW.tag_type, 'Not specified') || E'\n\n' ||
      'Congratulations on your successful draw!' || E'\n\n' ||
      'Terms and Conditions:' || E'\n' ||
      '1. Full payment is due before the hunt begins.' || E'\n' ||
      '2. Please complete this contract to confirm your booking.' || E'\n' ||
      '3. Guide assignment will be confirmed after contract completion.' || E'\n\n' ||
      'Please review and sign this contract.' || E'\n\n' ||
      'Generated: ' || NOW()::date;
    
    INSERT INTO hunt_contracts (
      outfitter_id,
      hunt_id,
      client_email,
      client_name,
      content,
      status
    ) VALUES (
      NEW.outfitter_id,
      v_hunt_id,
      NEW.client_email,
      v_client_name,
      v_content,
      'pending_client_completion'
    )
    RETURNING id INTO NEW.contract_id;
    
    UPDATE calendar_events 
    SET contract_generated_at = NOW(),
        scheduling_blocked = true
    WHERE id = v_hunt_id;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- PART 6: Triggers to auto-create hunts from draw results
-- =============================================================================

DROP TRIGGER IF EXISTS trigger_create_hunt_from_draw ON draw_results;

CREATE TRIGGER trigger_create_hunt_from_draw
  BEFORE INSERT ON draw_results
  FOR EACH ROW
  EXECUTE FUNCTION create_hunt_from_draw_result();

DROP TRIGGER IF EXISTS trigger_create_hunt_from_draw_update ON draw_results;

CREATE TRIGGER trigger_create_hunt_from_draw_update
  BEFORE UPDATE ON draw_results
  FOR EACH ROW
  WHEN (OLD.result_status != 'drawn' AND NEW.result_status = 'drawn')
  EXECUTE FUNCTION create_hunt_from_draw_result();

-- =============================================================================
-- PART 7: Update contract trigger to handle draw hunts too
-- =============================================================================

CREATE OR REPLACE FUNCTION generate_hunt_contract_after_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_client_name TEXT;
  v_content TEXT;
  v_hunt_type_label TEXT;
BEGIN
  IF NEW.client_email IS NOT NULL 
     AND NEW.contract_generated_at IS NULL
     AND (
       (NEW.hunt_type = 'private_land' AND NEW.tag_status = 'confirmed')
       OR (NEW.hunt_type = 'draw' AND NEW.tag_status = 'drawn')
     ) THEN
    
    IF EXISTS (SELECT 1 FROM hunt_contracts WHERE hunt_id = NEW.id) THEN
      UPDATE calendar_events SET contract_generated_at = NOW() WHERE id = NEW.id;
      RETURN NEW;
    END IF;
    
    SELECT COALESCE(first_name || ' ' || last_name, NEW.client_email)
    INTO v_client_name
    FROM clients
    WHERE LOWER(email) = LOWER(NEW.client_email)
    LIMIT 1;
    
    IF v_client_name IS NULL THEN
      v_client_name := NEW.client_email;
    END IF;
    
    IF NEW.hunt_type = 'private_land' THEN
      v_hunt_type_label := 'Private Land Tag';
    ELSE
      v_hunt_type_label := 'Draw Tag';
    END IF;
    
    v_content := 'HUNT CONTRACT' || E'\n\n' ||
      'Client: ' || v_client_name || E'\n' ||
      'Email: ' || NEW.client_email || E'\n\n' ||
      'Hunt Details:' || E'\n' ||
      '- Hunt Type: ' || v_hunt_type_label || E'\n' ||
      '- Species: ' || COALESCE(NEW.species, 'Not specified') || E'\n' ||
      '- Unit: ' || COALESCE(NEW.unit, 'Not specified') || E'\n' ||
      '- Start Date: ' || NEW.start_time::date || E'\n' ||
      '- End Date: ' || NEW.end_time::date || E'\n\n' ||
      'This contract confirms your hunt booking.' || E'\n\n' ||
      'Generated: ' || NOW()::date;
    
    INSERT INTO hunt_contracts (outfitter_id, hunt_id, client_email, client_name, content, status)
    VALUES (NEW.outfitter_id, NEW.id, NEW.client_email, v_client_name, v_content, 'pending_client_completion')
    ON CONFLICT (hunt_id) DO NOTHING;
    
    UPDATE calendar_events SET contract_generated_at = NOW() WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- PART 8: Helper view for pending draw applications
-- =============================================================================

CREATE OR REPLACE VIEW pending_draw_applications AS
SELECT 
  ps.id AS submission_id,
  ps.client_id,
  c.email AS client_email,
  COALESCE(c.first_name || ' ' || c.last_name, c.email) AS client_name,
  c.date_of_birth AS client_dob,
  c.hunter_id,
  ps.outfitter_id,
  ps.year,
  pss.species,
  pss.choice_index,
  ps.submitted_at,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM draw_results dr 
      WHERE dr.client_email = c.email 
        AND dr.draw_year = ps.year
        AND dr.species = pss.species
    ) THEN 'results_entered'
    ELSE 'pending'
  END AS status
FROM client_predraw_submissions ps
JOIN clients c ON c.id = ps.client_id
LEFT JOIN predraw_species_selections pss ON pss.submission_id = ps.id
WHERE ps.submitted_at IS NOT NULL
ORDER BY ps.year DESC, c.email, pss.choice_index;

GRANT SELECT ON pending_draw_applications TO authenticated;

-- =============================================================================
-- PART 9: Updated_at trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION update_draw_results_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS draw_results_updated_at ON draw_results;
CREATE TRIGGER draw_results_updated_at
  BEFORE UPDATE ON draw_results
  FOR EACH ROW
  EXECUTE FUNCTION update_draw_results_updated_at();

-- =============================================================================
-- Done! To enter draw results:
--
-- INSERT INTO draw_results (outfitter_id, client_email, client_name, client_dob, hunter_id, species, unit, tag_type, draw_year, result_status)
-- VALUES 
--   ('uuid', 'winner@email.com', 'John Smith', '1985-03-15', 'CO-123456', 'Elk', '61', 'Rifle', 2026, 'drawn');
-- =============================================================================
