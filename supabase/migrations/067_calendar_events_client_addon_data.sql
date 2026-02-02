-- Store add-on quantities chosen on complete-booking (extra_days, extra_non_hunters).
-- When admin generates the contract, this is copied to hunt_contracts.client_completion_data.
ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS client_addon_data JSONB;

COMMENT ON COLUMN calendar_events.client_addon_data IS 'Add-on quantities from complete-booking (e.g. extra_days, extra_non_hunters). Copied to contract client_completion_data when contract is generated.';
