-- Migration: Hunt Closeout & Success Archive System
-- Adds required post-hunt closeout workflow with photo uploads and success tracking

-- =============================================================================
-- 1. UPDATE HUNT STATUS ENUM (add new statuses)
-- =============================================================================

-- Drop the existing check constraint
ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS calendar_events_status_check;

-- Add new check constraint with expanded statuses
ALTER TABLE calendar_events 
ADD CONSTRAINT calendar_events_status_check 
CHECK (status IN ('Inquiry', 'Pending', 'Booked', 'In Progress', 'Completed', 'Pending Closeout', 'Closed', 'Cancelled'));

-- =============================================================================
-- 2. CREATE HUNT_CLOSEOUTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS hunt_closeouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hunt_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  outfitter_id UUID NOT NULL REFERENCES outfitters(id) ON DELETE CASCADE,
  guide_username TEXT NOT NULL,
  client_email TEXT,
  
  -- Success Details
  harvested BOOLEAN NOT NULL DEFAULT false,
  species TEXT,
  weapon TEXT CHECK (weapon IN ('Rifle', 'Muzzleloader', 'Bow', 'Any Legal')),
  unit TEXT,
  state TEXT,
  hunt_dates TEXT, -- JSON array of dates hunted: ["2025-09-15", "2025-09-16"]
  
  -- Optional Notes
  success_summary TEXT,
  weather_conditions TEXT,
  animal_quality_notes TEXT, -- e.g., "6x6 bull, 320-340 score range"
  
  -- Status
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_by TEXT, -- guide_username who submitted
  is_locked BOOLEAN DEFAULT true, -- Once submitted, locked unless admin unlocks
  unlocked_by TEXT, -- admin who unlocked (if unlocked)
  unlocked_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one closeout per hunt
  UNIQUE(hunt_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_hunt_closeouts_hunt ON hunt_closeouts(hunt_id);
CREATE INDEX IF NOT EXISTS idx_hunt_closeouts_outfitter ON hunt_closeouts(outfitter_id);
CREATE INDEX IF NOT EXISTS idx_hunt_closeouts_guide ON hunt_closeouts(guide_username);
CREATE INDEX IF NOT EXISTS idx_hunt_closeouts_species ON hunt_closeouts(species) WHERE species IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hunt_closeouts_unit ON hunt_closeouts(unit) WHERE unit IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hunt_closeouts_weapon ON hunt_closeouts(weapon) WHERE weapon IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hunt_closeouts_state ON hunt_closeouts(state) WHERE state IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hunt_closeouts_harvested ON hunt_closeouts(harvested);

-- =============================================================================
-- 3. CREATE HUNT_PHOTOS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS hunt_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closeout_id UUID NOT NULL REFERENCES hunt_closeouts(id) ON DELETE CASCADE,
  hunt_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  outfitter_id UUID NOT NULL REFERENCES outfitters(id) ON DELETE CASCADE,
  
  -- Photo Metadata
  storage_path TEXT NOT NULL, -- Path in Supabase Storage bucket "hunt-photos"
  file_name TEXT NOT NULL,
  file_size BIGINT, -- bytes
  content_type TEXT DEFAULT 'image/jpeg',
  
  -- Photo Categories (optional but powerful for filtering)
  category TEXT CHECK (category IN ('Harvest', 'Landscape', 'Camp', 'Client + Guide', 'Other')),
  
  -- Marketing Permission
  approved_for_marketing BOOLEAN DEFAULT false,
  is_private BOOLEAN DEFAULT false, -- If true, client-only (not for marketing)
  
  -- Auto-tags (populated from hunt/closeout data)
  species TEXT,
  weapon TEXT,
  unit TEXT,
  state TEXT,
  season_year INTEGER, -- e.g., 2025
  guide_username TEXT,
  
  -- Ordering
  display_order INTEGER DEFAULT 0, -- For sorting photos in gallery
  
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by TEXT, -- guide_username
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hunt_photos_closeout ON hunt_photos(closeout_id);
CREATE INDEX IF NOT EXISTS idx_hunt_photos_hunt ON hunt_photos(hunt_id);
CREATE INDEX IF NOT EXISTS idx_hunt_photos_outfitter ON hunt_photos(outfitter_id);
CREATE INDEX IF NOT EXISTS idx_hunt_photos_marketing ON hunt_photos(approved_for_marketing, is_private) WHERE approved_for_marketing = true;
CREATE INDEX IF NOT EXISTS idx_hunt_photos_category ON hunt_photos(category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hunt_photos_species ON hunt_photos(species) WHERE species IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hunt_photos_unit ON hunt_photos(unit) WHERE unit IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hunt_photos_weapon ON hunt_photos(weapon) WHERE weapon IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hunt_photos_state ON hunt_photos(state) WHERE state IS NOT NULL;

-- =============================================================================
-- 4. CREATE SUCCESS_RECORDS VIEW (for easy querying)
-- =============================================================================

CREATE OR REPLACE VIEW success_records AS
SELECT 
  hc.id as closeout_id,
  hc.hunt_id,
  hc.outfitter_id,
  ce.title as hunt_title,
  hc.guide_username,
  hc.client_email,
  hc.harvested,
  hc.species,
  hc.weapon,
  hc.unit,
  hc.state,
  hc.hunt_dates,
  hc.success_summary,
  hc.weather_conditions,
  hc.animal_quality_notes,
  hc.submitted_at,
  EXTRACT(YEAR FROM ce.start_time) as season_year,
  -- Photo counts
  (SELECT COUNT(*) FROM hunt_photos hp WHERE hp.closeout_id = hc.id) as total_photos,
  (SELECT COUNT(*) FROM hunt_photos hp WHERE hp.closeout_id = hc.id AND hp.approved_for_marketing = true) as marketing_photos
FROM hunt_closeouts hc
JOIN calendar_events ce ON ce.id = hc.hunt_id
WHERE hc.harvested = true; -- Only successful hunts

-- =============================================================================
-- 5. TRIGGER: Auto-update hunt status when closeout is submitted
-- =============================================================================

CREATE OR REPLACE FUNCTION update_hunt_status_on_closeout()
RETURNS TRIGGER AS $$
BEGIN
  -- When closeout is submitted, mark hunt as "Closed"
  UPDATE calendar_events
  SET status = 'Closed',
      updated_at = NOW()
  WHERE id = NEW.hunt_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_hunt_status_on_closeout
AFTER INSERT ON hunt_closeouts
FOR EACH ROW
EXECUTE FUNCTION update_hunt_status_on_closeout();

-- =============================================================================
-- 6. TRIGGER: Auto-tag photos with hunt metadata
-- =============================================================================

CREATE OR REPLACE FUNCTION auto_tag_hunt_photos()
RETURNS TRIGGER AS $$
DECLARE
  v_closeout hunt_closeouts%ROWTYPE;
  v_hunt calendar_events%ROWTYPE;
BEGIN
  -- Get closeout data
  SELECT * INTO v_closeout FROM hunt_closeouts WHERE id = NEW.closeout_id;
  
  -- Get hunt data
  SELECT * INTO v_hunt FROM calendar_events WHERE id = NEW.hunt_id;
  
  -- Auto-populate tags from closeout/hunt data
  NEW.species := COALESCE(NEW.species, v_closeout.species);
  NEW.weapon := COALESCE(NEW.weapon, v_closeout.weapon);
  NEW.unit := COALESCE(NEW.unit, v_closeout.unit);
  NEW.state := COALESCE(NEW.state, v_closeout.state);
  NEW.guide_username := COALESCE(NEW.guide_username, v_closeout.guide_username);
  NEW.season_year := EXTRACT(YEAR FROM v_hunt.start_time)::INTEGER;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_tag_hunt_photos
BEFORE INSERT OR UPDATE ON hunt_photos
FOR EACH ROW
EXECUTE FUNCTION auto_tag_hunt_photos();

-- =============================================================================
-- 7. TRIGGER: Auto-change hunt status to "Pending Closeout" when hunt ends
-- =============================================================================

CREATE OR REPLACE FUNCTION check_hunt_end_date()
RETURNS TRIGGER AS $$
BEGIN
  -- If hunt status is "Completed" or "In Progress" and end_time has passed, change to "Pending Closeout"
  IF (NEW.status = 'Completed' OR NEW.status = 'In Progress') 
     AND NEW.end_time < NOW()
     AND NOT EXISTS (SELECT 1 FROM hunt_closeouts WHERE hunt_id = NEW.id) THEN
    NEW.status := 'Pending Closeout';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on update (when admin changes status to Completed)
CREATE TRIGGER trigger_check_hunt_end_date
BEFORE UPDATE ON calendar_events
FOR EACH ROW
WHEN (NEW.status = 'Completed' OR NEW.status = 'In Progress')
EXECUTE FUNCTION check_hunt_end_date();

-- Scheduled function to check for hunts that ended (runs daily)
CREATE OR REPLACE FUNCTION auto_mark_hunts_pending_closeout()
RETURNS void AS $$
BEGIN
  UPDATE calendar_events
  SET status = 'Pending Closeout',
      updated_at = NOW()
  WHERE status IN ('Completed', 'In Progress', 'Booked')
    AND end_time < NOW()
    AND NOT EXISTS (SELECT 1 FROM hunt_closeouts WHERE hunt_id = calendar_events.id);
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 8. HELPER FUNCTION: Get hunts pending closeout for a guide
-- =============================================================================

CREATE OR REPLACE FUNCTION get_pending_closeout_hunts(p_guide_username TEXT, p_outfitter_id UUID)
RETURNS TABLE (
  hunt_id UUID,
  hunt_title TEXT,
  client_email TEXT,
  species TEXT,
  unit TEXT,
  weapon TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  days_pending INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ce.id,
    ce.title,
    ce.client_email,
    ce.species,
    ce.unit,
    ce.weapon,
    ce.start_time,
    ce.end_time,
    EXTRACT(DAY FROM NOW() - ce.end_time)::INTEGER as days_pending
  FROM calendar_events ce
  WHERE ce.status = 'Pending Closeout'
    AND ce.guide_username = p_guide_username
    AND ce.outfitter_id = p_outfitter_id
    AND NOT EXISTS (SELECT 1 FROM hunt_closeouts WHERE hunt_id = ce.id)
  ORDER BY ce.end_time ASC;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 9. HELPER FUNCTION: Get success records for filtering
-- =============================================================================

CREATE OR REPLACE FUNCTION get_success_records(
  p_outfitter_id UUID,
  p_species TEXT DEFAULT NULL,
  p_weapon TEXT DEFAULT NULL,
  p_unit TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_year INTEGER DEFAULT NULL,
  p_guide_username TEXT DEFAULT NULL
)
RETURNS TABLE (
  closeout_id UUID,
  hunt_id UUID,
  hunt_title TEXT,
  guide_username TEXT,
  harvested BOOLEAN,
  species TEXT,
  weapon TEXT,
  unit TEXT,
  state TEXT,
  season_year INTEGER,
  submitted_at TIMESTAMPTZ,
  total_photos INTEGER,
  marketing_photos INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sr.closeout_id,
    sr.hunt_id,
    sr.hunt_title,
    sr.guide_username,
    sr.harvested,
    sr.species,
    sr.weapon,
    sr.unit,
    sr.state,
    sr.season_year,
    sr.submitted_at,
    sr.total_photos,
    sr.marketing_photos
  FROM success_records sr
  WHERE sr.outfitter_id = p_outfitter_id
    AND (p_species IS NULL OR sr.species = p_species)
    AND (p_weapon IS NULL OR sr.weapon = p_weapon)
    AND (p_unit IS NULL OR sr.unit = p_unit)
    AND (p_state IS NULL OR sr.state = p_state)
    AND (p_year IS NULL OR sr.season_year = p_year)
    AND (p_guide_username IS NULL OR sr.guide_username = p_guide_username)
  ORDER BY sr.submitted_at DESC;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 10. RLS POLICIES
-- =============================================================================

-- Enable RLS
ALTER TABLE hunt_closeouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hunt_photos ENABLE ROW LEVEL SECURITY;

-- Hunt Closeouts: Guides can view/insert their own closeouts
CREATE POLICY "Guides can view closeouts for their hunts"
  ON hunt_closeouts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM outfitter_memberships om
      JOIN calendar_events ce ON ce.outfitter_id = om.outfitter_id
      WHERE om.user_id = auth.uid()
        AND om.status = 'active'
        AND ce.id = hunt_closeouts.hunt_id
        AND (om.role = 'owner' OR om.role = 'admin' OR 
             (om.role = 'guide' AND ce.guide_username = hunt_closeouts.guide_username))
    )
  );

CREATE POLICY "Guides can insert closeouts for their hunts"
  ON hunt_closeouts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM outfitter_memberships om
      JOIN calendar_events ce ON ce.outfitter_id = om.outfitter_id
      WHERE om.user_id = auth.uid()
        AND om.status = 'active'
        AND ce.id = hunt_id
        AND (om.role = 'owner' OR om.role = 'admin' OR 
             (om.role = 'guide' AND ce.guide_username = guide_username))
    )
  );

