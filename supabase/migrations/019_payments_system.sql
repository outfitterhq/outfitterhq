-- ============================================
-- PAYMENTS SYSTEM WITH 5% PLATFORM FEE
-- ============================================
-- Handles all payments: deposits, hunt fees, tag purchases
-- Takes 5% platform fee ("handling & storage fee") from each transaction

-- ============================================
-- 0. HELPER FUNCTION (if not exists)
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 1. OUTFITTER STRIPE CONNECTION
-- ============================================
-- Store Stripe Connect account info for each outfitter
-- Using Stripe Connect so payments go directly to outfitter, we take our cut

CREATE TABLE IF NOT EXISTS outfitter_stripe_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outfitter_id UUID NOT NULL REFERENCES outfitters(id) ON DELETE CASCADE,
  
  -- Stripe Connect account
  stripe_account_id TEXT NOT NULL,  -- acct_xxx
  stripe_account_status TEXT DEFAULT 'pending',  -- 'pending', 'active', 'restricted', 'disabled'
  
  -- Onboarding status
  charges_enabled BOOLEAN DEFAULT false,
  payouts_enabled BOOLEAN DEFAULT false,
  details_submitted BOOLEAN DEFAULT false,
  
  -- Account info from Stripe
  business_type TEXT,  -- 'individual', 'company'
  country TEXT DEFAULT 'US',
  default_currency TEXT DEFAULT 'usd',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(outfitter_id),
  UNIQUE(stripe_account_id)
);

-- ============================================
-- 2. PAYMENT ITEMS / INVOICES
-- ============================================
-- What clients owe - can be hunt deposit, full payment, tag fee, etc.

