-- Fix calendar_events where guide_username is a UUID instead of email/username
-- This migration finds events with UUID guide_usernames and updates them to use the guide's email

-- First, let's see what we're working with (for debugging)
-- SELECT id, guide_username, title FROM calendar_events WHERE guide_username IS NOT NULL AND guide_username ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Update events where guide_username is a UUID to use the guide's email instead
UPDATE calendar_events ce
SET guide_username = g.email
FROM guides g
WHERE ce.guide_username IS NOT NULL
  AND ce.guide_username ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'  -- Looks like a UUID
  AND (
    ce.guide_username = g.user_id::text  -- Matches user_id
    OR ce.guide_username = g.id::text    -- Matches guide id
  )
  AND g.email IS NOT NULL
  AND g.email != '';

-- Also handle cases where guide_username might be a profiles UUID
-- If there's a profiles table with user_id, we can match through that
UPDATE calendar_events ce
SET guide_username = g.email
FROM guides g
JOIN auth.users u ON u.id = g.user_id
WHERE ce.guide_username IS NOT NULL
  AND ce.guide_username ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'  -- Looks like a UUID
  AND ce.guide_username = u.id::text  -- Matches auth.users.id (which might be what profiles uses)
  AND g.email IS NOT NULL
  AND g.email != '';

-- Note: After running this, any events that couldn't be matched will still have UUIDs
-- You may need to manually fix those or reassign the guides in the admin interface
