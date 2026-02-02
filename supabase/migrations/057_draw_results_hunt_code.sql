-- Add hunt_code to draw_results so manual/CSV entry can store state draw codes (e.g. ELK-1-294)
-- Enables looking up or deriving dates from the hunt code

ALTER TABLE draw_results
ADD COLUMN IF NOT EXISTS hunt_code TEXT;

CREATE INDEX IF NOT EXISTS idx_draw_results_hunt_code ON draw_results(hunt_code) WHERE hunt_code IS NOT NULL;

COMMENT ON COLUMN draw_results.hunt_code IS 'State draw hunt code (e.g. NMDGF ELK-1-294); used to derive/lookup hunt dates';

-- Include hunt_code in the draw-result contract content when present
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
  IF NEW.result_status = 'drawn' AND (NEW.hunt_id IS NULL OR NOT NEW.hunt_created) THEN

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

    v_start_date := (NEW.draw_year || '-09-01')::DATE;
    v_end_date := (NEW.draw_year || '-12-31')::DATE;

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

    IF v_template_content IS NOT NULL THEN
      v_content := replace_template_placeholders(
        v_template_content,
        v_client_name,
        NEW.client_email,
        NEW.species || ' Hunt - ' || COALESCE(NEW.tag_type, 'Draw'),
        NEW.species,
        NEW.unit,
        NULL,
        v_start_date,
        v_end_date,
        NULL,
        v_outfitter_name,
        NULL,
        NULL
      );
    ELSE
      v_content := 'HUNT CONTRACT - DRAW TAG' || E'\n\n' ||
        'Client: ' || v_client_name || E'\n' ||
        'Email: ' || NEW.client_email || E'\n' ||
        CASE WHEN NEW.client_dob IS NOT NULL THEN 'DOB: ' || NEW.client_dob || E'\n' ELSE '' END ||
        CASE WHEN NEW.hunter_id IS NOT NULL THEN 'Hunter ID: ' || NEW.hunter_id || E'\n' ELSE '' END ||
        E'\n' ||
        'Draw Results:' || E'\n' ||
        CASE WHEN NEW.hunt_code IS NOT NULL AND NEW.hunt_code <> '' THEN '- Hunt Code: ' || NEW.hunt_code || E'\n' ELSE '' END ||
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

    v_hunt_id := NULL;
    NEW.hunt_id := NULL;
    NEW.hunt_created := false;

    INSERT INTO hunt_contracts (
      outfitter_id,
      hunt_id,
      client_email,
      client_name,
      content,
      status,
      template_id
    ) VALUES (
      NEW.outfitter_id,
      NULL,
      NEW.client_email,
      v_client_name,
      v_content,
      'pending_client_completion',
      v_template_id
    )
    RETURNING id INTO NEW.contract_id;

    NEW.hunt_created := false;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
