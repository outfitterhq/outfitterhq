-- Migration: Client Portal Branding Customization
-- Allows outfitters to customize their client portal background and logo

-- Add branding fields to outfitters table
ALTER TABLE outfitters
ADD COLUMN IF NOT EXISTS client_portal_logo_url TEXT,
ADD COLUMN IF NOT EXISTS client_portal_background_type TEXT DEFAULT 'color' CHECK (client_portal_background_type IN ('color', 'image', 'per-page')),
ADD COLUMN IF NOT EXISTS client_portal_background_color TEXT DEFAULT '#f5f5f5',
ADD COLUMN IF NOT EXISTS client_portal_background_image_url TEXT,
ADD COLUMN IF NOT EXISTS client_portal_per_page_backgrounds JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS client_portal_header_color TEXT DEFAULT '#1a472a';

-- Add comment for documentation
COMMENT ON COLUMN outfitters.client_portal_logo_url IS 'URL to outfitter logo image for client portal header';
COMMENT ON COLUMN outfitters.client_portal_background_type IS 'Type of background: color, image (global), or per-page';
COMMENT ON COLUMN outfitters.client_portal_background_color IS 'Background color (hex code) when type is color or default for per-page';
COMMENT ON COLUMN outfitters.client_portal_background_image_url IS 'URL to background image when type is image (global)';
COMMENT ON COLUMN outfitters.client_portal_per_page_backgrounds IS 'JSONB object mapping page paths to background settings: {"path": {"type": "color|image", "value": "..."}}';
COMMENT ON COLUMN outfitters.client_portal_header_color IS 'Header/footer background color (hex code)';
