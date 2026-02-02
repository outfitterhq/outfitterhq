-- Add weapon field to calendar_events table
ALTER TABLE calendar_events 
ADD COLUMN IF NOT EXISTS weapon TEXT CHECK (weapon IN ('Rifle', 'Muzzleloader', 'Bow'));

-- Create index for weapon filtering
CREATE INDEX IF NOT EXISTS idx_calendar_events_weapon ON calendar_events(weapon) WHERE weapon IS NOT NULL;
