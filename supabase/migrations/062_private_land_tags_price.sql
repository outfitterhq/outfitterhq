-- Ensure tag price column exists on private_land_tags (tag price is what clients pay when purchasing the tag).
ALTER TABLE private_land_tags
  ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2);

COMMENT ON COLUMN private_land_tags.price IS 'Tag price (USD) shown to clients when purchasing. Separate from guide fees (pricing_items).';
