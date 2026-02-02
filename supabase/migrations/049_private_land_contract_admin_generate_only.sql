-- Private land: do NOT auto-generate hunt contract on tag purchase.
-- Admin must generate the contract (so hunt code and dates can be set) via Calendar / Generate contract.
-- Draw hunts: still auto-generate when tag_status = 'drawn'.

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
  -- Only for DRAW hunts with drawn tag (not private land - admin generates those)
  IF NEW.hunt_type = 'draw'
     AND NEW.tag_status = 'drawn'
     AND NEW.client_email IS NOT NULL THEN

    IF NOT EXISTS (SELECT 1 FROM hunt_contracts WHERE hunt_id = NEW.id) THEN
      SELECT COALESCE(first_name || ' ' || last_name, NEW.client_email)
      INTO v_client_name
      FROM clients
      WHERE LOWER(email) = LOWER(NEW.client_email)
      LIMIT 1;

      IF v_client_name IS NULL THEN
        v_client_name := NEW.client_email;
      END IF;

      SELECT name INTO v_outfitter_name
      FROM outfitters
      WHERE id = NEW.outfitter_id;

      SELECT id, content INTO v_template_id, v_template_content
      FROM contract_templates
      WHERE outfitter_id = NEW.outfitter_id
        AND template_type = 'hunt_contract'
        AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1;

      v_hunt_title := COALESCE(NEW.title, NEW.species || ' Hunt');

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
          '- Hunt Type: Draw' || E'\n' ||
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
  -- Only when tag_status changed to 'drawn' (draw hunts). Private land: admin generates via API.
  IF NEW.tag_status = 'drawn'
     AND (OLD.tag_status IS NULL OR OLD.tag_status != 'drawn')
     AND NEW.hunt_type = 'draw'
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

      SELECT name INTO v_outfitter_name
      FROM outfitters
      WHERE id = NEW.outfitter_id;

      SELECT id, content INTO v_template_id, v_template_content
      FROM contract_templates
      WHERE outfitter_id = NEW.outfitter_id
        AND template_type = 'hunt_contract'
        AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1;

      v_hunt_title := COALESCE(NEW.title, NEW.species || ' Hunt');

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

COMMENT ON FUNCTION generate_hunt_contract_after_insert() IS 'Only creates contract for draw hunts (tag_status=drawn). Private land contracts are created by admin via Generate contract.';
COMMENT ON FUNCTION generate_hunt_contract_after_update() IS 'Only creates contract when draw hunt tag_status changes to drawn. Private land: admin generates.';
