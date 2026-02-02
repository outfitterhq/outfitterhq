-- Migration: Default Contract Templates for Outfitters
-- Auto-creates generic templates when outfitters sign up
-- Outfitters can customize these or create their own

-- =============================================================================
-- 1. FUNCTION: Create default templates for new outfitter
-- =============================================================================

CREATE OR REPLACE FUNCTION create_default_templates_for_outfitter(p_outfitter_id UUID)
RETURNS void AS $$
DECLARE
  v_hunt_contract_id UUID;
  v_waiver_id UUID;
  v_pre_draw_id UUID;
BEGIN
  -- Only create if outfitter doesn't already have templates
  IF EXISTS (SELECT 1 FROM contract_templates WHERE outfitter_id = p_outfitter_id) THEN
    RETURN;
  END IF;

  -- 1. Default Hunt Contract Template
  INSERT INTO contract_templates (
    outfitter_id,
    name,
    description,
    content,
    template_type,
    is_active
  ) VALUES (
    p_outfitter_id,
    'Default Hunt Contract',
    'Generic hunt contract template. Customize as needed.',
    '# Hunt Contract Agreement

**Client:** {{client_name}}
**Email:** {{client_email}}

## Hunt Details

- **Hunt:** {{hunt_title}}
- **Species:** {{species}}
- **Unit:** {{unit}}
- **Weapon:** {{weapon}}
- **Dates:** {{start_date}} - {{end_date}}
- **Camp:** {{camp_name}}

## Terms and Conditions

1. **Deposit:** A non-refundable deposit is required to secure your hunt dates.

2. **Balance:** Full balance is due 60 days prior to hunt start date.

3. **Cancellation:** In the event of cancellation:
   - More than 90 days out: Deposit may be applied to future hunt
   - 60-90 days out: 50% refund of balance paid
   - Less than 60 days: No refund

4. **Weather/Conditions:** Hunts are conducted regardless of weather conditions. No refunds for weather-related issues.

5. **Tag/License:** Client is responsible for obtaining all required tags and licenses.

6. **Liability:** Client agrees to hold harmless the outfitter and guides from any liability.

## Acknowledgment

By signing below, I acknowledge that I have read, understand, and agree to all terms and conditions outlined in this contract.

**Client Signature:** _________________________ **Date:** _____________

**Outfitter Representative:** _________________________ **Date:** _____________',
    'hunt_contract',
    true
  ) RETURNING id INTO v_hunt_contract_id;

  -- 2. Default Waiver Template
  INSERT INTO contract_templates (
    outfitter_id,
    name,
    description,
    content,
    template_type,
    is_active
  ) VALUES (
    p_outfitter_id,
    'Default Waiver of Liability',
    'Generic liability waiver template. Customize as needed.',
    '# WAIVER OF LIABILITY AND ASSUMPTION OF RISK

**Client:** {{client_name}}
**Email:** {{client_email}}

I, the undersigned participant, in consideration of being allowed to participate in hunting and outdoor activities with {{outfitter_name}}, hereby agree as follows:

## 1. ASSUMPTION OF RISK

I understand that hunting and outdoor activities involve inherent risks including but not limited to: adverse weather conditions, rough terrain, wildlife encounters, firearm use, vehicle accidents, and other hazards. I voluntarily assume all such risks.

## 2. RELEASE OF LIABILITY

I hereby release, waive, and discharge {{outfitter_name}}, its owners, employees, guides, and agents from any and all liability, claims, demands, or causes of action arising out of my participation in these activities.

## 3. INDEMNIFICATION

I agree to indemnify and hold harmless {{outfitter_name}} from any claims made by third parties arising from my participation.

## 4. MEDICAL AUTHORIZATION

I authorize {{outfitter_name}} to obtain emergency medical treatment for me if necessary.

## 5. ACKNOWLEDGMENT

I have read this waiver, understand its contents, and sign it voluntarily.

**Client Signature:** _________________________ **Date:** _____________',
    'waiver',
    true
  ) RETURNING id INTO v_waiver_id;

  -- 3. Default Pre-Draw Agreement Template
  INSERT INTO contract_templates (
    outfitter_id,
    name,
    description,
    content,
    template_type,
    is_active
  ) VALUES (
    p_outfitter_id,
    'Default Pre-Draw Agreement',
    'Generic pre-draw application agreement template. Customize as needed.',
    '# Pre-Draw Application Agreement

**Client:** {{client_name}}
**Email:** {{client_email}}

## Agreement Terms

By signing this agreement, I authorize {{outfitter_name}} to submit draw applications on my behalf to the New Mexico Department of Game and Fish (NMDGF).

### Terms and Conditions:

1. **Application Submission:** I understand that {{outfitter_name}} will submit draw applications based on my species selections and preferences.

2. **Payment Authorization:** I authorize {{outfitter_name}} to charge my credit card for application fees and license purchases as required by NMDGF.

3. **Information Accuracy:** I certify that all information provided is accurate and complete.

4. **Results:** I understand that draw results are determined by NMDGF and are not guaranteed.

5. **Refund Policy:** Application fees are non-refundable regardless of draw outcome.

**Client Signature:** _________________________ **Date:** _____________',
    'pre_draw_agreement',
    true
  ) RETURNING id INTO v_pre_draw_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 2. TRIGGER: Auto-create templates when outfitter is created
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_create_default_templates()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_default_templates_for_outfitter(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS create_templates_on_outfitter_insert ON outfitters;
CREATE TRIGGER create_templates_on_outfitter_insert
  AFTER INSERT ON outfitters
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_default_templates();

-- =============================================================================
-- 3. Backfill: Create templates for existing outfitters
-- =============================================================================

DO $$
DECLARE
  v_outfitter_id UUID;
BEGIN
  FOR v_outfitter_id IN SELECT id FROM outfitters LOOP
    PERFORM create_default_templates_for_outfitter(v_outfitter_id);
  END LOOP;
END $$;

-- =============================================================================
-- 4. ADD PLACEHOLDERS TO CONTRACT_PLACEHOLDERS
-- =============================================================================
-- Note: These are already in the TypeScript file, but documenting here:
-- {{outfitter_name}} - Outfitter business name
-- {{outfitter_phone}} - Outfitter contact phone
-- {{outfitter_email}} - Outfitter contact email

-- =============================================================================
-- DONE
-- =============================================================================
-- Every outfitter now has default generic templates they can customize
-- Templates are created automatically on signup
-- Existing outfitters get templates backfilled
