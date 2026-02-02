-- Add addon_type to pricing_items so Add-ons can be: extra_days, non_hunter, spotter, or null (Other)
ALTER TABLE pricing_items
  ADD COLUMN IF NOT EXISTS addon_type TEXT;

COMMENT ON COLUMN pricing_items.addon_type IS 'When category is Add-ons: extra_days, non_hunter, spotter, or null for custom/other.';
