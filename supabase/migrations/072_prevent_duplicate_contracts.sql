-- Migration: Prevent duplicate contracts per hunt
-- Ensures only one contract exists per hunt_id
-- Fixes redirect loops and duplicate contract creation

-- =============================================================================
-- PART 1: Ensure unique constraint on hunt_id (only when not null)
-- =============================================================================

-- Drop existing unique constraint/index if it exists
DROP INDEX IF EXISTS hunt_contracts_hunt_id_unique;
DROP INDEX IF EXISTS idx_hunt_contracts_hunt;

-- Create partial unique index (only enforces uniqueness when hunt_id is NOT NULL)
-- This prevents multiple contracts for the same hunt
CREATE UNIQUE INDEX IF NOT EXISTS hunt_contracts_hunt_id_unique 
ON hunt_contracts(hunt_id) 
WHERE hunt_id IS NOT NULL;

-- Also add a regular index for performance
CREATE INDEX IF NOT EXISTS idx_hunt_contracts_hunt 
ON hunt_contracts(hunt_id) 
WHERE hunt_id IS NOT NULL;

COMMENT ON INDEX hunt_contracts_hunt_id_unique IS 'Ensures only one contract per hunt. Prevents duplicate contracts when triggers or API calls fire multiple times.';

-- =============================================================================
-- PART 2: Update contract generation functions to check for existing contracts
-- =============================================================================

-- Update generate_hunt_contract_after_insert to be more defensive
CREATE OR REPLACE FUNCTION generate_hunt_contract_after_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_client_name TEXT;
  v_content TEXT;
  v_template_id UUID;
  v_template_content TEXT;
  v_outfitter_name TEXT;
  v_hunt_title TEXT;
  v_existing_contract_id UUID;
BEGIN
  -- Only for private land hunts with confirmed tags and client email
  IF NEW.hunt_type = 'private_land'
     AND NEW.tag_status = 'confirmed'
     AND NEW.client_email IS NOT NULL THEN

    -- CRITICAL: Check if contract already exists for this hunt_id
    -- Use SELECT FOR UPDATE to prevent race conditions
    SELECT id INTO v_existing_contract_id
    FROM hunt_contracts
    WHERE hunt_id = NEW.id
    LIMIT 1
    FOR UPDATE;

    -- If contract exists, skip creation (don't create duplicate)
    IF v_existing_contract_id IS NOT NULL THEN
      RAISE NOTICE 'Contract already exists for hunt %, skipping creation', NEW.id;
      RETURN NEW;
    END IF;

    -- Get client name
    SELECT COALESCE(first_name || ' ' || last_name, NEW.client_email)
    INTO v_client_name
    FROM clients
    WHERE LOWER(email) = LOWER(NEW.client_email)
    LIMIT 1;

    IF v_client_name IS NULL THEN
      v_client_name := NEW.client_email;
    END IF;

    -- Get outfitter name
    SELECT name INTO v_outfitter_name
    FROM outfitters
    WHERE id = NEW.outfitter_id;

    -- Get active hunt contract template for this outfitter
    SELECT id, content INTO v_template_id, v_template_content
    FROM contract_templates
    WHERE outfitter_id = NEW.outfitter_id
      AND template_type = 'hunt_contract'
      AND is_active = true
    ORDER BY created_at DESC
    LIMIT 1;

    -- Build hunt title
    v_hunt_title := COALESCE(NEW.title, NEW.species || ' Hunt');

    -- Use template if available, otherwise use generic fallback
    IF v_template_content IS NOT NULL THEN
      v_content := replace_template_placeholders(
        v_template_content,
        v_client_name,
        NEW.client_email,
        v_hunt_title,
        NEW.species,
        NEW.unit,
        NULL,
        NEW.start_time::DATE,
        NEW.end_time::DATE,
        NEW.camp_name,
        v_outfitter_name,
        NULL,
        NULL
      );
    ELSE
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
    END IF;

    -- Insert contract with ON CONFLICT handling (defensive)
    INSERT INTO hunt_contracts (
      outfitter_id,
      hunt_id,
      client_email,
      client_name,
      content,
      status,
      template_id
    )
    VALUES (
      NEW.outfitter_id,
      NEW.id,
      NEW.client_email,
      v_client_name,
      v_content,
      'pending_client_completion',
      v_template_id
    )
    ON CONFLICT DO NOTHING;  -- If somehow a duplicate exists, don't error

    -- Only update contract_generated_at if we successfully created a contract
    IF FOUND THEN
      UPDATE calendar_events SET contract_generated_at = NOW() WHERE id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update generate_hunt_contract_after_update similarly
CREATE OR REPLACE FUNCTION generate_hunt_contract_after_update()
RETURNS TRIGGER AS $$
DECLARE
  v_client_name TEXT;
  v_content TEXT;
  v_existing_contract_id UUID;
BEGIN
  -- Only if tag_status changed to 'confirmed'
  IF NEW.hunt_type = 'private_land' 
     AND NEW.tag_status = 'confirmed' 
     AND (OLD.tag_status IS NULL OR OLD.tag_status != 'confirmed')
     AND NEW.client_email IS NOT NULL 
     AND NEW.contract_generated_at IS NULL THEN
    
    -- CRITICAL: Check if contract already exists
    SELECT id INTO v_existing_contract_id
    FROM hunt_contracts
    WHERE hunt_id = NEW.id
    LIMIT 1
    FOR UPDATE;

    -- If contract exists, skip creation
    IF v_existing_contract_id IS NOT NULL THEN
      RAISE NOTICE 'Contract already exists for hunt %, skipping creation', NEW.id;
      RETURN NEW;
    END IF;

    -- Rest of function remains the same...
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
    VALUES (NEW.outfitter_id, NEW.id, NEW.client_email, v_client_name, v_content, 'pending_client_completion')
    ON CONFLICT DO NOTHING;
    
    IF FOUND THEN
      UPDATE calendar_events SET contract_generated_at = NOW() WHERE id = NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- PART 3: Clean up any existing duplicate contracts (keep the oldest one)
-- =============================================================================

DO $$
DECLARE
  rec RECORD;
  v_keep_id UUID;
BEGIN
  -- Find hunts with multiple contracts
  FOR rec IN 
    SELECT hunt_id, COUNT(*) as cnt, array_agg(id ORDER BY created_at) as contract_ids
    FROM hunt_contracts
    WHERE hunt_id IS NOT NULL
    GROUP BY hunt_id
    HAVING COUNT(*) > 1
  LOOP
    -- Keep the oldest contract (first in array)
    v_keep_id := rec.contract_ids[1];
    
    -- Delete the duplicates (all except the first)
    DELETE FROM hunt_contracts
    WHERE hunt_id = rec.hunt_id
      AND id != v_keep_id;
    
    RAISE NOTICE 'Removed duplicate contracts for hunt %. Kept contract %', rec.hunt_id, v_keep_id;
  END LOOP;
END $$;

-- =============================================================================
-- DONE
-- =============================================================================
-- Now only one contract can exist per hunt_id
-- Triggers check for existing contracts before creating new ones
-- Any existing duplicates have been cleaned up
