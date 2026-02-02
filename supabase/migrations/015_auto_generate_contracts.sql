-- Migration: Auto-generate hunt contracts for private land tag purchases
-- FIXED: Use AFTER INSERT trigger (not BEFORE) so the hunt exists first

-- =============================================================================
-- PART 1: Generate contracts for existing private land hunts
-- =============================================================================

DO $$
DECLARE
  rec RECORD;
  v_client_name TEXT;
  v_content TEXT;
BEGIN
  FOR rec IN 
    SELECT 
      ce.outfitter_id,
      ce.id AS hunt_id,
      ce.client_email,
      ce.species,
      ce.unit,
      ce.start_time,
      ce.end_time,
      COALESCE(c.first_name || ' ' || c.last_name, ce.client_email) AS client_name
    FROM calendar_events ce
    LEFT JOIN clients c ON LOWER(c.email) = LOWER(ce.client_email)
    WHERE ce.hunt_type = 'private_land'
      AND ce.client_email IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM hunt_contracts hc WHERE hc.hunt_id = ce.id)
  LOOP
    v_client_name := rec.client_name;
    v_content := 'HUNT CONTRACT' || E'\n\n' ||
      'Client: ' || v_client_name || E'\n' ||
      'Email: ' || rec.client_email || E'\n\n' ||
      'Hunt Details:' || E'\n' ||
      '- Hunt Type: Private Land Tag' || E'\n' ||
      '- Species: ' || COALESCE(rec.species, 'Not specified') || E'\n' ||
      '- Unit: ' || COALESCE(rec.unit, 'Not specified') || E'\n' ||
      '- Start Date: ' || rec.start_time::date || E'\n' ||
      '- End Date: ' || rec.end_time::date || E'\n\n' ||
      'This contract confirms your private land tag hunt booking.' || E'\n\n' ||
      'Terms and Conditions:' || E'\n' ||
      '1. Full payment is due before the hunt begins.' || E'\n' ||
      '2. Tags are non-refundable once purchased.' || E'\n' ||
      '3. Guide assignment will be confirmed closer to hunt date.' || E'\n\n' ||
      'Please review and sign this contract.' || E'\n\n' ||
      'Generated: ' || NOW()::date;
    
    INSERT INTO hunt_contracts (outfitter_id, hunt_id, client_email, client_name, content, status)
    VALUES (rec.outfitter_id, rec.hunt_id, rec.client_email, v_client_name, v_content, 'pending_client_completion');
    
    UPDATE calendar_events SET contract_generated_at = NOW() WHERE id = rec.hunt_id;
    
    RAISE NOTICE 'Created contract for hunt %', rec.hunt_id;
  END LOOP;
END $$;

-- =============================================================================
-- PART 2: Drop old triggers (they were BEFORE INSERT which caused FK error)
-- =============================================================================

DROP TRIGGER IF EXISTS trigger_auto_generate_contract ON calendar_events;
DROP TRIGGER IF EXISTS trigger_auto_generate_contract_on_update ON calendar_events;
DROP FUNCTION IF EXISTS generate_hunt_contract() CASCADE;
DROP FUNCTION IF EXISTS generate_hunt_contract_on_update() CASCADE;

-- =============================================================================
-- PART 3: Create AFTER INSERT trigger function (hunt exists, so FK works)
-- =============================================================================

CREATE OR REPLACE FUNCTION generate_hunt_contract_after_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_client_name TEXT;
  v_content TEXT;
