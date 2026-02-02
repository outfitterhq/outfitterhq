-- Add hunt-specific fields to calendar_events table
ALTER TABLE calendar_events 
ADD COLUMN IF NOT EXISTS species TEXT,
ADD COLUMN IF NOT EXISTS unit TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Inquiry' CHECK (status IN ('Inquiry', 'Pending', 'Booked', 'Completed', 'Cancelled'));

-- Ensure start_time and end_time columns exist (they might be start_date/end_date)
DO $$
BEGIN
    -- Check if start_time exists, if not create it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'calendar_events' AND column_name = 'start_time') THEN
        -- If start_date exists, copy to start_time
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'calendar_events' AND column_name = 'start_date') THEN
            ALTER TABLE calendar_events ADD COLUMN start_time TIMESTAMPTZ;
            UPDATE calendar_events SET start_time = start_date WHERE start_time IS NULL;
        ELSE
            ALTER TABLE calendar_events ADD COLUMN start_time TIMESTAMPTZ NOT NULL DEFAULT NOW();
        END IF;
    END IF;
    
    -- Check if end_time exists, if not create it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'calendar_events' AND column_name = 'end_time') THEN
        -- If end_date exists, copy to end_date
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'calendar_events' AND column_name = 'end_date') THEN
            ALTER TABLE calendar_events ADD COLUMN end_time TIMESTAMPTZ;
            UPDATE calendar_events SET end_time = end_date WHERE end_time IS NULL;
        ELSE
            ALTER TABLE calendar_events ADD COLUMN end_time TIMESTAMPTZ NOT NULL DEFAULT NOW();
        END IF;
    END IF;
END $$;

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_calendar_events_status ON calendar_events(status) WHERE status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_species ON calendar_events(species) WHERE species IS NOT NULL;
