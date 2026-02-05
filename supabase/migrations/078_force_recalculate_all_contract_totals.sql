-- ============================================
-- Force recalculate ALL contract totals from guide fee + addons + platform fee
-- This ensures contract_total_cents is NEVER calculated from payment items
-- ============================================

-- Step 1: For each contract, recalculate the total properly
DO $$
DECLARE
  contract_record RECORD;
  v_guide_fee_cents INTEGER;
  v_addons_cents INTEGER;
  v_platform_fee_cents INTEGER;
  v_correct_total INTEGER;
BEGIN
  FOR contract_record IN 
    SELECT 
      id,
      calculated_guide_fee_cents,
      calculated_addons_cents,
      contract_total_cents
    FROM hunt_contracts
    WHERE contract_total_cents > 0 OR calculated_guide_fee_cents > 0 OR calculated_addons_cents > 0
  LOOP
    -- Calculate correct total: guide fee + addons + 5% platform fee
    v_guide_fee_cents := COALESCE(contract_record.calculated_guide_fee_cents, 0);
    v_addons_cents := COALESCE(contract_record.calculated_addons_cents, 0);
    v_platform_fee_cents := ROUND((v_guide_fee_cents + v_addons_cents) * 0.05);
    v_correct_total := v_guide_fee_cents + v_addons_cents + v_platform_fee_cents;
    
    -- Only update if the stored total is wrong
    IF contract_record.contract_total_cents != v_correct_total THEN
      UPDATE hunt_contracts
      SET 
        contract_total_cents = v_correct_total,
        updated_at = NOW()
      WHERE id = contract_record.id;
      
      RAISE NOTICE 'Fixed contract %: was %, now %', 
        contract_record.id, 
        contract_record.contract_total_cents, 
        v_correct_total;
    END IF;
  END LOOP;
END $$;

-- Step 2: Recalculate payment totals for all contracts
DO $$
DECLARE
  contract_record RECORD;
BEGIN
  FOR contract_record IN 
    SELECT id FROM hunt_contracts WHERE contract_total_cents > 0
  LOOP
    PERFORM update_contract_payment_totals(contract_record.id);
  END LOOP;
END $$;

-- Step 3: Verify no payment items are affecting contract totals
-- This query should return 0 rows if everything is correct
-- (contract_total_cents should NOT equal sum of payment_items.total_cents)
SELECT 
  hc.id AS contract_id,
  hc.contract_total_cents AS stored_total,
  COALESCE(SUM(pi.total_cents), 0) AS payment_items_sum,
  hc.calculated_guide_fee_cents,
  hc.calculated_addons_cents,
  (hc.calculated_guide_fee_cents + hc.calculated_addons_cents + ROUND((hc.calculated_guide_fee_cents + hc.calculated_addons_cents) * 0.05)) AS correct_total
FROM hunt_contracts hc
LEFT JOIN payment_items pi ON pi.contract_id = hc.id
WHERE hc.contract_total_cents > 0
GROUP BY hc.id, hc.contract_total_cents, hc.calculated_guide_fee_cents, hc.calculated_addons_cents
HAVING hc.contract_total_cents != (hc.calculated_guide_fee_cents + hc.calculated_addons_cents + ROUND((hc.calculated_guide_fee_cents + hc.calculated_addons_cents) * 0.05))
   OR hc.contract_total_cents = COALESCE(SUM(pi.total_cents), 0)
ORDER BY hc.contract_total_cents DESC;
