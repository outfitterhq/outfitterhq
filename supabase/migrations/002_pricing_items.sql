-- Create pricing_items table for outfitter pricing management
CREATE TABLE IF NOT EXISTS pricing_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outfitter_id UUID NOT NULL REFERENCES outfitters(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  amount_usd NUMERIC NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_pricing_items_outfitter ON pricing_items(outfitter_id);
CREATE INDEX IF NOT EXISTS idx_pricing_items_category ON pricing_items(category);

-- Enable RLS
ALTER TABLE pricing_items ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view pricing for their outfitters
CREATE POLICY "Users can view pricing for their outfitters"
  ON pricing_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM outfitter_memberships
      WHERE outfitter_memberships.outfitter_id = pricing_items.outfitter_id
        AND outfitter_memberships.user_id = auth.uid()
        AND outfitter_memberships.status = 'active'
    )
  );

-- RLS Policy: Only owners/admins can manage pricing
CREATE POLICY "Owners and admins can manage pricing"
  ON pricing_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM outfitter_memberships
      WHERE outfitter_memberships.outfitter_id = pricing_items.outfitter_id
        AND outfitter_memberships.user_id = auth.uid()
        AND outfitter_memberships.status = 'active'
        AND outfitter_memberships.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM outfitter_memberships
      WHERE outfitter_memberships.outfitter_id = pricing_items.outfitter_id
        AND outfitter_memberships.user_id = auth.uid()
        AND outfitter_memberships.status = 'active'
        AND outfitter_memberships.role IN ('owner', 'admin')
    )
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_pricing_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pricing_items_updated_at
  BEFORE UPDATE ON pricing_items
  FOR EACH ROW
  EXECUTE FUNCTION update_pricing_items_updated_at();