BEGIN
  -- Only for private land hunts with confirmed tags and client email
  IF NEW.hunt_type = 'private_land' 
     AND NEW.tag_status = 'confirmed' 
     AND NEW.client_email IS NOT NULL THEN
    
    -- Get client name
    SELECT COALESCE(first_name || ' ' || last_name, NEW.client_email)
    INTO v_client_name
    FROM clients
    WHERE LOWER(email) = LOWER(NEW.client_email)
    LIMIT 1;
    
    IF v_client_name IS NULL THEN
      v_client_name := NEW.client_email;
    END IF;
    
    v_content := 'HUNT CONTRACT' || E'\n\n' ||
      'Client: ' || v_client_name || E'\n' ||
      'Email: ' || NEW.client_email || E'\n\n' ||
      'Hunt Details:' || E'\n' ||
      '- Hunt Type: Private Land Tag' || E'\n' ||
      '- Species: ' || COALESCE(NEW.species, 'Not specified') || E'\n' ||
      '- Unit: ' || COALESCE(NEW.unit, 'Not specified') || E'\n' ||
      '- Start Date: ' || NEW.start_time::date || E'\n' ||
      '- End Date: ' || NEW.end_time::date || E'\n\n' ||
      'This contract confirms your private land tag hunt booking.' || E'\n\n' ||
      'Generated: ' || NOW()::date;
    
    -- Insert contract (hunt now exists so FK works)
    INSERT INTO hunt_contracts (outfitter_id, hunt_id, client_email, client_name, content, status)
    VALUES (NEW.outfitter_id, NEW.id, NEW.client_email, v_client_name, v_content, 'pending_client_completion')
    ON CONFLICT (hunt_id) DO NOTHING;
    
    -- Mark contract as generated
    UPDATE calendar_events SET contract_generated_at = NOW() WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- PART 4: Create AFTER INSERT trigger
-- =============================================================================

CREATE TRIGGER trigger_auto_generate_contract
  AFTER INSERT ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION generate_hunt_contract_after_insert();

-- =============================================================================
-- PART 5: Create AFTER UPDATE trigger function
-- =============================================================================

CREATE OR REPLACE FUNCTION generate_hunt_contract_after_update()
RETURNS TRIGGER AS $$
DECLARE
  v_client_name TEXT;
  v_content TEXT;
BEGIN
  -- Only if tag_status changed to 'confirmed'
  IF NEW.hunt_type = 'private_land' 
     AND NEW.tag_status = 'confirmed' 
     AND (OLD.tag_status IS NULL OR OLD.tag_status != 'confirmed')
     AND NEW.client_email IS NOT NULL 
     AND NEW.contract_generated_at IS NULL THEN
    
    IF NOT EXISTS (SELECT 1 FROM hunt_contracts WHERE hunt_id = NEW.id) THEN
      SELECT COALESCE(first_name || ' ' || last_name, NEW.client_email)
      INTO v_client_name
      FROM clients
      WHERE LOWER(email) = LOWER(NEW.client_email)
      LIMIT 1;
      
      IF v_client_name IS NULL THEN
        v_client_name := NEW.client_email;
      END IF;
      
      v_content := 'HUNT CONTRACT' || E'\n\n' ||
        'Client: ' || v_client_name || E'\n' ||
        'Email: ' || NEW.client_email || E'\n\n' ||
        'Hunt Details:' || E'\n' ||
        '- Hunt Type: Private Land Tag' || E'\n' ||
        '- Species: ' || COALESCE(NEW.species, 'Not specified') || E'\n' ||
        '- Unit: ' || COALESCE(NEW.unit, 'Not specified') || E'\n' ||
        '- Start Date: ' || NEW.start_time::date || E'\n' ||
        '- End Date: ' || NEW.end_time::date || E'\n\n' ||
        'Generated: ' || NOW()::date;
      
      INSERT INTO hunt_contracts (outfitter_id, hunt_id, client_email, client_name, content, status)
      VALUES (NEW.outfitter_id, NEW.id, NEW.client_email, v_client_name, v_content, 'pending_client_completion');
      
      UPDATE calendar_events SET contract_generated_at = NOW() WHERE id = NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- PART 6: Create AFTER UPDATE trigger
-- =============================================================================

CREATE TRIGGER trigger_auto_generate_contract_on_update
  AFTER UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION generate_hunt_contract_after_update();

-- =============================================================================
-- PART 7: Fix RLS policies
-- =============================================================================

DROP POLICY IF EXISTS "Clients can view own hunt contracts" ON hunt_contracts;
CREATE POLICY "Clients can view own hunt contracts"
  ON hunt_contracts FOR SELECT
  USING (client_email = (auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "Clients can complete own hunt contracts" ON hunt_contracts;
CREATE POLICY "Clients can complete own hunt contracts"
  ON hunt_contracts FOR UPDATE
  USING (
    client_email = (auth.jwt() ->> 'email')
    AND status = 'pending_client_completion'
  );

-- Done! Triggers now use AFTER INSERT/UPDATE so the hunt exists first.
