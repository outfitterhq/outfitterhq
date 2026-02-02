-- Pricing items: species and weapons for auto-picking bill on contracts.
-- species/weapons comma-separated (e.g. "Elk,Deer", "Rifle,Archery"). Empty = applies to all.

ALTER TABLE pricing_items
ADD COLUMN IF NOT EXISTS species TEXT,
ADD COLUMN IF NOT EXISTS weapons TEXT;

COMMENT ON COLUMN pricing_items.species IS 'Comma-separated species this price applies to (e.g. Elk,Deer). NULL/empty = applies to all species.';
COMMENT ON COLUMN pricing_items.weapons IS 'Comma-separated weapon types (Rifle,Archery,Muzzleloader). NULL/empty = applies to all.';
