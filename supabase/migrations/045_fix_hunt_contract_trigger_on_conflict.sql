-- Fix: trigger generate_hunt_contract_after_insert used ON CONFLICT (hunt_id) DO NOTHING,
-- but migration 031 replaced the unique constraint with a partial unique index, so
-- PostgreSQL returns "there is no unique or exclusion constraint matching the ON CONFLICT specification".
-- Use IF NOT EXISTS instead of ON CONFLICT so the trigger works with the partial index.

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

    -- Skip if contract already exists (avoids duplicate when partial unique index exists)
    IF NOT EXISTS (SELECT 1 FROM hunt_contracts WHERE hunt_id = NEW.id) THEN
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
