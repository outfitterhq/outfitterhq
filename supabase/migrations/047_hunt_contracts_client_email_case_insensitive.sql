-- Clients can view/update hunt contracts by email; make RLS case-insensitive
-- so web and iOS show contracts regardless of stored vs JWT email casing.

DROP POLICY IF EXISTS "Clients can view own hunt contracts" ON hunt_contracts;
CREATE POLICY "Clients can view own hunt contracts"
  ON hunt_contracts
  FOR SELECT
  USING (
    LOWER(TRIM(client_email)) = LOWER(TRIM(auth.jwt() ->> 'email'))
  );

DROP POLICY IF EXISTS "Clients can complete own hunt contracts" ON hunt_contracts;
CREATE POLICY "Clients can complete own hunt contracts"
  ON hunt_contracts
  FOR UPDATE
  USING (
    LOWER(TRIM(client_email)) = LOWER(TRIM(auth.jwt() ->> 'email'))
    AND status = 'pending_client_completion'
  );
