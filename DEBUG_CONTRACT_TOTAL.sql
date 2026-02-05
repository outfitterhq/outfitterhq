-- Debug query to see what's actually stored in the database
-- Run this in Supabase SQL Editor to see the actual values

SELECT 
  hc.id AS contract_id,
  hc.contract_total_cents AS stored_contract_total_cents,
  hc.calculated_guide_fee_cents,
  hc.calculated_addons_cents,
  -- Calculate what the total SHOULD be
  (hc.calculated_guide_fee_cents + hc.calculated_addons_cents + ROUND((hc.calculated_guide_fee_cents + hc.calculated_addons_cents) * 0.05)) AS correct_total_cents,
  -- Show the difference
  (hc.contract_total_cents - (hc.calculated_guide_fee_cents + hc.calculated_addons_cents + ROUND((hc.calculated_guide_fee_cents + hc.calculated_addons_cents) * 0.05))) AS difference_cents,
  -- Show payment items that might be affecting this
  (SELECT COUNT(*) FROM payment_items pi WHERE pi.contract_id = hc.id) AS payment_items_count,
  (SELECT SUM(pi.total_cents) FROM payment_items pi WHERE pi.contract_id = hc.id) AS payment_items_sum_cents,
  hc.client_email,
  hc.created_at
FROM hunt_contracts hc
WHERE hc.contract_total_cents > 0
ORDER BY hc.created_at DESC
LIMIT 10;

-- Also check if payment items are being included incorrectly
SELECT 
  pi.id AS payment_item_id,
  pi.contract_id,
  pi.item_type,
  pi.description,
  pi.subtotal_cents,
  pi.platform_fee_cents,
  pi.total_cents,
  pi.status,
  hc.contract_total_cents AS contract_total
FROM payment_items pi
JOIN hunt_contracts hc ON hc.id = pi.contract_id
WHERE pi.contract_id IS NOT NULL
  AND (pi.item_type = 'hunt_deposit' OR pi.total_cents = 52500 OR pi.subtotal_cents = 50000)
ORDER BY pi.created_at DESC;
