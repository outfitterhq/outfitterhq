-- Add primary_photo_storage_path to success_records so iOS can create signed URLs
-- when the web API is unreachable (e.g. localhost). Also allow clients to read
-- hunt-photos for their linked outfitter so createSignedURL works from the app.

-- 1) Add primary_photo_storage_path to the view (first marketing-approved photo by display_order)
DROP VIEW IF EXISTS success_records CASCADE;

CREATE VIEW success_records AS
SELECT
  hc.id AS closeout_id,
  hc.hunt_id,
  hc.outfitter_id,
  ce.title AS hunt_title,
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
  (date_part('year', ce.start_time))::INTEGER AS season_year,
  (SELECT COUNT(*)::INTEGER FROM hunt_photos hp WHERE hp.closeout_id = hc.id) AS total_photos,
  (SELECT COUNT(*)::INTEGER FROM hunt_photos hp WHERE hp.closeout_id = hc.id AND hp.approved_for_marketing = true) AS marketing_photos,
  ce.hunt_code,
  ce.hunt_type,
  (SELECT hp.storage_path FROM hunt_photos hp WHERE hp.closeout_id = hc.id AND hp.approved_for_marketing = true ORDER BY hp.display_order ASC, hp.uploaded_at ASC LIMIT 1) AS primary_photo_storage_path
FROM hunt_closeouts hc
JOIN calendar_events ce ON ce.id = hc.hunt_id
WHERE hc.harvested = true;

-- 2) Update get_success_records to return primary_photo_storage_path
DROP FUNCTION IF EXISTS get_success_records(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT);

CREATE FUNCTION get_success_records(
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
  outfitter_id UUID,
  hunt_title TEXT,
  guide_username TEXT,
  client_email TEXT,
  harvested BOOLEAN,
  species TEXT,
  weapon TEXT,
  unit TEXT,
  state TEXT,
  hunt_dates TEXT,
  success_summary TEXT,
  weather_conditions TEXT,
  animal_quality_notes TEXT,
  submitted_at TIMESTAMPTZ,
  season_year INTEGER,
  hunt_code TEXT,
  hunt_type TEXT,
  total_photos INTEGER,
  marketing_photos INTEGER,
  primary_photo_storage_path TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sr.closeout_id,
    sr.hunt_id,
    sr.outfitter_id,
    sr.hunt_title,
    sr.guide_username,
    sr.client_email,
    sr.harvested,
    sr.species,
    sr.weapon,
    sr.unit,
    sr.state,
    sr.hunt_dates,
    sr.success_summary,
    sr.weather_conditions,
    sr.animal_quality_notes,
    sr.submitted_at,
    sr.season_year,
    sr.hunt_code,
    sr.hunt_type,
    sr.total_photos,
    sr.marketing_photos,
    sr.primary_photo_storage_path
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
$$;

GRANT EXECUTE ON FUNCTION get_success_records(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_success_records(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT) TO service_role;

-- 3) Allow clients to read hunt-photos for their linked outfitter (so iOS createSignedURL works)
-- Path format in hunt-photos is typically {outfitter_id}/... so first path segment = outfitter_id
DROP POLICY IF EXISTS "Authenticated upload read hunt-photos" ON storage.objects;

CREATE POLICY "Authenticated upload read hunt-photos"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'hunt-photos'
  AND (
    -- Outfitter members: read their outfitter's folder
    EXISTS (
      SELECT 1 FROM outfitter_memberships om
      WHERE om.user_id = auth.uid()
        AND om.status = 'active'
        AND (storage.foldername(name))[1] = om.outfitter_id::text
    )
    OR
    -- Clients: read their linked outfitter's folder
    EXISTS (
      SELECT 1 FROM clients c
      JOIN client_outfitter_links col ON col.client_id = c.id AND col.is_active
      WHERE c.email = (SELECT email FROM auth.users WHERE id = auth.uid())
        AND (storage.foldername(name))[1] = col.outfitter_id::text
    )
  )
)
WITH CHECK (
  bucket_id = 'hunt-photos'
  AND EXISTS (
    SELECT 1 FROM outfitter_memberships om
    WHERE om.user_id = auth.uid()
      AND om.status = 'active'
      AND (storage.foldername(name))[1] = om.outfitter_id::text
  )
);
