-- Migration: Scheduling only after contract is fully executed
-- Per-hunt rule: Hunts without a fully-executed contract cannot be scheduled.
-- Admin must sign (DocuSign) after client signs; only then does the hunt move to the scheduling queue.

-- =============================================================================
-- PART 1: Tighten check_contract_before_scheduling — require fully_executed
-- =============================================================================

CREATE OR REPLACE FUNCTION check_contract_before_scheduling()
RETURNS TRIGGER AS $$
DECLARE
  v_contract_status TEXT;
BEGIN
  -- Only check private land hunts (and any hunt with a contract)
  IF NEW.hunt_type = 'private_land' THEN

    -- If trying to assign a guide or change status to Scheduled/Booked
    IF (NEW.guide_username IS NOT NULL AND (OLD.guide_username IS NULL OR OLD.guide_username != NEW.guide_username))
       OR (NEW.status IN ('Scheduled', 'Booked') AND (OLD.status IS NULL OR OLD.status NOT IN ('Scheduled', 'Booked'))) THEN

      SELECT status INTO v_contract_status
      FROM hunt_contracts
      WHERE hunt_id = NEW.id;

      IF v_contract_status IS NULL THEN
        RAISE EXCEPTION 'Cannot schedule hunt: No contract exists. Generate the contract and complete client + admin signatures first.';
      END IF;

      -- Only allow scheduling when contract is fully executed (client and admin both signed)
      IF v_contract_status != 'fully_executed' THEN
        RAISE EXCEPTION 'Cannot schedule hunt: Contract must be fully executed (client and admin signed). Current status: %', v_contract_status;
      END IF;

    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- PART 2: Unblock scheduling only when contract becomes fully_executed
-- =============================================================================

CREATE OR REPLACE FUNCTION unblock_scheduling_on_contract_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Only unblock when contract is fully executed (admin has signed after client)
  IF NEW.status = 'fully_executed'
     AND (OLD.status IS NULL OR OLD.status != 'fully_executed') THEN

    UPDATE calendar_events
    SET scheduling_blocked = false
    WHERE id = NEW.hunt_id;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- PART 3: Re-block scheduling for hunts whose contract is not fully_executed
-- =============================================================================

UPDATE calendar_events ce
SET scheduling_blocked = true
WHERE ce.hunt_type = 'private_land'
  AND (ce.scheduling_blocked = false OR ce.scheduling_blocked IS NULL)
  AND EXISTS (
    SELECT 1 FROM hunt_contracts hc
    WHERE hc.hunt_id = ce.id
      AND hc.status IS DISTINCT FROM 'fully_executed'
  );

-- =============================================================================
-- Summary:
-- Scheduling (guide assignment, status Booked/Scheduled) is only allowed when
-- hunt_contracts.status = 'fully_executed'. Client + admin must both sign first.
-- =============================================================================
