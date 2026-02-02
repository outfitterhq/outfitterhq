-- Create calendar_events table
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outfitter_id UUID NOT NULL REFERENCES outfitters(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  camp_name TEXT,
  client_email TEXT,
  guide_username TEXT,
  audience TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'client', 'guide', 'internalOnly')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_outfitter ON calendar_events(outfitter_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_dates ON calendar_events(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_guide ON calendar_events(guide_username) WHERE guide_username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_client ON calendar_events(client_email) WHERE client_email IS NOT NULL;

-- Enable RLS
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see events for outfitters they have active memberships in
CREATE POLICY "Users can view calendar events for their outfitters"
  ON calendar_events
  FOR SELECT
  USING (
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
    EXISTS (
      SELECT 1 FROM outfitter_memberships
      WHERE outfitter_memberships.outfitter_id = calendar_events.outfitter_id
        AND outfitter_memberships.user_id = auth.uid()
        AND outfitter_memberships.status = 'active'
        AND outfitter_memberships.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
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

CREATE TRIGGER calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION update_calendar_events_updated_at();
