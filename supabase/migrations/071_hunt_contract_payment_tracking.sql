-- ============================================
-- HUNT CONTRACT PAYMENT TRACKING SYSTEM
-- ============================================
-- Implements per-contract payment tracking:
-- - Each hunt contract tracks its own payments separately
-- - Payment status: Unpaid, Deposit Paid, Payment Plan Active, Paid in Full
-- - Support for full payment, deposits, and payment plans
-- - Admin and client can both view payment progress

-- ============================================
-- 1. ADD PAYMENT TRACKING FIELDS TO HUNT_CONTRACTS
-- ============================================

-- Add payment tracking columns to hunt_contracts
ALTER TABLE hunt_contracts 
ADD COLUMN IF NOT EXISTS contract_total_cents INTEGER DEFAULT 0;

ALTER TABLE hunt_contracts 
ADD COLUMN IF NOT EXISTS amount_paid_cents INTEGER DEFAULT 0;

ALTER TABLE hunt_contracts 
ADD COLUMN IF NOT EXISTS remaining_balance_cents INTEGER DEFAULT 0;

ALTER TABLE hunt_contracts 
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid'
  CHECK (payment_status IN ('unpaid', 'deposit_paid', 'payment_plan_active', 'paid_in_full', 'overpaid'));

-- Add index for payment status queries
CREATE INDEX IF NOT EXISTS idx_hunt_contracts_payment_status ON hunt_contracts(payment_status);
CREATE INDEX IF NOT EXISTS idx_hunt_contracts_payment_amounts ON hunt_contracts(contract_total_cents, amount_paid_cents);

-- ============================================
-- 2. PAYMENT PLANS TABLE
-- ============================================
-- Tracks payment plans for contracts (e.g., 3 payments over 3 months)

