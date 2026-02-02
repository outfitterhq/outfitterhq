-- Migration: Contract scheduling rules
-- 1. Fix client RLS for contracts (case-insensitive email match)
-- 2. Require contract completion before scheduling hunt

-- =============================================================================
-- PART 1: Fix RLS for hunt_contracts (case-insensitive email)
-- =============================================================================

DROP POLICY IF EXISTS "Clients can view own hunt contracts" ON hunt_contracts;
CREATE POLICY "Clients can view own hunt contracts"
  ON hunt_contracts FOR SELECT
  USING (
    LOWER(client_email) = LOWER(auth.jwt() ->> 'email')
  );

DROP POLICY IF EXISTS "Clients can complete own hunt contracts" ON hunt_contracts;
CREATE POLICY "Clients can complete own hunt contracts"
  ON hunt_contracts FOR UPDATE
  USING (
    LOWER(client_email) = LOWER(auth.jwt() ->> 'email')
    AND status = 'pending_client_completion'
  );

-- =============================================================================
-- PART 2: Add scheduling_blocked column to calendar_events
-- =============================================================================

ALTER TABLE calendar_events 
ADD COLUMN IF NOT EXISTS scheduling_blocked BOOLEAN DEFAULT true;

-- Update existing hunts: unblock if contract is completed
UPDATE calendar_events ce
SET scheduling_blocked = false
WHERE EXISTS (
  SELECT 1 FROM hunt_contracts hc 
  WHERE hc.hunt_id = ce.id 
    AND hc.status IN ('ready_for_signature', 'sent_to_docusign', 'client_signed', 'fully_executed')
);

-- For non-private-land hunts, don't block scheduling
UPDATE calendar_events 
SET scheduling_blocked = false 
WHERE hunt_type != 'private_land' OR hunt_type IS NULL;

-- =============================================================================
-- PART 3: Function to check contract status before scheduling
-- =============================================================================

CREATE OR REPLACE FUNCTION check_contract_before_scheduling()
RETURNS TRIGGER AS $$
DECLARE
  v_contract_status TEXT;
BEGIN
  -- Only check private land hunts
  IF NEW.hunt_type = 'private_land' THEN
    
    -- If trying to assign a guide or change status to Scheduled
    IF (NEW.guide_username IS NOT NULL AND (OLD.guide_username IS NULL OR OLD.guide_username != NEW.guide_username))
       OR (NEW.status = 'Scheduled' AND (OLD.status IS NULL OR OLD.status != 'Scheduled')) THEN
      
      -- Check contract status
      SELECT status INTO v_contract_status
      FROM hunt_contracts
      WHERE hunt_id = NEW.id;
      
      -- If no contract or contract not completed by client
      IF v_contract_status IS NULL THEN
        RAISE EXCEPTION 'Cannot schedule hunt: No contract exists. Client must complete their contract first.';
      END IF;
      
      IF v_contract_status NOT IN ('ready_for_signature', 'sent_to_docusign', 'client_signed', 'fully_executed') THEN
        RAISE EXCEPTION 'Cannot schedule hunt: Client has not completed their contract. Current status: %', v_contract_status;
      END IF;
      
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- PART 4: Create trigger to enforce contract completion
-- =============================================================================

DROP TRIGGER IF EXISTS trigger_check_contract_before_scheduling ON calendar_events;

CREATE TRIGGER trigger_check_contract_before_scheduling
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION check_contract_before_scheduling();

-- =============================================================================
-- PART 5: Function to unblock scheduling when contract is completed
-- =============================================================================

CREATE OR REPLACE FUNCTION unblock_scheduling_on_contract_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- When contract status changes to a completed state, unblock scheduling
  IF NEW.status IN ('ready_for_signature', 'sent_to_docusign', 'client_signed', 'fully_executed') 
     AND (OLD.status IS NULL OR OLD.status = 'pending_client_completion' OR OLD.status = 'draft') THEN
    
    UPDATE calendar_events 
    SET scheduling_blocked = false 
    WHERE id = NEW.hunt_id;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- PART 6: Trigger on hunt_contracts to unblock scheduling
-- =============================================================================

DROP TRIGGER IF EXISTS trigger_unblock_scheduling ON hunt_contracts;

CREATE TRIGGER trigger_unblock_scheduling
  AFTER UPDATE ON hunt_contracts
  FOR EACH ROW
  EXECUTE FUNCTION unblock_scheduling_on_contract_completion();

-- =============================================================================
-- PART 7: Also fix calendar_events RLS for clients (case-insensitive)
-- =============================================================================

DROP POLICY IF EXISTS "Clients can view own calendar events" ON calendar_events;
CREATE POLICY "Clients can view own calendar events"
  ON calendar_events
  FOR SELECT
  USING (
    LOWER(client_email) = LOWER(auth.jwt() ->> 'email')
  );

-- =============================================================================
-- Summary:
-- 1. Fixed RLS with case-insensitive email matching
-- 2. Added scheduling_blocked column to track if scheduling is allowed
-- 3. Added trigger to prevent guide assignment/scheduling without completed contract
-- 4. Added trigger to unblock scheduling when contract is completed
--
-- Contract flow:
-- 1. Client purchases tag -> Hunt created -> Contract created (pending_client_completion)
-- 2. Client completes contract -> status = 'ready_for_signature'
-- 3. Admin can now assign guide and schedule the hunt
-- =============================================================================
