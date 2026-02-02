-- Migration: Notification/Alert System
-- Tracks pending actions for admins and clients

-- =============================================================================
-- PART 1: Create notifications table
-- =============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outfitter_id UUID NOT NULL REFERENCES outfitters(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL, -- For clients/admins who may not have user_id yet
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'contract_pending_review',      -- Admin: Contract needs review
    'contract_approved',             -- Client: Contract approved
    'contract_rejected',             -- Client: Contract needs resubmission
    'contract_completion_required',  -- Client: Contract needs completion
    'questionnaire_required',        -- Client: Questionnaire needs completion
    'waiver_required',               -- Client: Waiver needs signing
    'time_off_pending',              -- Admin: Time off request pending
    'time_off_approved',             -- Guide: Time off approved
    'time_off_denied',              -- Guide: Time off denied
    'hunt_closeout_required',       -- Guide: Hunt needs closeout
    'payment_due',                  -- Client: Payment due
    'hunt_upcoming',                -- Client: Hunt starting soon
    'calendar_event_required'        -- Admin: Contract approved but no calendar event
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT, -- URL to take action (e.g., /contract-review, /client/documents/hunt-contract)
  related_id UUID, -- ID of related entity (contract_id, hunt_id, etc.)
  related_type TEXT, -- Type of related entity ('contract', 'hunt', 'time_off', etc.)
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ, -- Optional expiration date
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB -- Additional data (e.g., contract details, hunt dates)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_email ON notifications(user_email);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_outfitter ON notifications(outfitter_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_related ON notifications(related_type, related_id) WHERE related_id IS NOT NULL;

-- =============================================================================
-- PART 2: RLS Policies
-- =============================================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (
    user_id = auth.uid()
    OR user_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (
    user_id = auth.uid()
    OR user_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    OR user_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- System can create notifications (via service role or triggers)
-- Admins can create notifications for their outfitter
CREATE POLICY "Admins can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM outfitter_memberships
      WHERE outfitter_memberships.outfitter_id = notifications.outfitter_id
        AND outfitter_memberships.user_id = auth.uid()
        AND outfitter_memberships.status = 'active'
        AND outfitter_memberships.role IN ('owner', 'admin')
    )
  );

-- =============================================================================
-- PART 3: Helper Functions
-- =============================================================================

-- Function to create notification
CREATE OR REPLACE FUNCTION create_notification(
  p_outfitter_id UUID,
  p_user_email TEXT,
  p_notification_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_action_url TEXT DEFAULT NULL,
  p_related_id UUID DEFAULT NULL,
  p_related_type TEXT DEFAULT NULL,
  p_priority TEXT DEFAULT 'normal',
  p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_notification_id UUID;
BEGIN
  -- Get user_id from email if exists
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_user_email
  LIMIT 1;
  
  -- Insert notification
  INSERT INTO notifications (
    outfitter_id,
    user_id,
    user_email,
    notification_type,
    title,
    message,
    action_url,
    related_id,
    related_type,
    priority,
    expires_at,
    metadata
  ) VALUES (
    p_outfitter_id,
    v_user_id,
    p_user_email,
    p_notification_type,
    p_title,
    p_message,
    p_action_url,
    p_related_id,
    p_related_type,
    p_priority,
    p_expires_at,
    p_metadata
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE notifications
  SET is_read = true,
      read_at = NOW()
  WHERE id = p_notification_id
    AND (
      user_id = auth.uid()
      OR user_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark all notifications as read for a user
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_email TEXT)
RETURNS void AS $$
BEGIN
  UPDATE notifications
  SET is_read = true,
      read_at = NOW()
  WHERE user_email = p_user_email
    AND is_read = false
    AND (
      user_id = auth.uid()
      OR user_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- PART 4: Triggers to auto-create notifications
-- =============================================================================

-- Trigger: Notify admin when contract is submitted for review
CREATE OR REPLACE FUNCTION notify_contract_submitted()
RETURNS TRIGGER AS $$
DECLARE
  v_admin_email TEXT;
BEGIN
  IF NEW.status = 'pending_admin_review' AND (OLD.status IS NULL OR OLD.status != 'pending_admin_review') THEN
    -- Create notification for all admins of this outfitter
    FOR v_admin_email IN
      SELECT p.email
      FROM outfitter_memberships om
      JOIN profiles p ON p.id = om.user_id
      WHERE om.outfitter_id = NEW.outfitter_id
        AND om.status = 'active'
        AND om.role IN ('owner', 'admin')
    LOOP
      PERFORM create_notification(
        NEW.outfitter_id,
        v_admin_email,
        'contract_pending_review',
        'Contract Pending Review',
        'A contract from ' || COALESCE(NEW.client_name, NEW.client_email) || ' is pending review.',
        '/contract-review',
        NEW.id,
        'contract',
        'high',
        NULL,
        jsonb_build_object(
          'contract_id', NEW.id,
          'client_email', NEW.client_email,
          'client_name', NEW.client_name
        )
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_contract_submitted
  AFTER INSERT OR UPDATE ON hunt_contracts
  FOR EACH ROW
  EXECUTE FUNCTION notify_contract_submitted();

-- Trigger: Notify client when contract is approved/rejected
CREATE OR REPLACE FUNCTION notify_contract_reviewed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'ready_for_signature' AND OLD.status = 'pending_admin_review' THEN
    -- Contract approved
    PERFORM create_notification(
      NEW.outfitter_id,
      NEW.client_email,
      'contract_approved',
      'Contract Approved',
      'Your hunt contract has been approved and is ready for signature.',
      '/client/documents/hunt-contract',
      NEW.id,
      'contract',
      'normal',
      NULL,
      jsonb_build_object('contract_id', NEW.id)
    );
  ELSIF NEW.status = 'pending_client_completion' AND OLD.status = 'pending_admin_review' AND NEW.admin_reviewed_at IS NOT NULL THEN
    -- Contract rejected
    PERFORM create_notification(
      NEW.outfitter_id,
      NEW.client_email,
      'contract_rejected',
      'Contract Needs Revision',
      'Your contract submission needs revision. Please review and resubmit.',
      '/client/documents/hunt-contract',
      NEW.id,
      'contract',
      'high',
      NULL,
      jsonb_build_object(
        'contract_id', NEW.id,
        'admin_notes', NEW.admin_review_notes
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_contract_reviewed
  AFTER UPDATE ON hunt_contracts
  FOR EACH ROW
  EXECUTE FUNCTION notify_contract_reviewed();

-- Trigger: Notify admin when time off request is created
CREATE OR REPLACE FUNCTION notify_time_off_created()
RETURNS TRIGGER AS $$
DECLARE
  v_admin_emails TEXT[];
  v_admin_email TEXT;
BEGIN
  IF NEW.status = 'pending' THEN
    -- Get all admin emails for this outfitter
    SELECT ARRAY_AGG(p.email)
    INTO v_admin_emails
    FROM outfitter_memberships om
    JOIN profiles p ON p.id = om.user_id
    WHERE om.outfitter_id = NEW.outfitter_id
      AND om.status = 'active'
      AND om.role IN ('owner', 'admin');
    
    -- Create notification for each admin
    IF v_admin_emails IS NOT NULL THEN
      FOREACH v_admin_email IN ARRAY v_admin_emails
      LOOP
        PERFORM create_notification(
          NEW.outfitter_id,
          v_admin_email,
          'time_off_pending',
          'Time Off Request Pending',
          NEW.guide_username || ' requested time off from ' || NEW.start_date || ' to ' || NEW.end_date,
          '/time-off-requests',
          NEW.id,
          'time_off',
          'normal',
          NULL,
          jsonb_build_object(
            'guide_username', NEW.guide_username,
            'start_date', NEW.start_date,
            'end_date', NEW.end_date
          )
        );
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_time_off_created
  AFTER INSERT ON guide_time_off
  FOR EACH ROW
  EXECUTE FUNCTION notify_time_off_created();

-- Trigger: Notify guide when time off is approved/denied
CREATE OR REPLACE FUNCTION notify_time_off_reviewed()
RETURNS TRIGGER AS $$
DECLARE
  v_guide_email TEXT;
BEGIN
  IF NEW.status != OLD.status AND NEW.status IN ('approved', 'denied') THEN
    -- Get guide email
    SELECT email INTO v_guide_email
    FROM guides
    WHERE username = NEW.guide_username
      AND outfitter_id = NEW.outfitter_id
    LIMIT 1;
    
    IF v_guide_email IS NOT NULL THEN
      PERFORM create_notification(
        NEW.outfitter_id,
        v_guide_email,
        CASE WHEN NEW.status = 'approved' THEN 'time_off_approved' ELSE 'time_off_denied' END,
        CASE WHEN NEW.status = 'approved' THEN 'Time Off Approved' ELSE 'Time Off Denied' END,
        CASE 
          WHEN NEW.status = 'approved' THEN 'Your time off request has been approved.'
          ELSE 'Your time off request has been denied.'
        END,
        NULL,
        NEW.id,
        'time_off',
        'normal',
        NULL,
        jsonb_build_object(
          'start_date', NEW.start_date,
          'end_date', NEW.end_date
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_time_off_reviewed
  AFTER UPDATE ON guide_time_off
  FOR EACH ROW
  EXECUTE FUNCTION notify_time_off_reviewed();

-- =============================================================================
-- DONE
-- =============================================================================
-- Notification system created with:
-- - Notifications table with RLS
-- - Helper functions for creating/reading notifications
-- - Triggers for automatic notifications on key events
-- - Support for both admin and client notifications
