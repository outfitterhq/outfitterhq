-- Migration: Update contract generation to use templates instead of hardcoded text
-- Replaces the hardcoded contract content in generate_hunt_contract functions

-- =============================================================================
-- 1. HELPER FUNCTION: Replace placeholders in template content
-- =============================================================================

CREATE OR REPLACE FUNCTION replace_template_placeholders(
  template_content TEXT,
  client_name TEXT DEFAULT NULL,
  client_email TEXT DEFAULT NULL,
  hunt_title TEXT DEFAULT NULL,
  species TEXT DEFAULT NULL,
  unit TEXT DEFAULT NULL,
  weapon TEXT DEFAULT NULL,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  camp_name TEXT DEFAULT NULL,
  outfitter_name TEXT DEFAULT NULL,
  outfitter_phone TEXT DEFAULT NULL,
  outfitter_email TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  result := template_content;
  
  -- Replace placeholders
  result := REPLACE(result, '{{client_name}}', COALESCE(client_name, 'Client'));
  result := REPLACE(result, '{{client_email}}', COALESCE(client_email, ''));
  result := REPLACE(result, '{{hunt_title}}', COALESCE(hunt_title, 'Hunt'));
  result := REPLACE(result, '{{species}}', COALESCE(species, 'Not specified'));
  result := REPLACE(result, '{{unit}}', COALESCE(unit, 'Not specified'));
  result := REPLACE(result, '{{weapon}}', COALESCE(weapon, 'Not specified'));
  result := REPLACE(result, '{{start_date}}', COALESCE(start_date::TEXT, 'TBD'));
  result := REPLACE(result, '{{end_date}}', COALESCE(end_date::TEXT, 'TBD'));
  result := REPLACE(result, '{{camp_name}}', COALESCE(camp_name, 'Not specified'));
  result := REPLACE(result, '{{outfitter_name}}', COALESCE(outfitter_name, 'Outfitter'));
  result := REPLACE(result, '{{outfitter_phone}}', COALESCE(outfitter_phone, ''));
  result := REPLACE(result, '{{outfitter_email}}', COALESCE(outfitter_email, ''));
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 2. UPDATE: generate_hunt_contract_after_insert to use templates
-- =============================================================================

CREATE OR REPLACE FUNCTION generate_hunt_contract_after_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_client_name TEXT;
  v_content TEXT;
  v_template_id UUID;
  v_template_content TEXT;
  v_outfitter_name TEXT;
  v_hunt_title TEXT;
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
        NULL, -- weapon
        NEW.start_time::DATE,
        NEW.end_time::DATE,
        NEW.camp_name,
        v_outfitter_name,
        NULL, -- outfitter_phone
        NULL  -- outfitter_email
      );
    ELSE
      -- Fallback generic template if no template exists
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
    
    -- Insert contract
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
    ON CONFLICT (hunt_id) DO NOTHING;
    
    -- Mark contract as generated
    UPDATE calendar_events SET contract_generated_at = NOW() WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 3. UPDATE: generate_hunt_contract_after_update to use templates
-- =============================================================================

CREATE OR REPLACE FUNCTION generate_hunt_contract_after_update()
RETURNS TRIGGER AS $$
DECLARE
  v_client_name TEXT;
  v_content TEXT;
  v_template_id UUID;
  v_template_content TEXT;
  v_outfitter_name TEXT;
  v_hunt_title TEXT;
BEGIN
  -- Only if tag_status changed to 'confirmed' or 'drawn'
  IF (NEW.tag_status = 'confirmed' OR NEW.tag_status = 'drawn')
     AND (OLD.tag_status IS NULL OR OLD.tag_status NOT IN ('confirmed', 'drawn'))
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
      
      -- Build hunt title
      v_hunt_title := COALESCE(NEW.title, NEW.species || ' Hunt');
      
      -- Use template if available
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
        -- Fallback
        v_content := 'HUNT CONTRACT' || E'\n\n' ||
          'Client: ' || v_client_name || E'\n' ||
          'Email: ' || NEW.client_email || E'\n\n' ||
          'Hunt Details:' || E'\n' ||
          '- Species: ' || COALESCE(NEW.species, 'Not specified') || E'\n' ||
          '- Unit: ' || COALESCE(NEW.unit, 'Not specified') || E'\n' ||
          '- Start Date: ' || NEW.start_time::date || E'\n' ||
          '- End Date: ' || NEW.end_time::date || E'\n\n' ||
          'Generated: ' || NOW()::date;
      END IF;
      
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
      );
      
      UPDATE calendar_events SET contract_generated_at = NOW() WHERE id = NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 4. UPDATE: create_deposit_for_contract function (from migration 019)
-- =============================================================================
-- This function already exists, but we should ensure it works with templates
-- No changes needed - it just creates payment items, not contracts

-- =============================================================================
-- DONE
-- =============================================================================
-- Contract generation now uses outfitter-specific templates
-- Falls back to generic text if no template exists
-- Templates are auto-created for new outfitters (migration 022)
