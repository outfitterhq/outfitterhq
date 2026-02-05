-- ============================================
-- FRESH START: Contract Flow Redesign
-- ============================================
-- This migration:
-- 1. Deletes all existing contracts (fresh start)
-- 2. Updates auto-generation to work for ALL hunt types when event is created
-- 3. Adds columns for client selected dates and calculated guide fee
-- 4. Creates function to calculate guide fee based on selected days × pricing item
-- 5. Adds contract locking mechanism

-- ============================================
-- PART 1: DELETE ALL EXISTING CONTRACTS
-- ============================================
-- Fresh start - delete all contracts and related payment data

-- Delete scheduled payments (cascade from payment plans)
DELETE FROM contract_scheduled_payments;

-- Delete payment plans
DELETE FROM contract_payment_plans;

-- Delete payment transactions linked to contracts (via payment_items)
DELETE FROM payment_transactions 
WHERE payment_item_id IN (
  SELECT id FROM payment_items WHERE contract_id IS NOT NULL
);

-- Delete payment items linked to contracts
DELETE FROM payment_items WHERE contract_id IS NOT NULL;

-- Delete all hunt contracts
DELETE FROM hunt_contracts;

-- Reset contract_generated_at on all calendar events
UPDATE calendar_events SET contract_generated_at = NULL;

-- ============================================
-- PART 2: ADD NEW COLUMNS TO HUNT_CONTRACTS
-- ============================================

-- Client selected dates (within hunt window)
ALTER TABLE hunt_contracts
ADD COLUMN IF NOT EXISTS client_selected_start_date DATE,
ADD COLUMN IF NOT EXISTS client_selected_end_date DATE;

-- Guide fee calculation fields
ALTER TABLE hunt_contracts
ADD COLUMN IF NOT EXISTS selected_pricing_item_id UUID REFERENCES pricing_items(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS calculated_guide_fee_cents INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS calculated_addons_cents INTEGER DEFAULT 0;

-- Contract locking
ALTER TABLE hunt_contracts
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hunt_contracts_selected_dates ON hunt_contracts(client_selected_start_date, client_selected_end_date);
CREATE INDEX IF NOT EXISTS idx_hunt_contracts_pricing_item ON hunt_contracts(selected_pricing_item_id);
CREATE INDEX IF NOT EXISTS idx_hunt_contracts_locked ON hunt_contracts(is_locked);

-- ============================================
-- PART 3: DROP OLD AUTO-GENERATION TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS trigger_auto_generate_contract ON calendar_events;
DROP TRIGGER IF EXISTS trigger_auto_generate_contract_on_update ON calendar_events;
DROP FUNCTION IF EXISTS generate_hunt_contract_after_insert() CASCADE;
DROP FUNCTION IF EXISTS generate_hunt_contract_after_update() CASCADE;

-- ============================================
-- PART 4: CREATE NEW AUTO-GENERATION FUNCTION
-- ============================================
-- Auto-generates contract when ANY hunt event is created (draw, private land, OTC)
-- Triggered when: calendar_events is inserted with client_email

CREATE OR REPLACE FUNCTION generate_hunt_contract_after_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_client_name TEXT;
  v_content TEXT;
  v_hunt_type_display TEXT;
  v_template_id UUID;
BEGIN
  -- Only generate if hunt has a client email
  IF NEW.client_email IS NOT NULL THEN
    
    -- Get client name
    SELECT COALESCE(first_name || ' ' || last_name, NEW.client_email)
    INTO v_client_name
    FROM clients
    WHERE LOWER(email) = LOWER(NEW.client_email)
    LIMIT 1;
    
    IF v_client_name IS NULL THEN
      v_client_name := NEW.client_email;
    END IF;
    
    -- Get contract template for this outfitter
    SELECT id INTO v_template_id
    FROM contract_templates
    WHERE outfitter_id = NEW.outfitter_id
      AND template_type = 'hunt_contract'
      AND is_active = true
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Determine hunt type display name
    CASE NEW.hunt_type
      WHEN 'private_land' THEN v_hunt_type_display := 'Private Land Tag';
      WHEN 'draw' THEN v_hunt_type_display := 'Draw Hunt';
      ELSE v_hunt_type_display := 'Hunt';
    END CASE;
    
    -- Build contract content
    IF v_template_id IS NOT NULL THEN
      -- Use template (will be populated with actual values later)
      SELECT content INTO v_content
      FROM contract_templates
      WHERE id = v_template_id;
      
      -- Replace template variables
      v_content := COALESCE(v_content, 'HUNT CONTRACT');
      v_content := REPLACE(v_content, '{{client_name}}', v_client_name);
      v_content := REPLACE(v_content, '{{client_email}}', NEW.client_email);
      v_content := REPLACE(v_content, '{{hunt_title}}', COALESCE(NEW.title, 'Hunt'));
      v_content := REPLACE(v_content, '{{hunt_code}}', COALESCE(NEW.hunt_code, 'Not specified'));
      v_content := REPLACE(v_content, '{{species}}', COALESCE(NEW.species, 'Not specified'));
      v_content := REPLACE(v_content, '{{unit}}', COALESCE(NEW.unit, 'Not specified'));
      v_content := REPLACE(v_content, '{{weapon}}', COALESCE(NEW.weapon, 'Not specified'));
      v_content := REPLACE(v_content, '{{hunt_type}}', v_hunt_type_display);
    ELSE
      -- Default content if no template
      v_content := 'HUNT CONTRACT' || E'\n\n' ||
        'Client: ' || v_client_name || E'\n' ||
        'Email: ' || NEW.client_email || E'\n\n' ||
        'Hunt Details:' || E'\n' ||
        '- Hunt Type: ' || v_hunt_type_display || E'\n' ||
        '- Species: ' || COALESCE(NEW.species, 'Not specified') || E'\n' ||
        '- Unit: ' || COALESCE(NEW.unit, 'Not specified') || E'\n' ||
        '- Hunt Code: ' || COALESCE(NEW.hunt_code, 'Not specified') || E'\n\n' ||
        'This contract confirms your hunt booking.' || E'\n\n' ||
        'Please complete your booking by selecting your hunt dates and add-ons.' || E'\n\n' ||
        'Generated: ' || NOW()::date;
    END IF;
    
    -- Insert contract (hunt now exists so FK works)
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
      NEW.outfitter_id, 
      NEW.id, 
      NEW.client_email, 
      v_client_name, 
      v_content, 
      'pending_client_completion',
      v_template_id
    )
    ON CONFLICT (hunt_id) DO NOTHING;
    
    -- Mark contract as generated
    UPDATE calendar_events 
    SET contract_generated_at = NOW() 
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PART 5: CREATE AUTO-GENERATION TRIGGER
-- ============================================

