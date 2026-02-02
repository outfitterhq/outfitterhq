-- Migration to add iOS-compatible columns to existing calendar_events table
-- This preserves your existing contract-based schema while adding the simpler iOS model fields

-- Add outfitter_id column (required for multi-tenant filtering)
ALTER TABLE calendar_events 
ADD COLUMN IF NOT EXISTS outfitter_id UUID REFERENCES outfitters(id) ON DELETE CASCADE;

-- Add iOS model fields
ALTER TABLE calendar_events 
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS camp_name TEXT,
ADD COLUMN IF NOT EXISTS client_email TEXT,
ADD COLUMN IF NOT EXISTS guide_username TEXT,
ADD COLUMN IF NOT EXISTS audience TEXT DEFAULT 'all' CHECK (audience IN ('all', 'client', 'guide', 'internalOnly')),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill outfitter_id from contracts if contract_id exists
-- This ensures existing rows have outfitter_id set
-- First try to get outfitter_id from clients via contracts
UPDATE calendar_events ce
SET outfitter_id = (
  SELECT cl.outfitter_id
  FROM contracts c
  JOIN clients cl ON cl.id = c.client_id
  WHERE c.id = ce.contract_id
)
WHERE ce.outfitter_id IS NULL AND ce.contract_id IS NOT NULL;


-- Backfill outfitter_id from guides if guide_id exists
UPDATE calendar_events ce
SET outfitter_id = (
  SELECT g.outfitter_id
  FROM guides g
  WHERE g.id = ce.guide_id
)
WHERE ce.outfitter_id IS NULL AND ce.guide_id IS NOT NULL;

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_outfitter ON calendar_events(outfitter_id) WHERE outfitter_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_dates_new ON calendar_events(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_guide_username ON calendar_events(guide_username) WHERE guide_username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_client_email ON calendar_events(client_email) WHERE client_email IS NOT NULL;

-- Enable RLS if not already enabled
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (we'll recreate them)
DROP POLICY IF EXISTS "Users can view calendar events for their outfitters" ON calendar_events;
DROP POLICY IF EXISTS "Owners and admins can manage calendar events" ON calendar_events;

-- RLS Policy: Users can only see events for outfitters they have active memberships in
CREATE POLICY "Users can view calendar events for their outfitters"
  ON calendar_events
  FOR SELECT
  USING (
    outfitter_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM outfitter_memberships
      WHERE outfitter_memberships.outfitter_id = calendar_events.outfitter_id
        AND outfitter_memberships.user_id = auth.uid()
        AND outfitter_memberships.status = 'active'
    )
  );

-- RLS Policy: Only owners/admins can insert/update/delete
CREATE POLICY "Owners and admins can manage calendar events"
  ON calendar_events
  FOR ALL
  USING (
    outfitter_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM outfitter_memberships
      WHERE outfitter_memberships.outfitter_id = calendar_events.outfitter_id
        AND outfitter_memberships.user_id = auth.uid()
        AND outfitter_memberships.status = 'active'
        AND outfitter_memberships.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    outfitter_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM outfitter_memberships
      WHERE outfitter_memberships.outfitter_id = calendar_events.outfitter_id
        AND outfitter_memberships.user_id = auth.uid()
        AND outfitter_memberships.status = 'active'
        AND outfitter_memberships.role IN ('owner', 'admin')
    )
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_calendar_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists, then recreate
DROP TRIGGER IF EXISTS calendar_events_updated_at ON calendar_events;
CREATE TRIGGER calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION update_calendar_events_updated_at();
