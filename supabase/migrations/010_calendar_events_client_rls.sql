-- Add RLS policy to allow clients to see their own calendar events
-- Clients are linked via client_outfitter_links, not outfitter_memberships

-- Drop existing client policy if it exists
DROP POLICY IF EXISTS "Clients can view their own calendar events" ON calendar_events;

-- Create policy for clients: they can see events where client_email matches their authenticated email
-- AND they're linked to that outfitter via client_outfitter_links
CREATE POLICY "Clients can view their own calendar events"
  ON calendar_events
  FOR SELECT
  USING (
    client_email IS NOT NULL AND
    client_email = (SELECT email FROM auth.users WHERE id = auth.uid()) AND
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.email = calendar_events.client_email
        AND clients.id IN (
          SELECT client_id FROM client_outfitter_links
          WHERE outfitter_id = calendar_events.outfitter_id
            AND is_active = true
        )
    )
  );
