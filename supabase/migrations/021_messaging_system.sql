-- Migration: Messaging System
-- Real-time messaging between outfitters and clients
-- Supports Supabase Realtime for instant updates on iOS and Web

-- =============================================================================
-- 1. CONVERSATIONS TABLE
-- =============================================================================
-- A conversation is between an outfitter and a client
-- One conversation per client-outfitter pair

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outfitter_id UUID NOT NULL REFERENCES outfitters(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  
  -- Conversation metadata
  subject TEXT,  -- Optional: "Hunt 2026", "Pre-Draw Questions", etc.
  
  -- Last message preview (denormalized for list performance)
  last_message_text TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_sender_type TEXT,  -- 'client' or 'staff'
  
  -- Unread counts (denormalized for badge counts)
  unread_count_client INTEGER DEFAULT 0,  -- Unread by client
  unread_count_staff INTEGER DEFAULT 0,   -- Unread by outfitter staff
  
  -- Status
  is_archived BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One conversation per client-outfitter pair
  UNIQUE(outfitter_id, client_id)
);

CREATE INDEX idx_conversations_outfitter ON conversations(outfitter_id);
CREATE INDEX idx_conversations_client ON conversations(client_id);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX idx_conversations_unread_staff ON conversations(outfitter_id, unread_count_staff) WHERE unread_count_staff > 0;

-- =============================================================================
-- 2. MESSAGES TABLE
-- =============================================================================
-- Individual messages within a conversation

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  
  -- Who sent it
  sender_type TEXT NOT NULL CHECK (sender_type IN ('client', 'staff')),
  sender_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- The auth user who sent
  sender_name TEXT,  -- Display name at time of sending
  
  -- Message content
  content TEXT NOT NULL,
  
  -- Optional: Related entities (for context)
  related_hunt_id UUID REFERENCES calendar_events(id) ON DELETE SET NULL,
  related_contract_id UUID REFERENCES hunt_contracts(id) ON DELETE SET NULL,
  
  -- Attachments (stored as array of URLs)
  attachments JSONB DEFAULT '[]',  -- [{url: "...", name: "...", type: "image/jpeg", size: 1234}]
  
  -- Status
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  
  -- Soft delete (for moderation)
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_user_id);
CREATE INDEX idx_messages_unread ON messages(conversation_id, is_read) WHERE is_read = false;

-- =============================================================================
-- 3. TRIGGER: Update conversation on new message
-- =============================================================================

CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  -- Update conversation's last message info
  UPDATE conversations SET
    last_message_text = LEFT(NEW.content, 100),  -- First 100 chars for preview
    last_message_at = NEW.created_at,
    last_message_sender_type = NEW.sender_type,
    updated_at = NOW(),
    -- Increment unread count for the OTHER party
    unread_count_client = CASE 
      WHEN NEW.sender_type = 'staff' THEN unread_count_client + 1 
      ELSE unread_count_client 
    END,
    unread_count_staff = CASE 
      WHEN NEW.sender_type = 'client' THEN unread_count_staff + 1 
      ELSE unread_count_staff 
    END
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_conversation_on_message ON messages;
CREATE TRIGGER trigger_update_conversation_on_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_on_message();

-- =============================================================================
-- 4. FUNCTION: Mark messages as read
-- =============================================================================

CREATE OR REPLACE FUNCTION mark_messages_read(
  p_conversation_id UUID,
  p_reader_type TEXT  -- 'client' or 'staff'
)
RETURNS void AS $$
BEGIN
  -- Mark all unread messages from the OTHER party as read
  UPDATE messages SET
    is_read = true,
    read_at = NOW()
  WHERE conversation_id = p_conversation_id
    AND is_read = false
    AND sender_type != p_reader_type;
  
  -- Reset unread count for the reader
  IF p_reader_type = 'client' THEN
    UPDATE conversations SET unread_count_client = 0, updated_at = NOW()
    WHERE id = p_conversation_id;
  ELSE
    UPDATE conversations SET unread_count_staff = 0, updated_at = NOW()
    WHERE id = p_conversation_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 5. FUNCTION: Get or create conversation
-- =============================================================================

