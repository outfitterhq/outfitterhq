-- Fix RLS policies to handle guides using email as username
-- The issue: guides.username might be empty, and we're using email instead
-- Solution: Update RLS policies to check both username AND email

-- Drop existing policies
DROP POLICY IF EXISTS "Guides can view their own time off" ON guide_time_off;
DROP POLICY IF EXISTS "Guides can create time off requests" ON guide_time_off;

-- RLS Policy: Guides can view their own time off (check username OR email)
CREATE POLICY "Guides can view their own time off"
  ON guide_time_off
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM guides
      WHERE (
        -- Match by username if both are set
        (guides.username IS NOT NULL AND guides.username != '' AND guides.username = guide_time_off.guide_username)
        OR
        -- Match by email if username is empty/null
        (COALESCE(guides.username, '') = '' AND guides.email = guide_time_off.guide_username)
      )
        AND guides.user_id = auth.uid()
        AND guides.outfitter_id = guide_time_off.outfitter_id
    )
    OR
    -- Admins can see all
    EXISTS (
      SELECT 1 FROM outfitter_memberships
      WHERE outfitter_memberships.outfitter_id = guide_time_off.outfitter_id
        AND outfitter_memberships.user_id = auth.uid()
        AND outfitter_memberships.status = 'active'
        AND outfitter_memberships.role IN ('owner', 'admin')
    )
  );

-- RLS Policy: Guides can create their own time off requests (check username OR email)
CREATE POLICY "Guides can create time off requests"
  ON guide_time_off
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM guides
      WHERE (
        -- Match by username if both are set
        (guides.username IS NOT NULL AND guides.username != '' AND guides.username = guide_time_off.guide_username)
        OR
        -- Match by email if username is empty/null
        (COALESCE(guides.username, '') = '' AND guides.email = guide_time_off.guide_username)
      )
        AND guides.user_id = auth.uid()
        AND guides.outfitter_id = guide_time_off.outfitter_id
    )
  );
