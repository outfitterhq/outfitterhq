-- ============================================
-- Remove auto-deposit payment items and recalculate contract totals
-- ============================================
-- This migration:
-- 1. Deletes old auto-deposit payment items ($500/$525) that shouldn't exist
-- 2. Recalculates all contract totals from guide fee + add-ons + platform fee only
-- 3. Ensures payment items are NOT used in contract total calculation

-- Step 1: Delete old auto-deposit payment items
-- These were created by the old trigger and shouldn't be part of the contract total
DELETE FROM payment_items
WHERE item_type = 'hunt_deposit'
  AND (
    -- $500 deposit + 5% fee = $525
    total_cents = 52500
    OR subtotal_cents = 50000
    OR (
      description ILIKE '%deposit%'
      AND contract_id IS NOT NULL
      AND created_at < (SELECT MAX(created_at) FROM hunt_contracts WHERE contract_total_cents > 0)
    )
  );

-- Step 2: Recalculate all contract totals properly
-- This ensures contract_total_cents is calculated from guide fee + add-ons + platform fee only
DO $$
DECLARE
  contract_record RECORD;
BEGIN
  FOR contract_record IN 
    SELECT id FROM hunt_contracts
    WHERE contract_total_cents > 0 OR calculated_guide_fee_cents > 0 OR calculated_addons_cents > 0
  LOOP
    -- Recalculate using the proper function
    PERFORM recalculate_contract_total(contract_record.id);
    
    -- Update payment totals after recalculation
    PERFORM update_contract_payment_totals(contract_record.id);
  END LOOP;
END $$;

-- Step 3: For contracts with payment items but wrong totals, fix them
-- If a contract has payment items but the total doesn't match guide fee + add-ons + platform fee,
-- recalculate the total (this should already be done above, but just in case)
UPDATE hunt_contracts
SET contract_total_cents = (
  SELECT GREATEST(0, 
    COALESCE(calculated_guide_fee_cents, 0) + 
    COALESCE(calculated_addons_cents, 0) + 
    ROUND((COALESCE(calculated_guide_fee_cents, 0) + COALESCE(calculated_addons_cents, 0)) * 0.05)
  )
)
WHERE contract_total_cents != (
  COALESCE(calculated_guide_fee_cents, 0) + 
  COALESCE(calculated_addons_cents, 0) + 
  ROUND((COALESCE(calculated_guide_fee_cents, 0) + COALESCE(calculated_addons_cents, 0)) * 0.05)
)
AND (calculated_guide_fee_cents > 0 OR calculated_addons_cents > 0);

-- Step 4: Recalculate payment totals for all affected contracts
DO $$
DECLARE
  contract_record RECORD;
BEGIN
  FOR contract_record IN 
    SELECT id FROM hunt_contracts
    WHERE contract_total_cents > 0
  LOOP
    PERFORM update_contract_payment_totals(contract_record.id);
  END LOOP;
END $$;

-- Add comment
COMMENT ON FUNCTION recalculate_contract_total IS 'Recalculates contract total from guide fee + add-ons + platform fee (5%). Payment items are NOT included in this calculation.';
