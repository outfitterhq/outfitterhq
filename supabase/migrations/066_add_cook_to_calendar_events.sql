-- Add cook_username field to calendar_events table
-- Cooks are optional - not every hunt will have a cook assigned

ALTER TABLE calendar_events 
ADD COLUMN IF NOT EXISTS cook_username TEXT;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_cook ON calendar_events(cook_username) WHERE cook_username IS NOT NULL;

COMMENT ON COLUMN calendar_events.cook_username IS 'Optional cook assigned to this hunt. References cook_profiles.contact_email or cook username.';
