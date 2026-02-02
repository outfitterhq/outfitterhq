-- When a user enters an outfitter code but has no client record yet (e.g. signed up via
-- generic auth without the client signup flow), create a minimal client record so the
-- code can link them to the outfitter. Fixes "Client record not found. Please contact support."
-- Must DROP first because we change the return type (outfitter_id -> linked_outfitter_id).

DROP FUNCTION IF EXISTS validate_and_use_outfitter_code(TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION validate_and_use_outfitter_code(
  p_code TEXT,
  p_user_id UUID,
  p_email TEXT DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  linked_outfitter_id UUID,
  message TEXT
) AS $$
DECLARE
  v_code_record outfitter_codes%ROWTYPE;
  v_already_used BOOLEAN;
  v_client_id UUID;
  v_email TEXT;
  v_first_name TEXT;
  v_last_name TEXT;
BEGIN
  -- Resolve email: use p_email if provided, else auth.users email
  IF p_email IS NOT NULL AND TRIM(p_email) != '' THEN
    v_email := LOWER(TRIM(p_email));
  ELSE
    SELECT LOWER(email) INTO v_email FROM auth.users WHERE id = p_user_id LIMIT 1;
  END IF;

  IF v_email IS NULL OR v_email = '' THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Client record not found. Please contact support.'::TEXT;
    RETURN;
  END IF;

  -- Find the code
  SELECT * INTO v_code_record
  FROM outfitter_codes
  WHERE code = UPPER(TRIM(p_code))
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW());

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Invalid or expired code.'::TEXT;
    RETURN;
  END IF;

  -- Check if single-use and already used by this user
  IF v_code_record.single_use THEN
    SELECT EXISTS(
      SELECT 1 FROM outfitter_code_uses
      WHERE code_id = v_code_record.id AND user_id = p_user_id
    ) INTO v_already_used;

    IF v_already_used THEN
      RETURN QUERY SELECT false, NULL::UUID, 'This code has already been used.'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- Get client_id by email (or create client if none exists)
  SELECT id INTO v_client_id
  FROM clients
  WHERE LOWER(email) = v_email
  LIMIT 1;

  IF v_client_id IS NULL THEN
    -- No client record yet (e.g. user signed up without client signup flow). Create one.
    SELECT COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', '')
      INTO v_first_name
      FROM auth.users WHERE id = p_user_id LIMIT 1;
    v_first_name := TRIM(COALESCE(v_first_name, ''));
    IF v_first_name = '' OR position(' ' in v_first_name) = 0 THEN
      v_first_name := split_part(v_email, '@', 1);
      v_last_name := '';
    ELSE
      v_last_name := trim(substring(v_first_name from position(' ' in v_first_name) for 1000));
      v_first_name := trim(split_part(v_first_name, ' ', 1));
    END IF;

    BEGIN
      INSERT INTO clients (email, first_name, last_name)
      VALUES (v_email, NULLIF(v_first_name, ''), NULLIF(v_last_name, ''))
      RETURNING id INTO v_client_id;
    EXCEPTION
      WHEN unique_violation THEN
        -- Another process or trigger created the client; fetch by email
        SELECT id INTO v_client_id FROM clients WHERE LOWER(email) = v_email LIMIT 1;
    END;

    IF v_client_id IS NULL THEN
      SELECT id INTO v_client_id FROM clients WHERE LOWER(email) = v_email LIMIT 1;
    END IF;
  END IF;

  IF v_client_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Client record not found. Please contact support.'::TEXT;
    RETURN;
  END IF;

  -- Check if already linked
  IF EXISTS(
    SELECT 1 FROM client_outfitter_links
    WHERE client_id = v_client_id AND outfitter_id = v_code_record.outfitter_id AND is_active = true
  ) THEN
    RETURN QUERY SELECT true, v_code_record.outfitter_id, 'Already linked to this outfitter.'::TEXT;
    RETURN;
  END IF;

  -- Create link (RETURNS TABLE uses linked_outfitter_id to avoid ambiguous "outfitter_id" in ON CONFLICT)
  INSERT INTO client_outfitter_links (client_id, outfitter_id, linked_via_code_id)
  VALUES (v_client_id, v_code_record.outfitter_id, v_code_record.id)
  ON CONFLICT (client_id, outfitter_id) DO UPDATE
  SET is_active = true, linked_via_code_id = v_code_record.id, linked_at = NOW();

  -- Record code use
  INSERT INTO outfitter_code_uses (code_id, user_id)
  VALUES (v_code_record.id, p_user_id)
  ON CONFLICT (code_id, user_id) DO NOTHING;

  RETURN QUERY SELECT true, v_code_record.outfitter_id, 'Successfully linked to outfitter.'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION validate_and_use_outfitter_code(TEXT, UUID, TEXT) IS
  'Validates outfitter code and links client to outfitter. Creates client record from auth if missing. p_email optional.';