CREATE POLICY "Admins can update closeouts"
  ON hunt_closeouts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM outfitter_memberships om
      WHERE om.user_id = auth.uid()
        AND om.outfitter_id = hunt_closeouts.outfitter_id
        AND om.status = 'active'
        AND (om.role = 'owner' OR om.role = 'admin')
    )
  );

-- Hunt Photos: Guides can view/insert photos for their closeouts
CREATE POLICY "Users can view photos for their outfitter"
  ON hunt_photos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM outfitter_memberships om
      WHERE om.user_id = auth.uid()
        AND om.outfitter_id = hunt_photos.outfitter_id
        AND om.status = 'active'
    )
  );

CREATE POLICY "Guides can insert photos for their closeouts"
  ON hunt_photos
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM outfitter_memberships om
      JOIN hunt_closeouts hc ON hc.outfitter_id = om.outfitter_id
      WHERE om.user_id = auth.uid()
        AND om.status = 'active'
        AND hc.id = closeout_id
        AND (om.role = 'owner' OR om.role = 'admin' OR 
             (om.role = 'guide' AND hc.guide_username = (
               SELECT guide_username FROM guides WHERE user_id = auth.uid() LIMIT 1
             )))
    )
  );

CREATE POLICY "Admins can update photos"
  ON hunt_photos
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM outfitter_memberships om
      WHERE om.user_id = auth.uid()
        AND om.outfitter_id = hunt_photos.outfitter_id
        AND om.status = 'active'
        AND (om.role = 'owner' OR om.role = 'admin')
    )
  );

-- Clients can view approved marketing photos (read-only)
CREATE POLICY "Clients can view approved marketing photos"
  ON hunt_photos
  FOR SELECT
  USING (
    approved_for_marketing = true
    AND is_private = false
    AND EXISTS (
      SELECT 1 FROM client_outfitter_links col
      WHERE col.client_id = (
        SELECT id FROM clients WHERE email = auth.jwt()->>'email'
      )
      AND col.outfitter_id = hunt_photos.outfitter_id
    )
  );

-- =============================================================================
-- 11. COMMENTS (Documentation)
-- =============================================================================

COMMENT ON TABLE hunt_closeouts IS 'Post-hunt closeout records submitted by guides. Required before hunt can be marked as Closed.';
COMMENT ON TABLE hunt_photos IS 'Photos uploaded during hunt closeout. Auto-tagged with hunt metadata for marketing and analytics.';
COMMENT ON VIEW success_records IS 'View of successful hunts (harvested = true) with aggregated photo counts for easy querying.';
COMMENT ON FUNCTION get_pending_closeout_hunts IS 'Returns hunts that need closeout completion for a specific guide.';
COMMENT ON FUNCTION get_success_records IS 'Returns filtered success records for admin dashboard and client-facing success history.';
