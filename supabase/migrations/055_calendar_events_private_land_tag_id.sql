-- Link calendar_events to the tag that was purchased (tag-for-sale flow)
-- So admin can go from Tags for Sale → "Open hunt & generate contract" for that tag's event

ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS private_land_tag_id UUID REFERENCES private_land_tags(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_events_private_land_tag_id
ON calendar_events(private_land_tag_id) WHERE private_land_tag_id IS NOT NULL;

COMMENT ON COLUMN calendar_events.private_land_tag_id IS 'Set when event was created from a tag purchase (Tags for Sale). Links tag → hunt for admin workflow.';
