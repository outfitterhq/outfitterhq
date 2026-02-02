-- Create guide_time_off table for guide time off requests
CREATE TABLE IF NOT EXISTS guide_time_off (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outfitter_id UUID NOT NULL REFERENCES outfitters(id) ON DELETE CASCADE,
  guide_username TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_guide_time_off_outfitter ON guide_time_off(outfitter_id);
CREATE INDEX IF NOT EXISTS idx_guide_time_off_guide ON guide_time_off(guide_username);
CREATE INDEX IF NOT EXISTS idx_guide_time_off_status ON guide_time_off(status);
CREATE INDEX IF NOT EXISTS idx_guide_time_off_dates ON guide_time_off(start_date, end_date);

-- Enable RLS
ALTER TABLE guide_time_off ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Guides can view their own time off requests
CREATE POLICY "Guides can view their own time off"
  ON guide_time_off
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM guides
      WHERE guides.username = guide_time_off.guide_username
        AND guides.user_id = auth.uid()
        AND guides.outfitter_id = guide_time_off.outfitter_id
    )
    OR
    EXISTS (
      SELECT 1 FROM outfitter_memberships
      WHERE outfitter_memberships.outfitter_id = guide_time_off.outfitter_id
        AND outfitter_memberships.user_id = auth.uid()
        AND outfitter_memberships.status = 'active'
        AND outfitter_memberships.role IN ('owner', 'admin')
    )
  );

-- RLS Policy: Guides can create their own time off requests
CREATE POLICY "Guides can create time off requests"
  ON guide_time_off
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM guides
      WHERE guides.username = guide_time_off.guide_username
        AND guides.user_id = auth.uid()
        AND guides.outfitter_id = guide_time_off.outfitter_id
    )
  );

-- RLS Policy: Only owners/admins can update (approve/deny)
CREATE POLICY "Owners and admins can manage time off"
  ON guide_time_off
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM outfitter_memberships
      WHERE outfitter_memberships.outfitter_id = guide_time_off.outfitter_id
        AND outfitter_memberships.user_id = auth.uid()
        AND outfitter_memberships.status = 'active'
        AND outfitter_memberships.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM outfitter_memberships
      WHERE outfitter_memberships.outfitter_id = guide_time_off.outfitter_id
        AND outfitter_memberships.user_id = auth.uid()
        AND outfitter_memberships.status = 'active'
        AND outfitter_memberships.role IN ('owner', 'admin')
    )
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_guide_time_off_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER guide_time_off_updated_at
  BEFORE UPDATE ON guide_time_off
  FOR EACH ROW
  EXECUTE FUNCTION update_guide_time_off_updated_at();
