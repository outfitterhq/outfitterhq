-- Migration: Customizable Species List
-- Allows outfitters to customize which species they offer based on their state/location

-- Add customizable species list to outfitters table
ALTER TABLE outfitters
ADD COLUMN IF NOT EXISTS available_species JSONB DEFAULT '["Elk", "Deer", "Antelope", "Oryx", "Ibex", "Aoudad", "Bighorn Sheep", "Bear", "Mountain Lion", "Turkey"]';

-- Add comment for documentation
COMMENT ON COLUMN outfitters.available_species IS 'JSONB array of species names available for this outfitter: ["Elk", "Deer", ...]. Admins can customize this list in settings.';

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_outfitters_available_species ON outfitters USING GIN (available_species);
