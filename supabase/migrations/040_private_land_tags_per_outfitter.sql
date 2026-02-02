-- Private land tags: per-outfitter (no longer global)
-- Edge functions use onConflict "user_id,outfitter_id" for outfitter_memberships; ensure your
-- table has a UNIQUE on (user_id, outfitter_id) or (outfitter_id, user_id).

-- =============================================================================
-- 1. private_land_tags: RLS per outfitter
-- =============================================================================
-- Column outfitter_id was added in 012; may be NULL for legacy rows.

DROP POLICY IF EXISTS "Anyone can view available tags" ON private_land_tags;
DROP POLICY IF EXISTS "Admins can manage tags" ON private_land_tags;

-- Admins see tags for their outfitter(s), or legacy tags (outfitter_id IS NULL)
CREATE POLICY "Admins can view their outfitter tags"
  ON private_land_tags
  FOR SELECT
  USING (
    outfitter_id IS NULL
    OR outfitter_id IN (
      SELECT om.outfitter_id FROM outfitter_memberships om
      WHERE om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('owner', 'admin')
    )
  );

-- Admins can insert only with their outfitter_id
CREATE POLICY "Admins can insert tags for their outfitter"
  ON private_land_tags
  FOR INSERT
  WITH CHECK (
    outfitter_id IN (
      SELECT om.outfitter_id FROM outfitter_memberships om
      WHERE om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('owner', 'admin')
    )
  );

-- Admins can update/delete only their outfitter's tags (or legacy null)
CREATE POLICY "Admins can update their outfitter tags"
  ON private_land_tags
  FOR UPDATE
  USING (
    outfitter_id IS NULL
    OR outfitter_id IN (
      SELECT om.outfitter_id FROM outfitter_memberships om
      WHERE om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete their outfitter tags"
  ON private_land_tags
  FOR DELETE
  USING (
    outfitter_id IS NULL
    OR outfitter_id IN (
      SELECT om.outfitter_id FROM outfitter_memberships om
      WHERE om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('owner', 'admin')
    )
  );

-- Clients see tags for outfitters they are linked to (for available-tags and their purchases)
CREATE POLICY "Clients can view tags for linked outfitter"
  ON private_land_tags
  FOR SELECT
  USING (
    outfitter_id IN (
      SELECT col.outfitter_id
      FROM client_outfitter_links col
      JOIN clients c ON c.id = col.client_id
      WHERE LOWER(c.email) = LOWER(auth.jwt() ->> 'email')
        AND col.is_active = true
    )
  );

-- Clients can "purchase" (update is_available) when tag is available (existing behavior)
DROP POLICY IF EXISTS "Clients can purchase available tags" ON private_land_tags;
CREATE POLICY "Clients can purchase available tags"
  ON private_land_tags
  FOR UPDATE
  USING (is_available = true)
  WITH CHECK (is_available = false);

-- Index for admin/client queries by outfitter_id
CREATE INDEX IF NOT EXISTS idx_private_land_tags_outfitter ON private_land_tags(outfitter_id)
  WHERE outfitter_id IS NOT NULL;

COMMENT ON COLUMN private_land_tags.outfitter_id IS 'Tags are per-outfitter; set on create by admin. Legacy rows may be NULL.';
