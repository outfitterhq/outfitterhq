-- Migration: Customizable Client Dashboard
-- Allows outfitters to customize their client dashboard layout and content

-- Add dashboard customization fields to outfitters table
ALTER TABLE outfitters
ADD COLUMN IF NOT EXISTS dashboard_hero_title TEXT DEFAULT 'Welcome to Your Client Portal',
ADD COLUMN IF NOT EXISTS dashboard_hero_subtitle TEXT DEFAULT 'Manage your hunts, documents, and more',
ADD COLUMN IF NOT EXISTS dashboard_hero_image_url TEXT,
ADD COLUMN IF NOT EXISTS dashboard_welcome_text TEXT,
ADD COLUMN IF NOT EXISTS dashboard_cta_primary_text TEXT DEFAULT 'Book a Hunt',
ADD COLUMN IF NOT EXISTS dashboard_cta_primary_url TEXT,
ADD COLUMN IF NOT EXISTS dashboard_cta_secondary_text TEXT DEFAULT 'Contact Us',
ADD COLUMN IF NOT EXISTS dashboard_cta_secondary_url TEXT,
ADD COLUMN IF NOT EXISTS dashboard_feature_cards JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS dashboard_hunt_showcases JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS dashboard_testimonials JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS dashboard_special_sections JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS dashboard_partner_logos JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS dashboard_contact_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS dashboard_contact_email TEXT,
ADD COLUMN IF NOT EXISTS success_history_intro_text TEXT,
ADD COLUMN IF NOT EXISTS success_history_species_photos JSONB DEFAULT '{}';

-- Add comments for documentation
COMMENT ON COLUMN outfitters.dashboard_hero_title IS 'Main hero title on client dashboard';
COMMENT ON COLUMN outfitters.dashboard_hero_subtitle IS 'Hero subtitle/description';
COMMENT ON COLUMN outfitters.dashboard_hero_image_url IS 'Optional hero background image URL';
COMMENT ON COLUMN outfitters.dashboard_cta_primary_text IS 'Primary call-to-action button text';
COMMENT ON COLUMN outfitters.dashboard_cta_primary_url IS 'Primary CTA button URL';
COMMENT ON COLUMN outfitters.dashboard_cta_secondary_text IS 'Secondary call-to-action button text';
COMMENT ON COLUMN outfitters.dashboard_cta_secondary_url IS 'Secondary CTA button URL';
COMMENT ON COLUMN outfitters.dashboard_feature_cards IS 'JSONB array of feature cards: [{"title": "...", "description": "...", "icon": "...", "href": "..."}]';
COMMENT ON COLUMN outfitters.dashboard_hunt_showcases IS 'JSONB array of hunt showcase cards: [{"title": "...", "imageUrl": "...", "href": "..."}]';
COMMENT ON COLUMN outfitters.dashboard_testimonials IS 'JSONB array of testimonials: [{"name": "...", "location": "...", "text": "...", "imageUrl": "..."}]';
COMMENT ON COLUMN outfitters.dashboard_special_sections IS 'JSONB array of special sections: [{"title": "...", "description": "...", "imageUrl": "...", "href": "...", "buttonText": "..."}]';
COMMENT ON COLUMN outfitters.dashboard_partner_logos IS 'JSONB array of partner logos: [{"name": "...", "logoUrl": "...", "href": "..."}]';
COMMENT ON COLUMN outfitters.dashboard_contact_enabled IS 'Whether to show contact form on dashboard';
COMMENT ON COLUMN outfitters.dashboard_contact_email IS 'Email address for contact form submissions';
COMMENT ON COLUMN outfitters.dashboard_welcome_text IS 'Custom text displayed below hero section on client dashboard';
COMMENT ON COLUMN outfitters.success_history_intro_text IS 'Intro text displayed above species photos on Past Success page';
COMMENT ON COLUMN outfitters.success_history_species_photos IS 'JSONB object mapping species to photo URLs: {"Elk": "url", "Deer": "url", ...}';
