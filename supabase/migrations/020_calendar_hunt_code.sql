-- Add hunt_code column to calendar_events for NM hunt codes like ELK-1-294
ALTER TABLE calendar_events 
ADD COLUMN IF NOT EXISTS hunt_code TEXT;

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_calendar_events_hunt_code ON calendar_events(hunt_code);

-- Comment
COMMENT ON COLUMN calendar_events.hunt_code IS 'Hunt code from state draw system (e.g., ELK-1-294 for NM)';
