-- Update success_records view to exclude private photos from marketing_photos count
-- Private photos should not appear in Past Successes

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
  -- Photo counts (exclude private photos)
  (SELECT COUNT(*) FROM hunt_photos hp WHERE hp.closeout_id = hc.id AND hp.is_private = false) as total_photos,
  (SELECT COUNT(*) FROM hunt_photos hp WHERE hp.closeout_id = hc.id AND hp.approved_for_marketing = true AND hp.is_private = false) as marketing_photos
FROM hunt_closeouts hc
JOIN calendar_events ce ON ce.id = hc.hunt_id
WHERE hc.harvested = true; -- Only successful hunts
