-- Migration: Camps and Lodges System
-- Supports multi-client camps, lodge capacity, OnX locations, and cook profiles

-- =============================================================================
-- 1. LODGES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS lodges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outfitter_id UUID NOT NULL REFERENCES outfitters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  gps_latitude DECIMAL(10, 8),
  gps_longitude DECIMAL(11, 8),
  onx_share_link TEXT,
  description TEXT,
  max_clients INTEGER NOT NULL DEFAULT 10,
  max_guides INTEGER NOT NULL DEFAULT 5,
  max_beds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(outfitter_id, name)
);

-- Lodge photo gallery
CREATE TABLE IF NOT EXISTS lodge_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id UUID NOT NULL REFERENCES lodges(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  photo_type TEXT CHECK (photo_type IN ('exterior', 'interior', 'common_area', 'parking', 'other')),
  display_order INTEGER DEFAULT 0,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(storage_path)
);

-- =============================================================================
-- 2. CAMPS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS camps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outfitter_id UUID NOT NULL REFERENCES outfitters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  state TEXT NOT NULL,
  unit TEXT NOT NULL,
  hunt_code TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  camp_type TEXT NOT NULL CHECK (camp_type IN ('lodge', 'spike', 'mobile')),
  lodge_id UUID REFERENCES lodges(id) ON DELETE SET NULL,
  
  -- Capacity (inherited from lodge if lodge_id set, else manual)
  max_clients INTEGER,
  max_guides INTEGER,
  
  -- OnX Location (for camp itself, separate from lodge)
  onx_share_link TEXT,
  gps_latitude DECIMAL(10, 8),
  gps_longitude DECIMAL(11, 8),
  location_label TEXT, -- Optional address/pin name
  
  -- Camp Manager
  camp_manager_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(outfitter_id, name, start_date)
);

-- =============================================================================
-- 3. CAMP CLIENT ASSIGNMENTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS camp_client_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_id UUID NOT NULL REFERENCES camps(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES auth.users(id),
  
  UNIQUE(camp_id, client_id)
);

-- =============================================================================
-- 4. CAMP GUIDE ASSIGNMENTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS camp_guide_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_id UUID NOT NULL REFERENCES camps(id) ON DELETE CASCADE,
  guide_id UUID NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES auth.users(id),
  
  UNIQUE(camp_id, guide_id)
);

-- =============================================================================
-- 5. COOK PROFILES
-- =============================================================================
CREATE TABLE IF NOT EXISTS cook_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outfitter_id UUID NOT NULL REFERENCES outfitters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_phone TEXT,
  contact_email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cook camp assignments
CREATE TABLE IF NOT EXISTS cook_camp_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id UUID NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  camp_id UUID NOT NULL REFERENCES camps(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(cook_id, camp_id)
);

-- =============================================================================
-- INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_lodges_outfitter ON lodges(outfitter_id);
CREATE INDEX IF NOT EXISTS idx_lodge_photos_lodge ON lodge_photos(lodge_id);
CREATE INDEX IF NOT EXISTS idx_camps_outfitter ON camps(outfitter_id);
CREATE INDEX IF NOT EXISTS idx_camps_lodge ON camps(lodge_id);
CREATE INDEX IF NOT EXISTS idx_camps_dates ON camps(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_camp_clients_camp ON camp_client_assignments(camp_id);
CREATE INDEX IF NOT EXISTS idx_camp_clients_client ON camp_client_assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_camp_guides_camp ON camp_guide_assignments(camp_id);
CREATE INDEX IF NOT EXISTS idx_camp_guides_guide ON camp_guide_assignments(guide_id);
CREATE INDEX IF NOT EXISTS idx_cook_profiles_outfitter ON cook_profiles(outfitter_id);
CREATE INDEX IF NOT EXISTS idx_cook_assignments_cook ON cook_camp_assignments(cook_id);
CREATE INDEX IF NOT EXISTS idx_cook_assignments_camp ON cook_camp_assignments(camp_id);

-- =============================================================================
-- HELPER FUNCTIONS FOR RLS (Avoid circular dependencies)
-- =============================================================================

-- Function to check if user is admin/owner of a camp's outfitter
-- Uses SECURITY DEFINER to bypass RLS when checking camps table
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

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

-- Lodges
ALTER TABLE lodges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage lodges" ON lodges;
CREATE POLICY "Admins can manage lodges"
  ON lodges FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM outfitter_memberships
      WHERE outfitter_memberships.outfitter_id = lodges.outfitter_id
        AND outfitter_memberships.user_id = auth.uid()
        AND outfitter_memberships.status = 'active'
        AND outfitter_memberships.role IN ('owner', 'admin')
    )
  );

-- Lodge Photos
ALTER TABLE lodge_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage lodge photos" ON lodge_photos;
CREATE POLICY "Admins can manage lodge photos"
  ON lodge_photos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM lodges l
      JOIN outfitter_memberships om ON om.outfitter_id = l.outfitter_id
      WHERE l.id = lodge_photos.lodge_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('owner', 'admin')
    )
  );

