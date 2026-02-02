-- Hunt window: date range from hunt code (season); client selects their actual days within this window.
-- Guided hunts are typically 3-7 days; outfitter sets "included days" in pricing.

-- 1. calendar_events: store hunt code's date window so contracts and client date picker know bounds
ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS hunt_window_start TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS hunt_window_end TIMESTAMPTZ;

COMMENT ON COLUMN calendar_events.hunt_window_start IS 'Start of hunt code season (from NMDGF); client picks their actual start within this window.';
COMMENT ON COLUMN calendar_events.hunt_window_end IS 'End of hunt code season; client picks their actual end within this window.';

-- 2. pricing_items: outfitter-specific "included days" for guided hunts (e.g. 5-day hunt)
ALTER TABLE pricing_items
ADD COLUMN IF NOT EXISTS included_days INTEGER;

COMMENT ON COLUMN pricing_items.included_days IS 'Number of hunt days included in this pricing (e.g. 5 for 5-day guided hunt). Used to validate client-selected date range.';
