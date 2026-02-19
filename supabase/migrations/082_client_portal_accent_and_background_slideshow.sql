-- Client portal accent color and optional rotating background photos (slideshow)
-- Used by ClientShell for --client-accent CSS variable and background slideshow.

ALTER TABLE outfitters
  ADD COLUMN IF NOT EXISTS client_portal_accent_color TEXT DEFAULT '#1a472a';

ALTER TABLE outfitters
  ADD COLUMN IF NOT EXISTS client_portal_background_image_urls JSONB DEFAULT '[]';

COMMENT ON COLUMN outfitters.client_portal_accent_color IS 'Accent color (hex) for buttons, links, and accents in the client portal. Exposed as CSS variable --client-accent.';
COMMENT ON COLUMN outfitters.client_portal_background_image_urls IS 'Optional array of image URLs for rotating background slideshow. When non-empty and background type is image, client shell shows a slideshow instead of single image.';
