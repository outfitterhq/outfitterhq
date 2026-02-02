-- Fix: "column p.email does not exist"
-- The profiles table may not have an email column; admin email comes from auth.users.
-- Replace notify_contract_submitted and notify_time_off_created to use auth.users for email.

-- Trigger: Notify admin when contract is submitted for review
CREATE OR REPLACE FUNCTION notify_contract_submitted()
RETURNS TRIGGER AS $$
DECLARE
  v_admin_email TEXT;
BEGIN
  IF NEW.status = 'pending_admin_review' AND (OLD.status IS NULL OR OLD.status != 'pending_admin_review') THEN
    FOR v_admin_email IN
      SELECT u.email
      FROM outfitter_memberships om
      JOIN auth.users u ON u.id = om.user_id
      WHERE om.outfitter_id = NEW.outfitter_id
        AND om.status = 'active'
        AND om.role IN ('owner', 'admin')
        AND u.email IS NOT NULL
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

-- Trigger: Notify admin when time off request is created
CREATE OR REPLACE FUNCTION notify_time_off_created()
RETURNS TRIGGER AS $$
DECLARE
  v_admin_emails TEXT[];
  v_admin_email TEXT;
BEGIN
  IF NEW.status = 'pending' THEN
    SELECT ARRAY_AGG(u.email)
    INTO v_admin_emails
    FROM outfitter_memberships om
    JOIN auth.users u ON u.id = om.user_id
    WHERE om.outfitter_id = NEW.outfitter_id
      AND om.status = 'active'
      AND om.role IN ('owner', 'admin')
      AND u.email IS NOT NULL;

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