CREATE OR REPLACE FUNCTION get_or_create_conversation(
  p_outfitter_id UUID,
  p_client_id UUID,
  p_subject TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_conversation_id UUID;
BEGIN
  -- Try to find existing conversation
  SELECT id INTO v_conversation_id
  FROM conversations
  WHERE outfitter_id = p_outfitter_id AND client_id = p_client_id;
  
  -- Create if not exists
  IF v_conversation_id IS NULL THEN
    INSERT INTO conversations (outfitter_id, client_id, subject)
    VALUES (p_outfitter_id, p_client_id, p_subject)
    RETURNING id INTO v_conversation_id;
  END IF;
  
  RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 6. FUNCTION: Send message (with conversation auto-creation)
-- =============================================================================

CREATE OR REPLACE FUNCTION send_message(
  p_outfitter_id UUID,
  p_client_id UUID,
  p_sender_type TEXT,
  p_content TEXT,
  p_sender_name TEXT DEFAULT NULL,
  p_related_hunt_id UUID DEFAULT NULL,
  p_related_contract_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_conversation_id UUID;
  v_message_id UUID;
BEGIN
  -- Get or create conversation
  v_conversation_id := get_or_create_conversation(p_outfitter_id, p_client_id);
  
  -- Insert message
  INSERT INTO messages (
    conversation_id,
    sender_type,
    sender_user_id,
    sender_name,
    content,
    related_hunt_id,
    related_contract_id
  ) VALUES (
    v_conversation_id,
    p_sender_type,
    auth.uid(),
    p_sender_name,
    p_content,
    p_related_hunt_id,
    p_related_contract_id
  ) RETURNING id INTO v_message_id;
  
  RETURN v_message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 7. ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- CONVERSATIONS RLS
-- -----------------------------------------------------------------------------

-- Clients can view their own conversations
DROP POLICY IF EXISTS "Clients can view own conversations" ON conversations;
CREATE POLICY "Clients can view own conversations"
  ON conversations FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE LOWER(email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
    )
  );

-- Staff can view conversations for their outfitter
DROP POLICY IF EXISTS "Staff can view outfitter conversations" ON conversations;
CREATE POLICY "Staff can view outfitter conversations"
  ON conversations FOR SELECT
  USING (
    outfitter_id IN (
      SELECT om.outfitter_id FROM outfitter_memberships om
      WHERE om.user_id = auth.uid() 
        AND om.status = 'active'
        AND om.role IN ('owner', 'admin', 'guide')
    )
  );

-- Staff can create conversations
DROP POLICY IF EXISTS "Staff can create conversations" ON conversations;
CREATE POLICY "Staff can create conversations"
  ON conversations FOR INSERT
  WITH CHECK (
    outfitter_id IN (
      SELECT om.outfitter_id FROM outfitter_memberships om
      WHERE om.user_id = auth.uid() 
        AND om.status = 'active'
        AND om.role IN ('owner', 'admin', 'guide')
    )
  );

-- Staff can update conversations (archive, etc.)
DROP POLICY IF EXISTS "Staff can update outfitter conversations" ON conversations;
CREATE POLICY "Staff can update outfitter conversations"
  ON conversations FOR UPDATE
  USING (
    outfitter_id IN (
      SELECT om.outfitter_id FROM outfitter_memberships om
      WHERE om.user_id = auth.uid() 
        AND om.status = 'active'
        AND om.role IN ('owner', 'admin')
    )
  );

-- -----------------------------------------------------------------------------
-- MESSAGES RLS
-- -----------------------------------------------------------------------------

-- Clients can view messages in their conversations
DROP POLICY IF EXISTS "Clients can view messages in own conversations" ON messages;
CREATE POLICY "Clients can view messages in own conversations"
  ON messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT c.id FROM conversations c
      JOIN clients cl ON cl.id = c.client_id
      WHERE LOWER(cl.email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
    )
    AND is_deleted = false
  );

