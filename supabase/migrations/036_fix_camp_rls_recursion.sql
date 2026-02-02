-- Migration: Fix infinite recursion in camp RLS policies
-- This migration fixes the circular dependency issue by using a SECURITY DEFINER function

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Admins can manage camp client assignments" ON camp_client_assignments;
DROP POLICY IF EXISTS "Admins can manage camp guide assignments" ON camp_guide_assignments;
DROP POLICY IF EXISTS "Admins can manage cook camp assignments" ON cook_camp_assignments;

-- Create helper function to check camp admin access without triggering RLS recursion
CREATE OR REPLACE FUNCTION check_camp_admin_access(camp_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM camps c
    JOIN outfitter_memberships om ON om.outfitter_id = c.outfitter_id
    WHERE c.id = camp_id_param
      AND om.user_id = auth.uid()
      AND om.status = 'active'
      AND om.role IN ('owner', 'admin')
  );
END;
$$;

-- Recreate policies using the helper function
CREATE POLICY "Admins can manage camp client assignments"
  ON camp_client_assignments FOR ALL
  USING (check_camp_admin_access(camp_id))
  WITH CHECK (check_camp_admin_access(camp_id));

CREATE POLICY "Admins can manage camp guide assignments"
  ON camp_guide_assignments FOR ALL
  USING (check_camp_admin_access(camp_id))
  WITH CHECK (check_camp_admin_access(camp_id));

CREATE POLICY "Admins can manage cook camp assignments"
  ON cook_camp_assignments FOR ALL
  USING (check_camp_admin_access(camp_id))
  WITH CHECK (check_camp_admin_access(camp_id));