-- Clients can view lodge photos for camps they're assigned to
-- Note: Using user email from auth.users requires proper permissions
-- Alternative: Check via client record email match
DROP POLICY IF EXISTS "Clients can view assigned camp lodge photos" ON lodge_photos;
CREATE POLICY "Clients can view assigned camp lodge photos"
  ON lodge_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM camps c
      JOIN camp_client_assignments cca ON cca.camp_id = c.id
      JOIN clients cl ON cl.id = cca.client_id
      JOIN auth.users u ON u.email = cl.email
      WHERE c.lodge_id = lodge_photos.lodge_id
        AND u.id = auth.uid()
    )
  );

-- Camps
ALTER TABLE camps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage camps" ON camps;
CREATE POLICY "Admins can manage camps"
  ON camps FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM outfitter_memberships
      WHERE outfitter_memberships.outfitter_id = camps.outfitter_id
        AND outfitter_memberships.user_id = auth.uid()
        AND outfitter_memberships.status = 'active'
        AND outfitter_memberships.role IN ('owner', 'admin')
    )
  );

-- Guides can view camps they're assigned to
DROP POLICY IF EXISTS "Guides can view assigned camps" ON camps;
CREATE POLICY "Guides can view assigned camps"
  ON camps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM camp_guide_assignments cga
      JOIN guides g ON g.id = cga.guide_id
      WHERE cga.camp_id = camps.id
        AND g.user_id = auth.uid()
    )
  );

-- Clients can view camps they're assigned to
DROP POLICY IF EXISTS "Clients can view assigned camps" ON camps;
CREATE POLICY "Clients can view assigned camps"
  ON camps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM camp_client_assignments cca
      JOIN clients cl ON cl.id = cca.client_id
      WHERE cca.camp_id = camps.id
        AND cl.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Camp Client Assignments
ALTER TABLE camp_client_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage camp client assignments" ON camp_client_assignments;
CREATE POLICY "Admins can manage camp client assignments"
  ON camp_client_assignments FOR ALL
  USING (check_camp_admin_access(camp_id))
  WITH CHECK (check_camp_admin_access(camp_id));

-- Camp Guide Assignments
ALTER TABLE camp_guide_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage camp guide assignments" ON camp_guide_assignments;
CREATE POLICY "Admins can manage camp guide assignments"
  ON camp_guide_assignments FOR ALL
  USING (check_camp_admin_access(camp_id))
  WITH CHECK (check_camp_admin_access(camp_id));

-- Guides can view their own assignments
DROP POLICY IF EXISTS "Guides can view own camp assignments" ON camp_guide_assignments;
CREATE POLICY "Guides can view own camp assignments"
  ON camp_guide_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM guides g
      WHERE g.id = camp_guide_assignments.guide_id
        AND g.user_id = auth.uid()
    )
  );

-- Cook Profiles
ALTER TABLE cook_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage cook profiles" ON cook_profiles;
CREATE POLICY "Admins can manage cook profiles"
  ON cook_profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM outfitter_memberships
      WHERE outfitter_memberships.outfitter_id = cook_profiles.outfitter_id
        AND outfitter_memberships.user_id = auth.uid()
        AND outfitter_memberships.status = 'active'
        AND outfitter_memberships.role IN ('owner', 'admin')
    )
  );

-- Cook Camp Assignments
ALTER TABLE cook_camp_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage cook camp assignments" ON cook_camp_assignments;
CREATE POLICY "Admins can manage cook camp assignments"
  ON cook_camp_assignments FOR ALL
  USING (check_camp_admin_access(camp_id))
  WITH CHECK (check_camp_admin_access(camp_id));

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_lodges_updated_at ON lodges;
CREATE TRIGGER update_lodges_updated_at
  BEFORE UPDATE ON lodges
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_camps_updated_at ON camps;
CREATE TRIGGER update_camps_updated_at
  BEFORE UPDATE ON camps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cook_profiles_updated_at ON cook_profiles;
CREATE TRIGGER update_cook_profiles_updated_at
  BEFORE UPDATE ON cook_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-set camp capacity from lodge if lodge_id is set
CREATE OR REPLACE FUNCTION sync_camp_capacity_from_lodge()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lodge_id IS NOT NULL THEN
    SELECT max_clients, max_guides
    INTO NEW.max_clients, NEW.max_guides
    FROM lodges
    WHERE id = NEW.lodge_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_camp_capacity ON camps;
CREATE TRIGGER sync_camp_capacity
  BEFORE INSERT OR UPDATE ON camps
  FOR EACH ROW
  WHEN (NEW.lodge_id IS NOT NULL)
  EXECUTE FUNCTION sync_camp_capacity_from_lodge();

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON TABLE lodges IS 'Reusable lodge profiles with capacity limits and photo galleries';
COMMENT ON TABLE camps IS 'Camp instances with dates, location, and assignments. Can be lodge-based or mobile/spike';
COMMENT ON TABLE camp_client_assignments IS 'Links clients to camps (multi-client support)';
COMMENT ON TABLE camp_guide_assignments IS 'Links guides to camps';
COMMENT ON TABLE cook_profiles IS 'Cook/staff profiles for meal management';
COMMENT ON COLUMN camps.camp_manager_user_id IS 'User ID of the camp manager (guide or staff member)';
COMMENT ON COLUMN camps.onx_share_link IS 'OnX share link for camp location navigation';
COMMENT ON COLUMN lodges.onx_share_link IS 'OnX share link for lodge location navigation';
