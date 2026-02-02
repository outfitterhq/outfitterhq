-- Outfitter Codes: Clients join outfitters via codes instead of picking from a list
-- Supports single-use, multi-use, expiration, and client-outfitter linking

-- Make clients.outfitter_id nullable (clients can sign up without a code)
ALTER TABLE clients ALTER COLUMN outfitter_id DROP NOT NULL;

-- Create outfitter_codes table
CREATE TABLE IF NOT EXISTS outfitter_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outfitter_id UUID NOT NULL REFERENCES outfitters(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  single_use BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  notes TEXT
);

-- Track which clients have used which codes (for single-use tracking)
CREATE TABLE IF NOT EXISTS outfitter_code_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id UUID NOT NULL REFERENCES outfitter_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  used_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(code_id, user_id)
);

-- Create client-outfitter link table (many-to-many: clients can belong to multiple outfitters)
CREATE TABLE IF NOT EXISTS client_outfitter_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  outfitter_id UUID NOT NULL REFERENCES outfitters(id) ON DELETE CASCADE,
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  linked_via_code_id UUID REFERENCES outfitter_codes(id),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(client_id, outfitter_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_outfitter_codes_code ON outfitter_codes(code) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_outfitter_codes_outfitter ON outfitter_codes(outfitter_id);
CREATE INDEX IF NOT EXISTS idx_outfitter_code_uses_code ON outfitter_code_uses(code_id);
CREATE INDEX IF NOT EXISTS idx_outfitter_code_uses_user ON outfitter_code_uses(user_id);
CREATE INDEX IF NOT EXISTS idx_client_outfitter_links_client ON client_outfitter_links(client_id);
CREATE INDEX IF NOT EXISTS idx_client_outfitter_links_outfitter ON client_outfitter_links(outfitter_id);

-- RLS for outfitter_codes
ALTER TABLE outfitter_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active codes" ON outfitter_codes;
CREATE POLICY "Anyone can view active codes"
  ON outfitter_codes FOR SELECT
  USING (is_active = true AND (expires_at IS NULL OR expires_at > NOW()));

DROP POLICY IF EXISTS "Admins can manage codes for their outfitters" ON outfitter_codes;
CREATE POLICY "Admins can manage codes for their outfitters"
  ON outfitter_codes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM outfitter_memberships
      WHERE outfitter_memberships.outfitter_id = outfitter_codes.outfitter_id
        AND outfitter_memberships.user_id = auth.uid()
        AND outfitter_memberships.status = 'active'
        AND outfitter_memberships.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM outfitter_memberships
      WHERE outfitter_memberships.outfitter_id = outfitter_codes.outfitter_id
        AND outfitter_memberships.user_id = auth.uid()
        AND outfitter_memberships.status = 'active'
        AND outfitter_memberships.role IN ('owner', 'admin')
    )
  );

-- RLS for outfitter_code_uses (read-only for users, admins can view)
ALTER TABLE outfitter_code_uses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own code uses" ON outfitter_code_uses;
CREATE POLICY "Users can view their own code uses"
  ON outfitter_code_uses FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "System can insert code uses" ON outfitter_code_uses;
CREATE POLICY "System can insert code uses"
  ON outfitter_code_uses FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- RLS for client_outfitter_links
ALTER TABLE client_outfitter_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own links" ON client_outfitter_links;
CREATE POLICY "Users can view their own links"
  ON client_outfitter_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = client_outfitter_links.client_id
        AND clients.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can view links for their outfitters" ON client_outfitter_links;
CREATE POLICY "Admins can view links for their outfitters"
  ON client_outfitter_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM outfitter_memberships
      WHERE outfitter_memberships.outfitter_id = client_outfitter_links.outfitter_id
        AND outfitter_memberships.user_id = auth.uid()
        AND outfitter_memberships.status = 'active'
        AND outfitter_memberships.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "System can create links" ON client_outfitter_links;
CREATE POLICY "System can create links"
  ON client_outfitter_links FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = client_outfitter_links.client_id
        AND clients.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Function to validate and use an outfitter code
CREATE OR REPLACE FUNCTION validate_and_use_outfitter_code(
  p_code TEXT,
  p_user_id UUID
)
RETURNS TABLE(
  success BOOLEAN,
  outfitter_id UUID,
  message TEXT
) AS $$
DECLARE
  v_code_record outfitter_codes%ROWTYPE;
  v_already_used BOOLEAN;
  v_client_id UUID;
BEGIN
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

  -- Get client_id from user email
  SELECT id INTO v_client_id
  FROM clients
  WHERE email = (SELECT email FROM auth.users WHERE id = p_user_id)
  LIMIT 1;

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

  -- Create link
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
