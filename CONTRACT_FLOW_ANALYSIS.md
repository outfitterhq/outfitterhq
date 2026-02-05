# Hunt Contract Flow Analysis & Redesign Plan

## Current Implementation vs. Redesigned Flow

### ✅ What's Already Working

1. **One Hunt = One Contract** ✅
   - Unique constraint on `hunt_id` in `hunt_contracts` table
   - Application-level checks prevent duplicates

2. **Payment Tracking** ✅
   - Per-contract payment tracking implemented
   - Payment status, totals, and balances tracked
   - Payment plans and scheduled payments supported

3. **Contract Structure** ✅
   - Contracts linked to hunts via `hunt_id`
   - `client_completion_data` JSONB field stores selected pricing, dates, add-ons

### ❌ Critical Gaps to Address

#### 1. **Auto-Contract Generation** ❌
**Current:** Contracts only auto-generated for `private_land` hunts when `tag_status = 'confirmed'`
**Required:** Contracts should auto-generate when ANY hunt is created (draw, OTC, private)

**Impact:** High - This is the foundation of the flow

**Solution:**
- Create trigger/function to auto-generate contract when:
  - Hunt is created with `client_email`
  - OR when hunt gets a tag (draw result, private land purchase, OTC tag)
- Ensure idempotency (check for existing contract first)

---

#### 2. **Guide Fee Based on Selected Days** ❌
**Current:** Guide fee comes from `pricing_items` (fixed packages like "5-Day Hunt $8000")
**Required:** Guide fee should be calculated as: `selected_days × per_day_rate`

**Impact:** High - This affects pricing accuracy and revenue

**Current Flow:**
- Client selects dates in `complete-booking`
- Dates stored in `calendar_events.start_time` and `end_time`
- Guide fee comes from `selected_pricing_item_id` (fixed package)

**Required Flow:**
- Client selects dates (e.g., Sept 10-17 = 7 days)
- System calculates: `7 days × $X/day = guide fee`
- Guide fee stored in contract, not just in pricing item

**Solution:**
- Add `client_selected_start_date` and `client_selected_end_date` to `hunt_contracts`
- Add `guide_fee_per_day_cents` to `hunt_contracts` or calculate from pricing
- Calculate guide fee: `(end_date - start_date + 1) × per_day_rate`
- Store calculated `guide_fee_cents` in contract

---

#### 3. **Add-ons Stored in Contract** ⚠️
**Current:** Add-ons stored in `calendar_events.client_addon_data`, copied to `hunt_contracts.client_completion_data`
**Required:** Add-ons should live in the contract as the source of truth

**Impact:** Medium - Currently works but not ideal architecture

**Solution:**
- Keep add-ons in `client_completion_data` (already doing this)
- Ensure contract is the authoritative source
- Remove dependency on `calendar_events.client_addon_data` for contract calculations

---

#### 4. **Continuous Contract Total Recalculation** ❌
**Current:** Contract total calculated when contract is generated/updated, stored in `contract_total_cents`
**Required:** Total should recalculate automatically when:
  - Client selects/changes dates
  - Client adds/removes add-ons
  - Guide fee per day changes

**Impact:** High - Ensures contract always shows accurate total

**Current Calculation:**
- Guide fee from `selected_pricing_item_id`
- Add-ons from `client_completion_data`
- Total stored in `contract_total_cents`

**Required Calculation:**
- Guide fee = `selected_days × per_day_rate`
- Add-ons = sum of all add-on items
- Total = guide fee + add-ons + platform fees
- Recalculate on every date/add-on change

**Solution:**
- Create SQL function `recalculate_contract_total(contract_id)`
- Call this function:
  - After dates are selected/changed
  - After add-ons are added/removed
  - When contract is viewed (if total is 0 or stale)
- Update `contract_total_cents` automatically

---

#### 5. **Contract Locking Mechanism** ❌
**Current:** No explicit locking - contract can be modified even after signed
**Required:** Once contract is signed OR payment is made, lock it:
  - Dates cannot be changed
  - Add-ons cannot be changed
  - Guide fee cannot be recalculated

**Impact:** High - Prevents contract corruption and ensures payment accuracy

**Solution:**
- Add `is_locked` boolean to `hunt_contracts`
- Set `is_locked = true` when:
  - `client_signed_at IS NOT NULL` OR
  - `admin_signed_at IS NOT NULL` OR
  - `amount_paid_cents > 0`
- Prevent updates to `client_completion_data` when locked
- Add check in API routes to prevent modifications

---

#### 6. **Hunt Window vs Client Dates** ⚠️
**Current:** `hunt_window_start/end` on hunt, `start_time/end_time` for client dates
**Required:** Clear separation:
  - Hunt window = valid date range (e.g., Sept 1-30)
  - Client dates = selected dates within window (e.g., Sept 10-17)

**Impact:** Medium - Currently works but could be clearer

**Solution:**
- Keep `hunt_window_start/end` on `calendar_events` (hunt level)
- Store `client_selected_start_date/end_date` in `hunt_contracts` (contract level)
- Validate client dates are within hunt window
- Use client dates for guide fee calculation

---

## Database Schema Changes Needed

