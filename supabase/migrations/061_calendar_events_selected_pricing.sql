-- Store client's chosen price plan on the hunt (set on complete-booking page after purchase).
ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS selected_pricing_item_id UUID REFERENCES pricing_items(id) ON DELETE SET NULL;

COMMENT ON COLUMN calendar_events.selected_pricing_item_id IS 'Client-chosen pricing item from complete-booking (e.g. 5-day guided hunt). Used for contract bill.';