CREATE TABLE IF NOT EXISTS contract_payment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES hunt_contracts(id) ON DELETE CASCADE,
  outfitter_id UUID NOT NULL REFERENCES outfitters(id) ON DELETE CASCADE,
  
  -- Plan details
  plan_name TEXT, -- e.g., "3-Payment Plan", "Monthly Installments"
  total_amount_cents INTEGER NOT NULL, -- Total amount covered by this plan
  number_of_payments INTEGER NOT NULL DEFAULT 1,
  
  -- Status
  status TEXT DEFAULT 'active' 
    CHECK (status IN ('active', 'completed', 'cancelled')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payment_plans_contract ON contract_payment_plans(contract_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_outfitter ON contract_payment_plans(outfitter_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_status ON contract_payment_plans(status);

-- Ensure one active plan per contract (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_plans_one_active_per_contract 
  ON contract_payment_plans(contract_id) 
  WHERE status = 'active';

-- ============================================
-- 3. SCHEDULED PAYMENTS TABLE
-- ============================================
-- Individual scheduled payments within a payment plan

CREATE TABLE IF NOT EXISTS contract_scheduled_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_plan_id UUID NOT NULL REFERENCES contract_payment_plans(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES hunt_contracts(id) ON DELETE CASCADE,
  outfitter_id UUID NOT NULL REFERENCES outfitters(id) ON DELETE CASCADE,
  
  -- Payment details
  payment_number INTEGER NOT NULL, -- 1, 2, 3, etc.
  amount_cents INTEGER NOT NULL,
  due_date DATE NOT NULL,
  
  -- Status
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  
  -- Payment tracking
  paid_amount_cents INTEGER DEFAULT 0,
  paid_at TIMESTAMPTZ,
  payment_item_id UUID REFERENCES payment_items(id) ON DELETE SET NULL, -- Links to actual payment
  
  -- Notes
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_payments_plan ON contract_scheduled_payments(payment_plan_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_payments_contract ON contract_scheduled_payments(contract_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_payments_due_date ON contract_scheduled_payments(due_date);
CREATE INDEX IF NOT EXISTS idx_scheduled_payments_status ON contract_scheduled_payments(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_payments_outfitter ON contract_scheduled_payments(outfitter_id);

-- ============================================
-- 4. UPDATE PAYMENT_ITEMS TO LINK TO CONTRACTS
-- ============================================
-- Ensure payment_items.contract_id properly links to hunt_contracts

-- Add index if not exists
CREATE INDEX IF NOT EXISTS idx_payment_items_contract ON payment_items(contract_id) WHERE contract_id IS NOT NULL;

-- ============================================
-- 5. FUNCTIONS FOR PAYMENT TRACKING
-- ============================================

-- Function to calculate and update contract payment totals
CREATE OR REPLACE FUNCTION update_contract_payment_totals(p_contract_id UUID)
RETURNS void AS $$
DECLARE
  v_total_paid INTEGER;
  v_contract_total INTEGER;
  v_remaining INTEGER;
  v_new_status TEXT;
BEGIN
  -- Get total paid from payment_items linked to this contract
  SELECT COALESCE(SUM(amount_paid_cents), 0)
  INTO v_total_paid
  FROM payment_items
  WHERE contract_id = p_contract_id
    AND status IN ('paid', 'partially_paid');
  
  -- Get contract total
  SELECT contract_total_cents
  INTO v_contract_total
  FROM hunt_contracts
  WHERE id = p_contract_id;
  
  -- Calculate remaining
  v_remaining := GREATEST(0, COALESCE(v_contract_total, 0) - COALESCE(v_total_paid, 0));
  
  -- Determine payment status
  IF v_contract_total IS NULL OR v_contract_total = 0 THEN
    v_new_status := 'unpaid';
  ELSIF v_total_paid >= v_contract_total THEN
    v_new_status := 'paid_in_full';
  ELSIF EXISTS (
    SELECT 1 FROM contract_payment_plans 
    WHERE contract_id = p_contract_id 
    AND status = 'active'
  ) THEN
    -- Check if there's a deposit paid
    IF v_total_paid > 0 THEN
      v_new_status := 'payment_plan_active';
    ELSE
      v_new_status := 'unpaid';
    END IF;
  ELSIF v_total_paid > 0 THEN
    v_new_status := 'deposit_paid';
  ELSE
    v_new_status := 'unpaid';
  END IF;
  
  -- Update contract
  UPDATE hunt_contracts
  SET 
    amount_paid_cents = v_total_paid,
    remaining_balance_cents = v_remaining,
    payment_status = v_new_status,
    updated_at = NOW()
  WHERE id = p_contract_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create a payment plan for a contract
CREATE OR REPLACE FUNCTION create_contract_payment_plan(
  p_contract_id UUID,
  p_total_amount_cents INTEGER,
  p_payments JSONB, -- Array of {payment_number, amount_cents, due_date}
  p_plan_name TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_plan_id UUID;
  v_outfitter_id UUID;
  v_payment JSONB;
  v_payment_count INTEGER;
BEGIN
  -- Get outfitter_id from contract
  SELECT outfitter_id INTO v_outfitter_id
  FROM hunt_contracts
  WHERE id = p_contract_id;
  
  IF v_outfitter_id IS NULL THEN
    RAISE EXCEPTION 'Contract not found';
  END IF;
  
  -- Cancel any existing active plans
  UPDATE contract_payment_plans
  SET status = 'cancelled', updated_at = NOW()
  WHERE contract_id = p_contract_id AND status = 'active';
  
  -- Count payments
  v_payment_count := jsonb_array_length(p_payments);
  
  -- Create payment plan
  INSERT INTO contract_payment_plans (
    contract_id,
    outfitter_id,
    plan_name,
    total_amount_cents,
    number_of_payments
  ) VALUES (
    p_contract_id,
    v_outfitter_id,
    COALESCE(p_plan_name, v_payment_count || '-Payment Plan'),
    p_total_amount_cents,
    v_payment_count
  ) RETURNING id INTO v_plan_id;
  
  -- Create scheduled payments
  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    INSERT INTO contract_scheduled_payments (
      payment_plan_id,
      contract_id,
      outfitter_id,
      payment_number,
      amount_cents,
      due_date
    ) VALUES (
      v_plan_id,
      p_contract_id,
      v_outfitter_id,
      (v_payment->>'payment_number')::INTEGER,
      (v_payment->>'amount_cents')::INTEGER,
      (v_payment->>'due_date')::DATE
    );
  END LOOP;
  
  -- Update contract payment status
  PERFORM update_contract_payment_totals(p_contract_id);
  
  RETURN v_plan_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record a payment against a contract
CREATE OR REPLACE FUNCTION record_contract_payment(
  p_contract_id UUID,
  p_amount_cents INTEGER,
  p_payment_item_id UUID DEFAULT NULL,
  p_scheduled_payment_id UUID DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_payment_item_id UUID;
BEGIN
  -- If payment_item_id provided, use it; otherwise create one
  IF p_payment_item_id IS NULL THEN
    -- Get client and outfitter from contract
    SELECT 
      c.id,
      hc.outfitter_id
    INTO v_payment_item_id, v_payment_item_id
    FROM hunt_contracts hc
    JOIN clients c ON LOWER(c.email) = LOWER(hc.client_email)
    WHERE hc.id = p_contract_id
    LIMIT 1;
    
    -- Create payment item (simplified - you may want to enhance this)
    -- For now, we'll assume payment_item_id is provided or already exists
  ELSE
    v_payment_item_id := p_payment_item_id;
  END IF;
  
  -- Update scheduled payment if provided
  IF p_scheduled_payment_id IS NOT NULL THEN
    UPDATE contract_scheduled_payments
    SET 
      status = 'paid',
      paid_amount_cents = p_amount_cents,
      paid_at = NOW(),
      payment_item_id = v_payment_item_id,
      updated_at = NOW()
    WHERE id = p_scheduled_payment_id;
  END IF;
  
  -- Update contract totals
  PERFORM update_contract_payment_totals(p_contract_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. TRIGGERS TO AUTO-UPDATE CONTRACT TOTALS
-- ============================================

-- Trigger: Update contract totals when payment_items change
CREATE OR REPLACE FUNCTION trigger_update_contract_from_payment_item()
RETURNS TRIGGER AS $$
BEGIN
  -- Update contract totals when payment item is created/updated
  IF NEW.contract_id IS NOT NULL THEN
    PERFORM update_contract_payment_totals(NEW.contract_id);
  END IF;
  
  -- Also handle old contract_id if it changed
  IF OLD.contract_id IS NOT NULL AND (OLD.contract_id IS DISTINCT FROM NEW.contract_id) THEN
    PERFORM update_contract_payment_totals(OLD.contract_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_contract_from_payment_item ON payment_items;
CREATE TRIGGER update_contract_from_payment_item
  AFTER INSERT OR UPDATE OF amount_paid_cents, status, contract_id ON payment_items
  FOR EACH ROW
  WHEN (NEW.contract_id IS NOT NULL)
  EXECUTE FUNCTION trigger_update_contract_from_payment_item();

-- ============================================
-- 7. VIEWS FOR EASY QUERYING
-- ============================================

-- View: Contract payment summary
CREATE OR REPLACE VIEW contract_payment_summary AS
SELECT 
  hc.id AS contract_id,
  hc.outfitter_id,
  hc.hunt_id,
  hc.client_email,
  hc.client_name,
  hc.status AS contract_status,
  hc.payment_status,
  hc.contract_total_cents,
  hc.amount_paid_cents,
  hc.remaining_balance_cents,
  ROUND(hc.contract_total_cents / 100.0, 2) AS contract_total_usd,
  ROUND(hc.amount_paid_cents / 100.0, 2) AS amount_paid_usd,
  ROUND(hc.remaining_balance_cents / 100.0, 2) AS remaining_balance_usd,
  CASE 
    WHEN hc.contract_total_cents > 0 THEN 
      ROUND((hc.amount_paid_cents::DECIMAL / hc.contract_total_cents::DECIMAL) * 100, 1)
    ELSE 0
  END AS payment_percentage,
  hc.created_at AS contract_created_at,
  hc.updated_at AS contract_updated_at
FROM hunt_contracts hc;

-- View: Scheduled payments with status
CREATE OR REPLACE VIEW contract_scheduled_payments_view AS
SELECT 
  csp.id,
  csp.contract_id,
  csp.payment_plan_id,
  cpp.plan_name,
  csp.payment_number,
  csp.amount_cents,
  ROUND(csp.amount_cents / 100.0, 2) AS amount_usd,
  csp.due_date,
  csp.status,
  csp.paid_amount_cents,
  ROUND(csp.paid_amount_cents / 100.0, 2) AS paid_amount_usd,
  csp.paid_at,
  CASE 
    WHEN csp.status = 'paid' THEN 'Paid'
    WHEN csp.due_date < CURRENT_DATE AND csp.status != 'paid' THEN 'Overdue'
    WHEN csp.due_date >= CURRENT_DATE AND csp.status = 'pending' THEN 'Upcoming'
    ELSE INITCAP(csp.status)
  END AS status_label,
  csp.created_at,
  csp.updated_at
FROM contract_scheduled_payments csp
JOIN contract_payment_plans cpp ON cpp.id = csp.payment_plan_id;

-- ============================================
-- 8. RLS POLICIES
-- ============================================

ALTER TABLE contract_payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_scheduled_payments ENABLE ROW LEVEL SECURITY;

-- Payment plans: Admins can manage, clients can view their own
CREATE POLICY "Admins can manage payment plans"
  ON contract_payment_plans
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM outfitter_memberships
      WHERE outfitter_memberships.outfitter_id = contract_payment_plans.outfitter_id
        AND outfitter_memberships.user_id = auth.uid()
        AND outfitter_memberships.status = 'active'
        AND outfitter_memberships.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Clients can view own payment plans"
  ON contract_payment_plans
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM hunt_contracts hc
      WHERE hc.id = contract_payment_plans.contract_id
        AND LOWER(hc.client_email) = LOWER(auth.jwt() ->> 'email')
    )
  );

-- Scheduled payments: Same pattern
CREATE POLICY "Admins can manage scheduled payments"
  ON contract_scheduled_payments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM outfitter_memberships
      WHERE outfitter_memberships.outfitter_id = contract_scheduled_payments.outfitter_id
        AND outfitter_memberships.user_id = auth.uid()
        AND outfitter_memberships.status = 'active'
        AND outfitter_memberships.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Clients can view own scheduled payments"
  ON contract_scheduled_payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM hunt_contracts hc
      WHERE hc.id = contract_scheduled_payments.contract_id
        AND LOWER(hc.client_email) = LOWER(auth.jwt() ->> 'email')
    )
  );

-- ============================================
-- 9. UPDATED_AT TRIGGERS
-- ============================================

CREATE TRIGGER contract_payment_plans_updated_at
  BEFORE UPDATE ON contract_payment_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER contract_scheduled_payments_updated_at
  BEFORE UPDATE ON contract_scheduled_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 10. COMMENTS
-- ============================================

COMMENT ON TABLE contract_payment_plans IS 'Payment plans for hunt contracts. Each contract can have one active plan at a time.';
COMMENT ON TABLE contract_scheduled_payments IS 'Individual scheduled payments within a payment plan. Tracks due dates and payment status.';
COMMENT ON COLUMN hunt_contracts.contract_total_cents IS 'Total contract amount in cents. Set when contract is finalized.';
COMMENT ON COLUMN hunt_contracts.amount_paid_cents IS 'Total amount paid so far (sum of all payment_items for this contract).';
COMMENT ON COLUMN hunt_contracts.remaining_balance_cents IS 'Calculated: contract_total_cents - amount_paid_cents.';
COMMENT ON COLUMN hunt_contracts.payment_status IS 'Payment status: unpaid, deposit_paid, payment_plan_active, paid_in_full, overpaid.';
COMMENT ON VIEW contract_payment_summary IS 'Summary view of contract payment status with USD amounts and percentages.';
COMMENT ON VIEW contract_scheduled_payments_view IS 'Scheduled payments with human-readable status labels and USD amounts.';