CREATE TRIGGER trigger_auto_generate_contract
  AFTER INSERT ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION generate_hunt_contract_after_insert();

-- ============================================
-- PART 6: CREATE FUNCTION TO CALCULATE GUIDE FEE
-- ============================================
-- Calculates guide fee based on selected days × pricing item per-day rate
-- If pricing item has included_days, calculates: (selected_days / included_days) × item_amount
-- Otherwise uses item_amount as fixed fee

CREATE OR REPLACE FUNCTION calculate_contract_guide_fee(
  p_contract_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_contract RECORD;
  v_pricing_item RECORD;
  v_selected_days INTEGER;
  v_guide_fee_cents INTEGER := 0;
  v_per_day_cents INTEGER;
BEGIN
  -- Get contract details
  SELECT 
    hc.id,
    hc.client_selected_start_date,
    hc.client_selected_end_date,
    hc.selected_pricing_item_id,
    hc.client_completion_data
  INTO v_contract
  FROM hunt_contracts hc
  WHERE hc.id = p_contract_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contract not found: %', p_contract_id;
  END IF;
  
  -- If no pricing item selected, return 0
  IF v_contract.selected_pricing_item_id IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Get pricing item details
  SELECT 
    id,
    amount_usd,
    included_days
  INTO v_pricing_item
  FROM pricing_items
  WHERE id = v_contract.selected_pricing_item_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pricing item not found: %', v_contract.selected_pricing_item_id;
  END IF;
  
  -- Calculate selected days
  IF v_contract.client_selected_start_date IS NOT NULL 
     AND v_contract.client_selected_end_date IS NOT NULL THEN
    v_selected_days := v_contract.client_selected_end_date - v_contract.client_selected_start_date + 1;
  ELSE
    -- No dates selected yet - use included_days from pricing item or default to 0
    v_selected_days := COALESCE(v_pricing_item.included_days, 0);
  END IF;
  
  -- Calculate guide fee
  IF v_pricing_item.included_days IS NOT NULL AND v_pricing_item.included_days > 0 THEN
    -- Per-day rate: item_amount / included_days
    v_per_day_cents := ROUND((v_pricing_item.amount_usd * 100) / v_pricing_item.included_days);
    v_guide_fee_cents := v_selected_days * v_per_day_cents;
  ELSE
    -- Fixed fee (no included_days) - use full item amount
    v_guide_fee_cents := ROUND(v_pricing_item.amount_usd * 100);
  END IF;
  
  -- Update contract with calculated guide fee
  UPDATE hunt_contracts
  SET calculated_guide_fee_cents = v_guide_fee_cents
  WHERE id = p_contract_id;
  
  RETURN v_guide_fee_cents;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PART 7: CREATE FUNCTION TO RECALCULATE CONTRACT TOTAL
-- ============================================
-- Recalculates total including guide fee + add-ons + platform fee

CREATE OR REPLACE FUNCTION recalculate_contract_total(
  p_contract_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_contract RECORD;
  v_guide_fee_cents INTEGER := 0;
  v_addons_cents INTEGER := 0;
  v_platform_fee_cents INTEGER := 0;
  v_total_cents INTEGER := 0;
  v_addon_data JSONB;
BEGIN
  -- Get contract
  SELECT 
    id,
    calculated_guide_fee_cents,
    calculated_addons_cents,
    client_completion_data
  INTO v_contract
  FROM hunt_contracts
  WHERE id = p_contract_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contract not found: %', p_contract_id;
  END IF;
  
  -- Recalculate guide fee if dates are set
  IF v_contract.client_completion_data IS NOT NULL THEN
    v_guide_fee_cents := calculate_contract_guide_fee(p_contract_id);
  ELSE
    v_guide_fee_cents := COALESCE(v_contract.calculated_guide_fee_cents, 0);
  END IF;
  
  -- Calculate add-ons from client_completion_data
  -- This will be calculated in the API layer based on pricing_items
  -- For now, use stored value or calculate from completion_data
  v_addons_cents := COALESCE(v_contract.calculated_addons_cents, 0);
  
  -- Platform fee: 5% of subtotal (guide fee + add-ons)
  v_platform_fee_cents := ROUND((v_guide_fee_cents + v_addons_cents) * 0.05);
  
  -- Total
  v_total_cents := v_guide_fee_cents + v_addons_cents + v_platform_fee_cents;
  
  -- Update contract
  UPDATE hunt_contracts
  SET 
    calculated_guide_fee_cents = v_guide_fee_cents,
    contract_total_cents = v_total_cents,
    updated_at = NOW()
  WHERE id = p_contract_id;
  
  RETURN v_total_cents;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PART 8: CREATE AUTO-LOCK FUNCTION
-- ============================================
-- Locks contract when signed or payment is made

CREATE OR REPLACE FUNCTION auto_lock_contract()
RETURNS TRIGGER AS $$
BEGIN
  -- Lock if signed or payment made
  IF (NEW.client_signed_at IS NOT NULL 
      OR NEW.admin_signed_at IS NOT NULL 
      OR NEW.amount_paid_cents > 0) THEN
    NEW.is_locked := true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_lock_contract
  BEFORE UPDATE ON hunt_contracts
  FOR EACH ROW
  EXECUTE FUNCTION auto_lock_contract();

-- ============================================
-- PART 9: ADD COMMENT
-- ============================================

COMMENT ON COLUMN hunt_contracts.client_selected_start_date IS 'Client-selected start date (within hunt window)';
COMMENT ON COLUMN hunt_contracts.client_selected_end_date IS 'Client-selected end date (within hunt window)';
COMMENT ON COLUMN hunt_contracts.selected_pricing_item_id IS 'Pricing item selected by client (from pricing tab)';
COMMENT ON COLUMN hunt_contracts.calculated_guide_fee_cents IS 'Guide fee calculated from selected_days × pricing_item per-day rate';
COMMENT ON COLUMN hunt_contracts.calculated_addons_cents IS 'Total add-ons amount in cents';
COMMENT ON COLUMN hunt_contracts.is_locked IS 'True when contract is signed or payment made - prevents date/add-on changes';

-- ============================================
-- DONE!
-- ============================================
