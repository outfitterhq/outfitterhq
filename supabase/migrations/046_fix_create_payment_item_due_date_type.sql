-- Fix 1: create_deposit_for_contract() passes CURRENT_DATE + INTERVAL '7 days'
-- which returns timestamp; create_payment_item() expects p_due_date DATE. Cast to DATE.
-- Fix 2: clients.outfitter_id can be NULL (links are in client_outfitter_links).
-- Use NEW.outfitter_id from the hunt_contract row so payment_items.outfitter_id is never null.

CREATE OR REPLACE FUNCTION create_deposit_for_contract()
RETURNS TRIGGER AS $$
DECLARE
  v_client_id UUID;
  v_outfitter_id UUID;
  v_deposit_amount INTEGER;
  v_species TEXT;
BEGIN
  SELECT id INTO v_client_id
  FROM clients
  WHERE LOWER(email) = LOWER(NEW.client_email)
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Outfitter from the contract (always set); do not rely on clients.outfitter_id (can be null)
  v_outfitter_id := NEW.outfitter_id;
  IF v_outfitter_id IS NULL AND NEW.hunt_id IS NOT NULL THEN
    SELECT outfitter_id INTO v_outfitter_id
    FROM calendar_events
    WHERE id = NEW.hunt_id
    LIMIT 1;
  END IF;
  IF v_outfitter_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT species INTO v_species
  FROM calendar_events
  WHERE id = NEW.hunt_id;

  v_deposit_amount := 50000;

  PERFORM create_payment_item(
    v_outfitter_id,
    v_client_id,
    'hunt_deposit',
    COALESCE(v_species, 'Hunt') || ' Deposit - ' || TO_CHAR(NOW(), 'YYYY'),
    v_deposit_amount,
    NEW.hunt_id,
    NEW.id,
    (CURRENT_DATE + INTERVAL '7 days')::DATE
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