### 1. Add columns to `hunt_contracts`:
```sql
ALTER TABLE hunt_contracts
ADD COLUMN IF NOT EXISTS client_selected_start_date DATE,
ADD COLUMN IF NOT EXISTS client_selected_end_date DATE,
ADD COLUMN IF NOT EXISTS guide_fee_per_day_cents INTEGER,
ADD COLUMN IF NOT EXISTS calculated_guide_fee_cents INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;
```

### 2. Create function to recalculate contract total:
```sql
CREATE OR REPLACE FUNCTION recalculate_contract_total(p_contract_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_guide_fee_cents INTEGER := 0;
  v_addon_total_cents INTEGER := 0;
  v_platform_fee_cents INTEGER := 0;
  v_total_cents INTEGER := 0;
  v_days INTEGER;
  v_per_day_cents INTEGER;
BEGIN
  -- Get contract details
  SELECT 
    calculated_guide_fee_cents,
    guide_fee_per_day_cents,
    client_selected_start_date,
    client_selected_end_date,
    client_completion_data
  INTO 
    v_guide_fee_cents,
    v_per_day_cents,
    ...
  FROM hunt_contracts
  WHERE id = p_contract_id;
  
  -- Calculate days if dates are set
  IF client_selected_start_date IS NOT NULL AND client_selected_end_date IS NOT NULL THEN
    v_days := client_selected_end_date - client_selected_start_date + 1;
    IF v_per_day_cents IS NOT NULL THEN
      v_guide_fee_cents := v_days * v_per_day_cents;
    END IF;
  END IF;
  
  -- Calculate add-ons from client_completion_data
  -- ... (sum up extra_days, extra_non_hunters, etc.)
  
  -- Calculate platform fee (5% of subtotal)
  v_platform_fee_cents := (v_guide_fee_cents + v_addon_total_cents) * 0.05;
  
  -- Total
  v_total_cents := v_guide_fee_cents + v_addon_total_cents + v_platform_fee_cents;
  
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
```

### 3. Create trigger to auto-lock contract:
```sql
CREATE OR REPLACE FUNCTION auto_lock_contract()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.client_signed_at IS NOT NULL OR NEW.admin_signed_at IS NOT NULL OR NEW.amount_paid_cents > 0) THEN
    NEW.is_locked := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_lock_contract
  BEFORE UPDATE ON hunt_contracts
  FOR EACH ROW
  EXECUTE FUNCTION auto_lock_contract();
```

### 4. Update auto-generation trigger to work for ALL hunt types:
```sql
-- Modify generate_hunt_contract_after_insert() to work for:
-- - private_land hunts (when tag_status = 'confirmed')
-- - draw hunts (when tag_status = 'drawn')
-- - OTC hunts (when tag_status = 'confirmed')
```

---

## API Changes Needed

### 1. `/api/client/complete-booking` (POST)
- Store `client_selected_start_date` and `client_selected_end_date` in contract
- Calculate guide fee based on days × per_day_rate
- Call `recalculate_contract_total()` after saving
- Check `is_locked` before allowing updates

### 2. `/api/client/hunt-contract` (GET)
- Return `client_selected_start_date/end_date` from contract
- Return `hunt_window_start/end` from hunt
- Show calculated guide fee
- Show contract total (recalculate if needed)

### 3. Contract generation functions
- Auto-generate contract for ALL hunt types (not just private_land)
- Set initial `guide_fee_per_day_cents` from pricing items
- Initialize `contract_total_cents` to 0 (will be calculated when dates selected)

---

## Implementation Priority

### Phase 1: Foundation (Critical)
1. ✅ Auto-generate contracts for all hunt types
2. ✅ Add contract locking mechanism
3. ✅ Store client selected dates in contract

### Phase 2: Pricing Accuracy (High Priority)
4. ✅ Calculate guide fee based on selected days
5. ✅ Implement continuous total recalculation
6. ✅ Move add-ons to contract as source of truth

### Phase 3: Polish (Medium Priority)
7. ✅ Clear separation of hunt window vs client dates
8. ✅ Validation that client dates are within hunt window
9. ✅ UI updates to show calculated totals in real-time

---

## Migration Strategy

1. **Add new columns** to `hunt_contracts` (nullable initially)
2. **Backfill data** from existing `client_completion_data` and `calendar_events`
3. **Update contract generation** to populate new fields
4. **Update API routes** to use new fields and calculations
5. **Add locking logic** to prevent modifications
6. **Test thoroughly** with existing contracts

---

## Questions to Resolve

1. **Guide fee per day source:**
   - Should it come from a pricing item (e.g., "Guide Fee - $500/day")?
   - Or should it be a fixed rate per outfitter?
   - Or should it vary by hunt type/species?

2. **Contract locking granularity:**
   - Lock entire contract (dates + add-ons)?
   - Or allow add-ons to be added after dates are locked?

3. **Auto-generation timing:**
   - Generate immediately when hunt is created?
   - Or wait until hunt has a tag (drawn/confirmed)?

4. **Existing contracts:**
   - How to handle contracts that already have dates/add-ons?
   - Migrate data to new structure?
   - Recalculate totals?

---

## Next Steps

1. Review this analysis with stakeholders
2. Resolve questions above
3. Create detailed migration plan
4. Implement Phase 1 changes
5. Test with real data
6. Deploy incrementally
