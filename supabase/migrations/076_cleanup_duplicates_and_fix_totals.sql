-- ============================================
-- CLEANUP: Remove Duplicate Contracts and Fix Totals
-- ============================================
-- This migration:
-- 1. Deletes duplicate contracts (keeps oldest for each hunt_id)
-- 2. Sets contract_total_cents to 0 for contracts with no pricing selected
-- 3. Ensures remaining_balance_cents matches contract_total_cents - amount_paid_cents

-- ============================================
-- PART 1: DELETE DUPLICATE CONTRACTS
-- ============================================
-- Keep the oldest contract for each hunt_id, delete the rest

DELETE FROM hunt_contracts
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (PARTITION BY hunt_id ORDER BY created_at ASC) as rn
    FROM hunt_contracts
    WHERE hunt_id IS NOT NULL
  ) t
  WHERE rn > 1
);

-- ============================================
-- PART 2: FIX CONTRACT TOTALS
-- ============================================
-- Set contract_total_cents to 0 if:
-- - No pricing item selected AND
-- - No dates selected AND
-- - calculated_guide_fee_cents is 0

UPDATE hunt_contracts
SET 
  contract_total_cents = 0,
  remaining_balance_cents = 0,
  payment_status = 'unpaid'
WHERE (
  (selected_pricing_item_id IS NULL OR calculated_guide_fee_cents = 0)
  AND (client_selected_start_date IS NULL OR client_selected_end_date IS NULL)
  AND calculated_guide_fee_cents = 0
  AND calculated_addons_cents = 0
);

-- ============================================
-- PART 3: RECALCULATE REMAINING BALANCE
-- ============================================
-- Ensure remaining_balance_cents = contract_total_cents - amount_paid_cents
-- Also recalculate amount_paid_cents from payment_items

UPDATE hunt_contracts hc
SET 
  amount_paid_cents = COALESCE((
    SELECT SUM(amount_paid_cents)
    FROM payment_items
    WHERE contract_id = hc.id
      AND status IN ('paid', 'partially_paid')
  ), 0),
  remaining_balance_cents = GREATEST(0, COALESCE(contract_total_cents, 0) - COALESCE((
    SELECT SUM(amount_paid_cents)
    FROM payment_items
    WHERE contract_id = hc.id
      AND status IN ('paid', 'partially_paid')
  ), 0))
WHERE contract_total_cents IS NOT NULL;

-- ============================================
-- PART 4: DELETE PAYMENT ITEMS FOR CONTRACTS WITH $0 TOTAL
-- ============================================
-- Remove payment items that were auto-created for contracts with no pricing

DELETE FROM payment_items
WHERE contract_id IN (
  SELECT id FROM hunt_contracts WHERE contract_total_cents = 0
);

-- ============================================
-- PART 5: UPDATE PAYMENT STATUS
-- ============================================
-- Set payment_status based on amounts

UPDATE hunt_contracts
SET payment_status = CASE
  WHEN contract_total_cents = 0 THEN 'unpaid'
  WHEN amount_paid_cents >= contract_total_cents THEN 'paid_in_full'
  WHEN amount_paid_cents > 0 THEN 'deposit_paid'
  ELSE 'unpaid'
END
WHERE contract_total_cents IS NOT NULL;

-- ============================================
-- DONE!
-- ============================================
