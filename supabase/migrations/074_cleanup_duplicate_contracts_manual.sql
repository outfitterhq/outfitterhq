-- Migration: Manual cleanup of duplicate contracts
-- Run this in Supabase SQL editor to clean up existing duplicates
-- Keeps the oldest contract per hunt_id and deletes the rest

-- =============================================================================
-- STEP 1: See what duplicates exist (run this first to preview)
-- =============================================================================

-- Preview duplicates (run this first to see what will be deleted)
SELECT 
  hunt_id,
  COUNT(*) as contract_count,
  array_agg(id ORDER BY created_at ASC) as contract_ids,
  array_agg(created_at ORDER BY created_at ASC) as created_dates,
  array_agg(status ORDER BY created_at ASC) as statuses
FROM hunt_contracts
WHERE hunt_id IS NOT NULL
GROUP BY hunt_id
HAVING COUNT(*) > 1
ORDER BY contract_count DESC;

-- =============================================================================
-- STEP 2: Delete duplicate contracts (keeps oldest, deletes rest)
-- =============================================================================

-- WARNING: This will delete duplicate contracts!
-- Make sure you've reviewed the preview above before running this

DO $$
DECLARE
  rec RECORD;
  v_keep_id UUID;
  v_deleted_count INTEGER;
  v_total_deleted INTEGER := 0;
BEGIN
  -- Find hunts with multiple contracts
  FOR rec IN 
    SELECT 
      hunt_id, 
      COUNT(*) as cnt, 
      array_agg(id ORDER BY created_at ASC) as contract_ids,
      array_agg(created_at ORDER BY created_at ASC) as created_dates,
      array_agg(status ORDER BY created_at ASC) as statuses
    FROM hunt_contracts
    WHERE hunt_id IS NOT NULL
    GROUP BY hunt_id
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
  LOOP
    -- Keep the oldest contract (first in array)
    v_keep_id := rec.contract_ids[1];
    
    RAISE NOTICE 'Found % duplicate contracts for hunt %. Keeping contract % (created: %, status: %)', 
      rec.cnt, rec.hunt_id, v_keep_id, rec.created_dates[1], rec.statuses[1];
    
    -- Delete the duplicates (all except the first)
    DELETE FROM hunt_contracts
    WHERE hunt_id = rec.hunt_id
      AND id != v_keep_id;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    v_total_deleted := v_total_deleted + v_deleted_count;
    
    RAISE NOTICE 'Deleted % duplicate contract(s) for hunt %. Kept contract %', 
      v_deleted_count, rec.hunt_id, v_keep_id;
  END LOOP;
  
  RAISE NOTICE 'Cleanup complete. Total contracts deleted: %', v_total_deleted;
END $$;

-- =============================================================================
-- STEP 3: Verify cleanup (run this after deletion)
-- =============================================================================

-- Check if any duplicates remain
SELECT 
  hunt_id,
  COUNT(*) as contract_count
FROM hunt_contracts
WHERE hunt_id IS NOT NULL
GROUP BY hunt_id
HAVING COUNT(*) > 1;

-- Should return 0 rows if cleanup was successful

-- =============================================================================
-- NOTES
-- =============================================================================
-- 1. This keeps the OLDEST contract (earliest created_at)
-- 2. If you want to keep a different contract, modify the ORDER BY in array_agg
-- 3. Contracts without hunt_id are NOT affected (they can have multiple)
-- 4. Run STEP 1 first to preview what will be deleted
-- 5. Backup your database before running STEP 2
