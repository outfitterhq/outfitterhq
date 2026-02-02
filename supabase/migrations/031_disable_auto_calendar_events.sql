-- Migration: Disable Automatic Calendar Event Creation
-- Ensures hunts only appear in calendar when admin explicitly adds them
-- Contracts can still be generated, but calendar events must be created manually

-- =============================================================================
-- PART 1: Make hunt_id nullable in hunt_contracts FIRST (before modifying functions)
-- =============================================================================

-- Check if hunt_id has NOT NULL constraint and remove it
DO $$
BEGIN
  -- Check if column has NOT NULL constraint
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'hunt_contracts' 
      AND column_name = 'hunt_id' 
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE hunt_contracts ALTER COLUMN hunt_id DROP NOT NULL;
  END IF;
END $$;

-- Update the unique constraint to allow multiple contracts without hunt_id
-- First drop the existing unique constraint if it exists
DO $$
BEGIN
  -- Drop unique constraint if it exists
  IF EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'hunt_contracts_hunt_id_key'
  ) THEN
    ALTER TABLE hunt_contracts DROP CONSTRAINT hunt_contracts_hunt_id_key;
  END IF;
END $$;

-- Create partial unique index (only enforces uniqueness when hunt_id is NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS hunt_contracts_hunt_id_unique 
ON hunt_contracts(hunt_id) 
WHERE hunt_id IS NOT NULL;

COMMENT ON COLUMN hunt_contracts.hunt_id IS 'Links to calendar_events.id. NULL means contract exists but no calendar event created yet. Admin must create calendar event manually.';

-- =============================================================================
-- PART 2: Disable automatic calendar event creation from draw results
-- =============================================================================

-- Drop the trigger that auto-creates calendar events from draw results
DROP TRIGGER IF EXISTS trigger_create_hunt_from_draw ON draw_results;
DROP TRIGGER IF EXISTS trigger_create_hunt_from_draw_update ON draw_results;

-- Modify the function to only create contracts, NOT calendar events
CREATE OR REPLACE FUNCTION create_hunt_from_draw_result()
RETURNS TRIGGER AS $$
DECLARE
  v_client_name TEXT;
  v_content TEXT;
  v_hunt_id UUID;
  v_start_date DATE;
  v_end_date DATE;
  v_template_id UUID;
  v_template_content TEXT;
  v_outfitter_name TEXT;
BEGIN
  -- Only process if result_status is 'drawn' and hunt hasn't been created yet
  IF NEW.result_status = 'drawn' AND (NEW.hunt_id IS NULL OR NOT NEW.hunt_created) THEN
    
    -- Get client name
    SELECT COALESCE(first_name || ' ' || last_name, NEW.client_email)
    INTO v_client_name
    FROM clients
    WHERE LOWER(email) = LOWER(NEW.client_email)
    LIMIT 1;
    
    IF v_client_name IS NULL THEN
      v_client_name := NEW.client_email;
      NEW.client_name := v_client_name;
    ELSE
      v_client_name := NEW.client_name;
    END IF;
    
    -- Calculate dates (use draw year + estimated season dates)
    -- Default to a generic date range if not specified
    v_start_date := (NEW.draw_year || '-09-01')::DATE;
    v_end_date := (NEW.draw_year || '-12-31')::DATE;
    
    -- Get outfitter name
    SELECT name INTO v_outfitter_name
    FROM outfitters
    WHERE id = NEW.outfitter_id;
    
    -- Get active hunt contract template
    SELECT id, content INTO v_template_id, v_template_content
    FROM contract_templates
    WHERE outfitter_id = NEW.outfitter_id
      AND template_type = 'hunt_contract'
      AND is_active = true
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Build contract content from template or fallback
    IF v_template_content IS NOT NULL THEN
      v_content := replace_template_placeholders(
        v_template_content,
        v_client_name,
        NEW.client_email,
        NEW.species || ' Hunt - ' || COALESCE(NEW.tag_type, 'Draw'),
        NEW.species,
        NEW.unit,
        NULL, -- weapon
        v_start_date,
        v_end_date,
        NULL, -- camp_name
        v_outfitter_name,
        NULL, -- outfitter_phone
        NULL  -- outfitter_email
      );
    ELSE
      -- Fallback generic contract
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
    END IF;
    
    -- DO NOT create calendar event automatically
    -- Admin must manually create calendar event after reviewing contract
    -- Set hunt_id to NULL to indicate no calendar event yet
    v_hunt_id := NULL;
    NEW.hunt_id := NULL;
    NEW.hunt_created := false;
    
    -- Create contract WITHOUT a calendar event
    -- Admin will create calendar event manually after reviewing contract
    INSERT INTO hunt_contracts (
      outfitter_id,
      hunt_id,  -- NULL - no calendar event yet
      client_email,
      client_name,
      content,
      status,
      template_id
    ) VALUES (
      NEW.outfitter_id,
      NULL,  -- No calendar event - admin will create one
      NEW.client_email,
      v_client_name,
      v_content,
      'pending_client_completion',
      v_template_id
    )
    RETURNING id INTO NEW.contract_id;
    
    -- Mark that contract was created (but no calendar event)
    NEW.hunt_created := false;  -- False because no calendar event exists yet
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate triggers (but now calendar events are created as 'internalOnly' and 'Inquiry' status)
CREATE TRIGGER trigger_create_hunt_from_draw
  BEFORE INSERT ON draw_results
  FOR EACH ROW
  EXECUTE FUNCTION create_hunt_from_draw_result();

CREATE TRIGGER trigger_create_hunt_from_draw_update
  BEFORE UPDATE ON draw_results
  FOR EACH ROW
  WHEN (OLD.result_status != 'drawn' AND NEW.result_status = 'drawn')
  EXECUTE FUNCTION create_hunt_from_draw_result();

-- =============================================================================
-- PART 3: Note about existing triggers
-- =============================================================================

-- The existing triggers in 015_auto_generate_contracts.sql and 023_use_templates_for_contract_generation.sql
-- create contracts when calendar events are created/updated (for private land tags).
-- These triggers assume calendar events already exist (created manually by admin).
-- We don't need to change those - they work fine.
-- The key change is that draw results no longer auto-create calendar events.

-- =============================================================================
-- DONE
-- =============================================================================
-- Draw results NO LONGER create calendar events automatically
-- Contracts are created without calendar events (hunt_id = NULL)
-- Admins must manually create calendar events after reviewing contracts
-- This ensures hunts only appear in calendar when admin explicitly adds them
