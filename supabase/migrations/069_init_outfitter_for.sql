-- Function: init_outfitter_for(p_name, p_user)
-- Creates a new outfitter and owner membership for signup flow.
-- Called by web signup and iOS bootstrap.

CREATE OR REPLACE FUNCTION public.init_outfitter_for(
  p_name TEXT,
  p_user UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outfitter_id UUID;
BEGIN
  -- Create outfitter
  INSERT INTO outfitters (name)
  VALUES (NULLIF(TRIM(p_name), ''))
  RETURNING id INTO v_outfitter_id;

  IF v_outfitter_id IS NULL THEN
    RAISE EXCEPTION 'Failed to create outfitter';
  END IF;

  -- Create owner membership
  INSERT INTO outfitter_memberships (outfitter_id, user_id, role, status)
  VALUES (v_outfitter_id, p_user, 'owner', 'active');

  RETURN v_outfitter_id;
END;
$$;

COMMENT ON FUNCTION public.init_outfitter_for(TEXT, UUID) IS
  'Creates outfitter and owner membership for new signup. Returns outfitter_id.';
