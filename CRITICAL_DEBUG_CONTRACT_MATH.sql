-- CRITICAL: Debug contract math discrepancy
-- BILL shows: $5600 (Archery elk $5000 + Extra days $200 + Non-hunters $200 + Spotter $200)
-- Contract total shows: $6,314.32 (WRONG - should be $5600)
-- Amount due shows: $6,630.04 (WRONG - should be $5880 = $5600 + 5%)

-- Replace 'YOUR_CONTRACT_ID' with the actual contract ID
-- Replace 'YOUR_HUNT_ID' with the actual hunt ID

-- Step 1: Check what's stored in the contract
SELECT 
  hc.id AS contract_id,
  hc.hunt_id,
  hc.contract_total_cents AS stored_contract_total,
  hc.calculated_guide_fee_cents,
  hc.calculated_addons_cents,
  hc.client_selected_start_date,
  hc.client_selected_end_date,
  hc.selected_pricing_item_id,
  hc.client_completion_data,
  -- Calculate what it SHOULD be
  (hc.calculated_guide_fee_cents + hc.calculated_addons_cents) AS expected_subtotal_cents,
  ROUND((hc.calculated_guide_fee_cents + hc.calculated_addons_cents) * 0.05) AS expected_platform_fee_cents,
  (hc.calculated_guide_fee_cents + hc.calculated_addons_cents + ROUND((hc.calculated_guide_fee_cents + hc.calculated_addons_cents) * 0.05)) AS expected_total_cents
FROM hunt_contracts hc
WHERE hc.contract_total_cents > 0
ORDER BY hc.created_at DESC
LIMIT 5;

-- Step 2: Check the pricing item and calculate guide fee based on selected days
SELECT 
  pi.id AS pricing_item_id,
  pi.title,
  pi.amount_usd,
  pi.included_days,
  -- Calculate per-day rate
  (pi.amount_usd / NULLIF(pi.included_days, 0)) AS per_day_rate,
  -- Check selected days from contract
  hc.client_selected_start_date,
  hc.client_selected_end_date,
  (hc.client_selected_end_date - hc.client_selected_start_date + 1) AS selected_days,
  -- Calculate what guide fee should be
  CASE 
    WHEN hc.client_selected_start_date IS NOT NULL AND hc.client_selected_end_date IS NOT NULL
    THEN ROUND((pi.amount_usd / NULLIF(pi.included_days, 0)) * (hc.client_selected_end_date - hc.client_selected_start_date + 1) * 100)
    ELSE ROUND(pi.amount_usd * 100)
  END AS calculated_guide_fee_should_be_cents,
  hc.calculated_guide_fee_cents AS stored_guide_fee_cents
FROM hunt_contracts hc
JOIN pricing_items pi ON pi.id = hc.selected_pricing_item_id
WHERE hc.contract_total_cents > 0
ORDER BY hc.created_at DESC
LIMIT 5;

-- Step 3: Check payment items that might be adding extra amounts
SELECT 
  pi.id AS payment_item_id,
  pi.contract_id,
  pi.item_type,
  pi.description,
  pi.subtotal_cents,
  pi.platform_fee_cents,
  pi.total_cents,
  pi.status,
  pi.amount_paid_cents,
  hc.contract_total_cents AS contract_total,
  hc.calculated_guide_fee_cents,
  hc.calculated_addons_cents
FROM payment_items pi
JOIN hunt_contracts hc ON hc.id = pi.contract_id
WHERE pi.contract_id IS NOT NULL
  AND pi.status != 'cancelled'
ORDER BY pi.created_at DESC
LIMIT 10;

-- Step 4: Check if there are multiple payment items summing to the wrong total
SELECT 
  hc.id AS contract_id,
  hc.contract_total_cents AS contract_total,
  COUNT(pi.id) AS payment_items_count,
  SUM(pi.total_cents) AS payment_items_sum,
  hc.calculated_guide_fee_cents,
  hc.calculated_addons_cents,
  (hc.calculated_guide_fee_cents + hc.calculated_addons_cents) AS expected_subtotal,
  ROUND((hc.calculated_guide_fee_cents + hc.calculated_addons_cents) * 0.05) AS expected_platform_fee,
  (hc.calculated_guide_fee_cents + hc.calculated_addons_cents + ROUND((hc.calculated_guide_fee_cents + hc.calculated_addons_cents) * 0.05)) AS expected_total
FROM hunt_contracts hc
LEFT JOIN payment_items pi ON pi.contract_id = hc.id AND pi.status != 'cancelled'
WHERE hc.contract_total_cents > 0
GROUP BY hc.id, hc.contract_total_cents, hc.calculated_guide_fee_cents, hc.calculated_addons_cents
HAVING hc.contract_total_cents != (hc.calculated_guide_fee_cents + hc.calculated_addons_cents + ROUND((hc.calculated_guide_fee_cents + hc.calculated_addons_cents) * 0.05))
ORDER BY hc.created_at DESC;