CREATE TABLE IF NOT EXISTS payment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outfitter_id UUID NOT NULL REFERENCES outfitters(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  
  -- What this payment is for
  item_type TEXT NOT NULL,  -- 'hunt_deposit', 'hunt_balance', 'tag_purchase', 'gear_rental', 'other'
  description TEXT NOT NULL,
  
  -- Related entities (optional)
  hunt_id UUID REFERENCES calendar_events(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES hunt_contracts(id) ON DELETE SET NULL,
  tag_id UUID,  -- private_land_tags reference
  
  -- Amounts (all in cents to avoid floating point issues)
  subtotal_cents INTEGER NOT NULL,  -- Base amount
  platform_fee_cents INTEGER NOT NULL,  -- Our 5% fee
  total_cents INTEGER NOT NULL,  -- What client pays (subtotal + platform fee)
  
  -- Status
  status TEXT DEFAULT 'pending',  -- 'pending', 'paid', 'partially_paid', 'refunded', 'cancelled'
  
  -- Payment tracking
  amount_paid_cents INTEGER DEFAULT 0,
  paid_at TIMESTAMPTZ,
  
  -- Due date (optional)
  due_date DATE,
  
  -- Notes
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_items_client ON payment_items(client_id);
CREATE INDEX idx_payment_items_outfitter ON payment_items(outfitter_id);
CREATE INDEX idx_payment_items_status ON payment_items(status);
CREATE INDEX idx_payment_items_hunt ON payment_items(hunt_id);

-- ============================================
-- 3. PAYMENT TRANSACTIONS
-- ============================================
-- Actual payments made (via Stripe)

CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_item_id UUID NOT NULL REFERENCES payment_items(id) ON DELETE CASCADE,
  outfitter_id UUID NOT NULL REFERENCES outfitters(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  
  -- Stripe info
  stripe_payment_intent_id TEXT,  -- pi_xxx
  stripe_charge_id TEXT,  -- ch_xxx
  stripe_transfer_id TEXT,  -- tr_xxx (transfer to outfitter)
  
  -- Amounts (in cents)
  amount_cents INTEGER NOT NULL,  -- Total charged to client
  platform_fee_cents INTEGER NOT NULL,  -- Our 5%
  outfitter_amount_cents INTEGER NOT NULL,  -- What outfitter receives
  
  -- Stripe fees (for reference)
  stripe_fee_cents INTEGER,  -- ~2.9% + $0.30
  
  -- Status
  status TEXT DEFAULT 'pending',  -- 'pending', 'succeeded', 'failed', 'refunded'
  failure_reason TEXT,
  
  -- Payment method
  payment_method_type TEXT,  -- 'card', 'us_bank_account'
  payment_method_last4 TEXT,  -- Last 4 digits
  payment_method_brand TEXT,  -- 'visa', 'mastercard', etc.
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_transactions_payment_item ON payment_transactions(payment_item_id);
CREATE INDEX idx_transactions_stripe_pi ON payment_transactions(stripe_payment_intent_id);
CREATE INDEX idx_transactions_outfitter ON payment_transactions(outfitter_id);
CREATE INDEX idx_transactions_client ON payment_transactions(client_id);

-- ============================================
-- 4. REFUNDS
-- ============================================

CREATE TABLE IF NOT EXISTS payment_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES payment_transactions(id) ON DELETE CASCADE,
  
  -- Stripe info
  stripe_refund_id TEXT,  -- re_xxx
  
  -- Amounts
  amount_cents INTEGER NOT NULL,
  platform_fee_refund_cents INTEGER NOT NULL,  -- Our fee refunded
  outfitter_refund_cents INTEGER NOT NULL,  -- Outfitter's portion refunded
  
  -- Status
  status TEXT DEFAULT 'pending',  -- 'pending', 'succeeded', 'failed'
  reason TEXT,  -- 'requested_by_customer', 'duplicate', 'fraudulent'
  
  -- Who initiated
  initiated_by UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================
-- 5. PLATFORM FEE CONFIGURATION
-- ============================================
-- Allows adjusting the platform fee without code changes

CREATE TABLE IF NOT EXISTS platform_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Set the 5% platform fee
INSERT INTO platform_config (key, value, description) VALUES
('platform_fee_percentage', '5.0', 'Platform fee percentage charged on all transactions'),
('platform_fee_name', '"Handling & Storage Fee"', 'Display name for the platform fee'),
('min_platform_fee_cents', '50', 'Minimum platform fee in cents ($0.50)'),
('stripe_enabled', 'true', 'Whether Stripe payments are enabled');

-- ============================================
-- 6. HELPER FUNCTIONS
-- ============================================

-- Calculate platform fee
CREATE OR REPLACE FUNCTION calculate_platform_fee(subtotal_cents INTEGER)
RETURNS INTEGER AS $$
DECLARE
  fee_percentage DECIMAL;
  min_fee INTEGER;
  calculated_fee INTEGER;
BEGIN
  -- Get fee percentage from config
  SELECT (value::TEXT)::DECIMAL INTO fee_percentage
  FROM platform_config WHERE key = 'platform_fee_percentage';
  
  -- Get minimum fee
  SELECT (value::TEXT)::INTEGER INTO min_fee
  FROM platform_config WHERE key = 'min_platform_fee_cents';
  
  -- Calculate fee
  calculated_fee := CEIL(subtotal_cents * (COALESCE(fee_percentage, 5.0) / 100));
  
  -- Apply minimum
  RETURN GREATEST(calculated_fee, COALESCE(min_fee, 50));
END;
$$ LANGUAGE plpgsql;

-- Create payment item with auto-calculated fee
CREATE OR REPLACE FUNCTION create_payment_item(
  p_outfitter_id UUID,
  p_client_id UUID,
  p_item_type TEXT,
  p_description TEXT,
  p_subtotal_cents INTEGER,
  p_hunt_id UUID DEFAULT NULL,
  p_contract_id UUID DEFAULT NULL,
  p_due_date DATE DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_platform_fee INTEGER;
  v_item_id UUID;
BEGIN
  -- Calculate platform fee
  v_platform_fee := calculate_platform_fee(p_subtotal_cents);
  
  -- Insert payment item
  INSERT INTO payment_items (
    outfitter_id, client_id, item_type, description,
    subtotal_cents, platform_fee_cents, total_cents,
    hunt_id, contract_id, due_date
  ) VALUES (
    p_outfitter_id, p_client_id, p_item_type, p_description,
    p_subtotal_cents, v_platform_fee, p_subtotal_cents + v_platform_fee,
    p_hunt_id, p_contract_id, p_due_date
  ) RETURNING id INTO v_item_id;
  
  RETURN v_item_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. AUTO-CREATE PAYMENT ITEMS FOR HUNTS
-- ============================================

-- When a hunt contract is created, auto-create deposit payment item
CREATE OR REPLACE FUNCTION create_deposit_for_contract()
RETURNS TRIGGER AS $$
DECLARE
  v_client_id UUID;
  v_outfitter_id UUID;
  v_deposit_amount INTEGER;
  v_species TEXT;
BEGIN
  -- Get client info
  SELECT id, outfitter_id INTO v_client_id, v_outfitter_id
  FROM clients
  WHERE LOWER(email) = LOWER(NEW.client_email)
  LIMIT 1;
  
  IF v_client_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get hunt info for description
  SELECT species INTO v_species
  FROM calendar_events
  WHERE id = NEW.hunt_id;
  
  -- Default deposit: $500 (50000 cents) - could be made configurable per outfitter
  v_deposit_amount := 50000;
  
  -- Create deposit payment item
  PERFORM create_payment_item(
    v_outfitter_id,
    v_client_id,
    'hunt_deposit',
    COALESCE(v_species, 'Hunt') || ' Deposit - ' || TO_CHAR(NOW(), 'YYYY'),
    v_deposit_amount,
    NEW.hunt_id,
    NEW.id,
    CURRENT_DATE + INTERVAL '7 days'  -- Due in 7 days
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Create deposit when contract is created
DROP TRIGGER IF EXISTS create_deposit_on_contract ON hunt_contracts;
CREATE TRIGGER create_deposit_on_contract
  AFTER INSERT ON hunt_contracts
  FOR EACH ROW
  EXECUTE FUNCTION create_deposit_for_contract();

-- ============================================
-- 8. RLS POLICIES
-- ============================================

ALTER TABLE outfitter_stripe_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_refunds ENABLE ROW LEVEL SECURITY;

-- Stripe accounts: Outfitter admins only
CREATE POLICY "Admins can view own outfitter stripe account"
  ON outfitter_stripe_accounts FOR SELECT
  USING (
    outfitter_id IN (
      SELECT om.outfitter_id FROM outfitter_memberships om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );

-- Payment items: Clients see their own, admins see all for outfitter
CREATE POLICY "Clients can view own payment items"
  ON payment_items FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM clients WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email')
    )
  );

CREATE POLICY "Admins can view outfitter payment items"
  ON payment_items FOR SELECT
  USING (
    outfitter_id IN (
      SELECT om.outfitter_id FROM outfitter_memberships om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin', 'guide')
    )
  );

CREATE POLICY "Admins can create payment items"
  ON payment_items FOR INSERT
  WITH CHECK (
    outfitter_id IN (
      SELECT om.outfitter_id FROM outfitter_memberships om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update payment items"
  ON payment_items FOR UPDATE
  USING (
    outfitter_id IN (
      SELECT om.outfitter_id FROM outfitter_memberships om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );

-- Transactions: Same pattern
CREATE POLICY "Clients can view own transactions"
  ON payment_transactions FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM clients WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email')
    )
  );

CREATE POLICY "Admins can view outfitter transactions"
  ON payment_transactions FOR SELECT
  USING (
    outfitter_id IN (
      SELECT om.outfitter_id FROM outfitter_memberships om
      WHERE om.user_id = auth.uid()
    )
  );

-- Refunds: Admins only
CREATE POLICY "Admins can view refunds"
  ON payment_refunds FOR SELECT
  USING (
    transaction_id IN (
      SELECT id FROM payment_transactions WHERE outfitter_id IN (
        SELECT om.outfitter_id FROM outfitter_memberships om
        WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
      )
    )
  );

-- ============================================
-- 9. UPDATED_AT TRIGGERS
-- ============================================

CREATE TRIGGER update_outfitter_stripe_accounts_updated_at
  BEFORE UPDATE ON outfitter_stripe_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_items_updated_at
  BEFORE UPDATE ON payment_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
