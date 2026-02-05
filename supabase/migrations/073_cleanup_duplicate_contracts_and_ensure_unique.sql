-- Migration: Cleanup duplicate contracts and ensure strict uniqueness
-- Removes all duplicate contracts, keeping only the oldest one per hunt_id
-- Adds additional safety checks

-- =============================================================================
-- PART 1: Find and remove duplicate contracts (keep oldest)
-- =============================================================================

DO $$
DECLARE
  rec RECORD;
  v_keep_id UUID;
  v_deleted_count INTEGER;
BEGIN
  -- Find hunts with multiple contracts
  FOR rec IN 
    SELECT 
      hunt_id, 
      COUNT(*) as cnt, 
      array_agg(id ORDER BY created_at ASC) as contract_ids,
      array_agg(created_at ORDER BY created_at ASC) as created_dates
    FROM hunt_contracts
    WHERE hunt_id IS NOT NULL
    GROUP BY hunt_id
    HAVING COUNT(*) > 1
  LOOP
    -- Keep the oldest contract (first in array)
    v_keep_id := rec.contract_ids[1];
    
    RAISE NOTICE 'Found % duplicate contracts for hunt %. Keeping contract % (created: %)', 
      rec.cnt, rec.hunt_id, v_keep_id, rec.created_dates[1];
    
    -- Delete the duplicates (all except the first)
    DELETE FROM hunt_contracts
    WHERE hunt_id = rec.hunt_id
      AND id != v_keep_id;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    RAISE NOTICE 'Deleted % duplicate contract(s) for hunt %. Kept contract %', 
      v_deleted_count, rec.hunt_id, v_keep_id;
  END LOOP;
END $$;

-- =============================================================================
-- PART 2: Ensure unique constraint is in place (redundant but safe)
-- =============================================================================

-- Drop and recreate to ensure it's correct
DROP INDEX IF EXISTS hunt_contracts_hunt_id_unique;

-- Create partial unique index (only enforces uniqueness when hunt_id is NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS hunt_contracts_hunt_id_unique 
ON hunt_contracts(hunt_id) 
WHERE hunt_id IS NOT NULL;

-- =============================================================================
-- PART 3: Add a function to safely get or create contract (prevents duplicates)
-- =============================================================================

CREATE OR REPLACE FUNCTION get_or_create_contract_for_hunt(
  p_hunt_id UUID,
  p_outfitter_id UUID,
  p_client_email TEXT,
  p_client_name TEXT,
  p_content TEXT,
  p_status TEXT DEFAULT 'pending_client_completion',
  p_template_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_contract_id UUID;
BEGIN
  -- First, try to get existing contract
  SELECT id INTO v_contract_id
  FROM hunt_contracts
  WHERE hunt_id = p_hunt_id
  LIMIT 1
  FOR UPDATE;
  
  -- If contract exists, return it
  IF v_contract_id IS NOT NULL THEN
    RETURN v_contract_id;
  END IF;
  
  -- Otherwise, create new contract
  INSERT INTO hunt_contracts (
    outfitter_id,
    hunt_id,
    client_email,
    client_name,
    content,
    status,
    template_id
  )
  VALUES (
    p_outfitter_id,
    p_hunt_id,
    p_client_email,
    p_client_name,
    p_content,
    p_status,
    p_template_id
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_contract_id;
  
  -- If insert failed due to conflict, fetch the existing one
  IF v_contract_id IS NULL THEN
    SELECT id INTO v_contract_id
    FROM hunt_contracts
    WHERE hunt_id = p_hunt_id
    LIMIT 1;
  END IF;
  
  RETURN v_contract_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_or_create_contract_for_hunt IS 'Safely gets existing contract for a hunt or creates a new one. Prevents duplicates by checking first and using ON CONFLICT.';

-- =============================================================================
-- DONE
-- =============================================================================
-- All duplicate contracts have been removed
-- Unique constraint ensures no new duplicates can be created
-- Helper function provides safe contract creation
