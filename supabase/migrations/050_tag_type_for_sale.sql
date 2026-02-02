-- Tags for sale: add tag_type so admin can select Private Land or Unit Wide
-- Hunt code remains optional on the tag (can change).

ALTER TABLE private_land_tags
  ADD COLUMN IF NOT EXISTS tag_type TEXT DEFAULT 'private_land'
    CHECK (tag_type IS NULL OR tag_type IN ('private_land', 'unit_wide'));

COMMENT ON COLUMN private_land_tags.tag_type IS 'Type of tag: private_land or unit_wide. Optional; default private_land.';
