-- Fix get_success_records RPC function to match success_records VIEW structure
-- This fixes the "structure of query does not match function result type" error

-- Drop the existing function first (PostgreSQL doesn't allow changing return types with CREATE OR REPLACE)
DROP FUNCTION IF EXISTS get_success_records(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT);

-- Recreate the function with the correct return type
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
  total_photos INTEGER,
  marketing_photos INTEGER
) AS $$
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