-- Clients can send messages in their conversations
DROP POLICY IF EXISTS "Clients can send messages" ON messages;
CREATE POLICY "Clients can send messages"
  ON messages FOR INSERT
  WITH CHECK (
    conversation_id IN (
      SELECT c.id FROM conversations c
      JOIN clients cl ON cl.id = c.client_id
      WHERE LOWER(cl.email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
    )
    AND sender_type = 'client'
  );

-- Staff can view messages for their outfitter
DROP POLICY IF EXISTS "Staff can view outfitter messages" ON messages;
CREATE POLICY "Staff can view outfitter messages"
  ON messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT c.id FROM conversations c
      WHERE c.outfitter_id IN (
        SELECT om.outfitter_id FROM outfitter_memberships om
        WHERE om.user_id = auth.uid() 
          AND om.status = 'active'
          AND om.role IN ('owner', 'admin', 'guide')
      )
    )
  );

-- Staff can send messages
DROP POLICY IF EXISTS "Staff can send messages" ON messages;
CREATE POLICY "Staff can send messages"
  ON messages FOR INSERT
  WITH CHECK (
    conversation_id IN (
      SELECT c.id FROM conversations c
      WHERE c.outfitter_id IN (
        SELECT om.outfitter_id FROM outfitter_memberships om
        WHERE om.user_id = auth.uid() 
          AND om.status = 'active'
          AND om.role IN ('owner', 'admin', 'guide')
      )
    )
    AND sender_type = 'staff'
  );

-- Admins can soft-delete messages (moderation)
DROP POLICY IF EXISTS "Admins can delete messages" ON messages;
CREATE POLICY "Admins can delete messages"
  ON messages FOR UPDATE
  USING (
    conversation_id IN (
      SELECT c.id FROM conversations c
      WHERE c.outfitter_id IN (
        SELECT om.outfitter_id FROM outfitter_memberships om
        WHERE om.user_id = auth.uid() 
          AND om.status = 'active'
          AND om.role IN ('owner', 'admin')
      )
    )
  );

-- =============================================================================
-- 8. ENABLE REALTIME
-- =============================================================================
-- Enable Supabase Realtime for these tables
-- Note: Run these in Supabase dashboard or via separate command if needed

-- For real-time message updates
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;

-- =============================================================================
-- 9. UPDATED_AT TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION update_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS conversations_updated_at ON conversations;
CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_conversations_updated_at();

-- =============================================================================
-- 10. VIEWS FOR CONVENIENCE
-- =============================================================================

-- View for outfitter inbox with client info
CREATE OR REPLACE VIEW outfitter_inbox AS
SELECT 
  c.id AS conversation_id,
  c.outfitter_id,
  c.client_id,
  cl.first_name AS client_first_name,
  cl.last_name AS client_last_name,
  cl.email AS client_email,
  c.subject,
  c.last_message_text,
  c.last_message_at,
  c.last_message_sender_type,
  c.unread_count_staff AS unread_count,
  c.is_archived,
  c.created_at
FROM conversations c
JOIN clients cl ON cl.id = c.client_id
WHERE c.is_archived = false;

GRANT SELECT ON outfitter_inbox TO authenticated;

-- View for client inbox with outfitter info
CREATE OR REPLACE VIEW client_inbox AS
SELECT 
  c.id AS conversation_id,
  c.outfitter_id,
  c.client_id,
  o.name AS outfitter_name,
  c.subject,
  c.last_message_text,
  c.last_message_at,
  c.last_message_sender_type,
  c.unread_count_client AS unread_count,
  c.is_archived,
  c.created_at
FROM conversations c
JOIN outfitters o ON o.id = c.outfitter_id
WHERE c.is_archived = false;

GRANT SELECT ON client_inbox TO authenticated;

-- =============================================================================
-- DONE
-- =============================================================================
-- Messaging system ready!
-- iOS: Subscribe to 'messages' table with conversation_id filter
-- Web: Same pattern, use @supabase/realtime-js
-- 
-- Quick usage:
-- 1. SELECT * FROM outfitter_inbox WHERE outfitter_id = 'xxx' ORDER BY last_message_at DESC
-- 2. SELECT * FROM messages WHERE conversation_id = 'xxx' ORDER BY created_at ASC
-- 3. SELECT send_message('outfitter-id', 'client-id', 'staff', 'Hello!', 'Admin Name')
-- 4. SELECT mark_messages_read('conversation-id', 'staff')
