-- Add hunt_code and hunt_type to success_records so cards can show them (and Private Land / Unit Wide)
-- Drop and recreate view. Use date_part() instead of EXTRACT() to avoid " FROM " in SELECT list
-- which can confuse migration runners that split on FROM.

DROP VIEW IF EXISTS success_records CASCADE;

CREATE VIEW success_records AS SELECT hc.id AS closeout_id, hc.hunt_id, hc.outfitter_id, ce.title AS hunt_title, hc.guide_username, hc.client_email, hc.harvested, hc.species, hc.weapon, hc.unit, hc.state, hc.hunt_dates, hc.success_summary, hc.weather_conditions, hc.animal_quality_notes, hc.submitted_at, (date_part('year', ce.start_time))::INTEGER AS season_year, (SELECT COUNT(*)::INTEGER FROM hunt_photos hp WHERE hp.closeout_id = hc.id) AS total_photos, (SELECT COUNT(*)::INTEGER FROM hunt_photos hp WHERE hp.closeout_id = hc.id AND hp.approved_for_marketing = true) AS marketing_photos, ce.hunt_code, ce.hunt_type FROM hunt_closeouts hc JOIN calendar_events ce ON ce.id = hc.hunt_id WHERE hc.harvested = true;

-- Recreate get_success_records to include new columns
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
  marketing_photos INTEGER
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
$$;

GRANT EXECUTE ON FUNCTION get_success_records(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT) TO authenticated;
