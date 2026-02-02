-- Unit-wide tags: admin sets 3 hunt code options; client chooses one at purchase.
-- hunt_code = single code (private_land). hunt_code_options = comma-separated (unit_wide, e.g. ELK-1-294,ELK-2-294,ELK-3-294).

ALTER TABLE private_land_tags
ADD COLUMN IF NOT EXISTS hunt_code_options TEXT;

COMMENT ON COLUMN private_land_tags.hunt_code_options IS 'Unit-wide only: comma-separated hunt codes (e.g. ELK-1-294,ELK-2-294,ELK-3-294). Client chooses one at purchase; that code is used for the hunt/contract.';
