-- Migration: Add "Let G3 select my hunts" and per-species preferences to pre-draw (parity with iOS)
-- When allow_g3_to_select is true, species_preferences stores: elk, deer, antelope, ibex, barbary_sheep, oryx, bighorn_sheep
-- Each value: 'none' | 'quality' | 'high_odds' | 'standard'

ALTER TABLE client_predraw_submissions
  ADD COLUMN IF NOT EXISTS allow_g3_to_select BOOLEAN DEFAULT false;

ALTER TABLE client_predraw_submissions
  ADD COLUMN IF NOT EXISTS species_preferences JSONB DEFAULT '{}';

COMMENT ON COLUMN client_predraw_submissions.allow_g3_to_select IS 'When true, client wants outfitter to select hunt codes; use species_preferences for per-species preference.';
COMMENT ON COLUMN client_predraw_submissions.species_preferences IS 'Per-species preference when allow_g3_to_select: elk, deer, antelope, ibex, barbary_sheep, oryx, bighorn_sheep; values: none, quality, high_odds, standard.';
