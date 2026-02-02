-- Migration: Fix ALL client RLS policies to use auth.jwt() instead of auth.users
-- This prevents "permission denied for table users" and "stack depth limit exceeded" errors

-- =============================================================================
-- 0. CLIENTS TABLE: Fix policies that cause recursion
-- =============================================================================
DROP POLICY IF EXISTS "Clients can view own record" ON clients;
CREATE POLICY "Clients can view own record"
  ON clients
  FOR SELECT
  USING (email = (auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "Clients can update own record" ON clients;
CREATE POLICY "Clients can update own record"
  ON clients
  FOR UPDATE
  USING (email = (auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "Authenticated can view clients" ON clients;
CREATE POLICY "Authenticated can view clients"
  ON clients
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- =============================================================================
-- 1. PRICING: Allow clients to view pricing
-- =============================================================================
DROP POLICY IF EXISTS "Clients can view pricing for linked outfitters" ON pricing_items;
CREATE POLICY "Clients can view pricing for linked outfitters"
  ON pricing_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM client_outfitter_links col
      JOIN clients c ON c.id = col.client_id
      WHERE col.outfitter_id = pricing_items.outfitter_id
        AND col.is_active = true
        AND c.email = (auth.jwt() ->> 'email')
    )
  );

-- =============================================================================
-- 2. DOCUMENTS: Fix ALL client policies
-- =============================================================================
DROP POLICY IF EXISTS "Clients can view own documents" ON documents;
CREATE POLICY "Clients can view own documents"
  ON documents
  FOR SELECT
  USING (
    client_id IN (
      SELECT c.id FROM clients c WHERE c.email = (auth.jwt() ->> 'email')
    )
  );

DROP POLICY IF EXISTS "Clients can update own documents" ON documents;
CREATE POLICY "Clients can update own documents"
  ON documents
  FOR UPDATE
  USING (
    client_id IN (
      SELECT c.id FROM clients c WHERE c.email = (auth.jwt() ->> 'email')
    )
  );

-- =============================================================================
-- 3. CLIENT_QUESTIONNAIRES: Fix ALL policies
-- =============================================================================
DROP POLICY IF EXISTS "Clients can view own questionnaires" ON client_questionnaires;
CREATE POLICY "Clients can view own questionnaires"
  ON client_questionnaires
  FOR SELECT
  USING (
    client_id IN (
      SELECT c.id FROM clients c WHERE c.email = (auth.jwt() ->> 'email')
    )
  );

DROP POLICY IF EXISTS "Clients can insert own questionnaires" ON client_questionnaires;
CREATE POLICY "Clients can insert own questionnaires"
  ON client_questionnaires
  FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT c.id FROM clients c WHERE c.email = (auth.jwt() ->> 'email')
    )
  );

DROP POLICY IF EXISTS "Clients can update own questionnaires" ON client_questionnaires;
CREATE POLICY "Clients can update own questionnaires"
  ON client_questionnaires
  FOR UPDATE
  USING (
    client_id IN (
      SELECT c.id FROM clients c WHERE c.email = (auth.jwt() ->> 'email')
    )
  );

-- =============================================================================
-- 4. CLIENT_PREDRAW_SUBMISSIONS: Fix ALL policies
-- =============================================================================
DROP POLICY IF EXISTS "Clients can view own predraw submissions" ON client_predraw_submissions;
CREATE POLICY "Clients can view own predraw submissions"
  ON client_predraw_submissions
  FOR SELECT
  USING (
    client_id IN (
      SELECT c.id FROM clients c WHERE c.email = (auth.jwt() ->> 'email')
    )
  );

DROP POLICY IF EXISTS "Clients can insert own predraw submissions" ON client_predraw_submissions;
CREATE POLICY "Clients can insert own predraw submissions"
  ON client_predraw_submissions
  FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT c.id FROM clients c WHERE c.email = (auth.jwt() ->> 'email')
    )
  );

DROP POLICY IF EXISTS "Clients can update own predraw submissions" ON client_predraw_submissions;
CREATE POLICY "Clients can update own predraw submissions"
  ON client_predraw_submissions
  FOR UPDATE
  USING (
    client_id IN (
      SELECT c.id FROM clients c WHERE c.email = (auth.jwt() ->> 'email')
    )
  );

-- =============================================================================
-- 5. PRIVATE LAND TAGS
-- =============================================================================
ALTER TABLE private_land_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view available tags" ON private_land_tags;
CREATE POLICY "Anyone can view available tags"
  ON private_land_tags
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage tags" ON private_land_tags;
CREATE POLICY "Admins can manage tags"
  ON private_land_tags
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM outfitter_memberships
      WHERE outfitter_memberships.user_id = auth.uid()
        AND outfitter_memberships.status = 'active'
        AND outfitter_memberships.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Clients can purchase available tags" ON private_land_tags;
CREATE POLICY "Clients can purchase available tags"
  ON private_land_tags
  FOR UPDATE
  USING (is_available = true)
  WITH CHECK (is_available = false);

-- =============================================================================
-- 6. HUNT_CONTRACTS: Fix client policies
-- =============================================================================
DROP POLICY IF EXISTS "Clients can view own hunt contracts" ON hunt_contracts;
CREATE POLICY "Clients can view own hunt contracts"
  ON hunt_contracts
  FOR SELECT
  USING (
    client_email = (auth.jwt() ->> 'email')
  );

DROP POLICY IF EXISTS "Clients can complete own hunt contracts" ON hunt_contracts;
CREATE POLICY "Clients can complete own hunt contracts"
  ON hunt_contracts
  FOR UPDATE
  USING (
    client_email = (auth.jwt() ->> 'email')
    AND status = 'pending_client_completion'
  );

-- =============================================================================
-- 7. CALENDAR_EVENTS: Allow clients to view their own hunts
-- =============================================================================
DROP POLICY IF EXISTS "Clients can view own calendar events" ON calendar_events;
CREATE POLICY "Clients can view own calendar events"
  ON calendar_events
  FOR SELECT
  USING (
    client_email = (auth.jwt() ->> 'email')
  );
