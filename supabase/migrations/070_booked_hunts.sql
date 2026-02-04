-- Create booked_hunts table to snapshot hunt data when status becomes "Booked"
-- This ensures data doesn't change if guides/clients update their profiles later

CREATE TABLE IF NOT EXISTS booked_hunts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_event_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  outfitter_id UUID NOT NULL REFERENCES outfitters(id) ON DELETE CASCADE,
  
  -- Hunt header fields (snapshot from calendar_events)
  hunt_start_date TIMESTAMPTZ NOT NULL,
  hunt_end_date TIMESTAMPTZ NOT NULL,
  unit TEXT,
  species TEXT,
  weapon TEXT,
  status TEXT NOT NULL,
  camp_name TEXT,
  
  -- Client info (snapshot at booking time)
  client_email TEXT NOT NULL,
  client_name TEXT,
  client_address TEXT,
  client_phone TEXT,
  
  -- Guide info (snapshot at booking time)
  guide_username TEXT,
  guide_name TEXT,
  guide_address TEXT,
  guide_vehicle TEXT, -- Full vehicle description (year make model color)
  guide_plate TEXT, -- License plate
  guide_card_number TEXT, -- Guide card number if available
  
  -- Financial snapshot
  guide_fee_usd NUMERIC, -- Guide fee only (excludes private land tag cost)
  selected_pricing_item_id UUID REFERENCES pricing_items(id) ON DELETE SET NULL,
  
  -- Metadata
  booked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one booked_hunt per calendar_event
  UNIQUE(calendar_event_id)
);

-- Create indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_booked_hunts_outfitter ON booked_hunts(outfitter_id);
CREATE INDEX IF NOT EXISTS idx_booked_hunts_dates ON booked_hunts(hunt_start_date, hunt_end_date);
CREATE INDEX IF NOT EXISTS idx_booked_hunts_unit ON booked_hunts(unit) WHERE unit IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_booked_hunts_species ON booked_hunts(species) WHERE species IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_booked_hunts_weapon ON booked_hunts(weapon) WHERE weapon IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_booked_hunts_status ON booked_hunts(status);
CREATE INDEX IF NOT EXISTS idx_booked_hunts_client_email ON booked_hunts(client_email);
CREATE INDEX IF NOT EXISTS idx_booked_hunts_guide_username ON booked_hunts(guide_username) WHERE guide_username IS NOT NULL;

-- Enable RLS
ALTER TABLE booked_hunts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view booked hunts for their outfitters
CREATE POLICY "Users can view booked hunts for their outfitters"
  ON booked_hunts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM outfitter_memberships
      WHERE outfitter_memberships.outfitter_id = booked_hunts.outfitter_id
        AND outfitter_memberships.user_id = auth.uid()
        AND outfitter_memberships.status = 'active'
    )
  );

-- RLS Policy: Only owners/admins can manage booked hunts (though typically auto-created)
CREATE POLICY "Owners and admins can manage booked hunts"
  ON booked_hunts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM outfitter_memberships
      WHERE outfitter_memberships.outfitter_id = booked_hunts.outfitter_id
        AND outfitter_memberships.user_id = auth.uid()
        AND outfitter_memberships.status = 'active'
        AND outfitter_memberships.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM outfitter_memberships
      WHERE outfitter_memberships.outfitter_id = booked_hunts.outfitter_id
        AND outfitter_memberships.user_id = auth.uid()
        AND outfitter_memberships.status = 'active'
        AND outfitter_memberships.role IN ('owner', 'admin')
    )
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_booked_hunts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER booked_hunts_updated_at
  BEFORE UPDATE ON booked_hunts
  FOR EACH ROW
  EXECUTE FUNCTION update_booked_hunts_updated_at();

-- Function to create booked_hunt record when calendar_event status becomes "Booked"
CREATE OR REPLACE FUNCTION create_booked_hunt_on_booking()
RETURNS TRIGGER AS $$
DECLARE
  v_client_name TEXT;
  v_client_address TEXT;
  v_client_phone TEXT;
  v_guide_name TEXT;
  v_guide_address TEXT;
  v_guide_vehicle TEXT;
  v_guide_plate TEXT;
  v_guide_card_number TEXT;
  v_guide_fee NUMERIC;
  v_client_record RECORD;
  v_guide_record RECORD;
  v_pricing_record RECORD;
BEGIN
  -- Only create booked_hunt if status is "Booked" or "Confirmed"
  IF NEW.status NOT IN ('Booked', 'Confirmed') THEN
    RETURN NEW;
  END IF;
  
  -- Skip if booked_hunt already exists for this calendar_event
  IF EXISTS (SELECT 1 FROM booked_hunts WHERE calendar_event_id = NEW.id) THEN
    RETURN NEW;
  END IF;
  
  -- Get client info (snapshot)
  IF NEW.client_email IS NOT NULL THEN
    SELECT 
      COALESCE(first_name || ' ' || last_name, email, '') as name,
      COALESCE(
        address_line1 || 
        CASE WHEN city IS NOT NULL THEN ', ' || city ELSE '' END ||
        CASE WHEN state IS NOT NULL THEN ', ' || state ELSE '' END ||
        CASE WHEN postal_code IS NOT NULL THEN ' ' || postal_code ELSE '' END,
        ''
      ) as address,
      phone
    INTO v_client_record
    FROM clients
    WHERE LOWER(email) = LOWER(NEW.client_email)
      AND outfitter_id = NEW.outfitter_id
    LIMIT 1;
    
    IF FOUND THEN
      v_client_name := v_client_record.name;
      v_client_address := v_client_record.address;
      v_client_phone := v_client_record.phone;
    END IF;
  END IF;
  
  -- Get guide info (snapshot)
  IF NEW.guide_username IS NOT NULL THEN
    SELECT 
      g.id,
      g.name,
      g.user_id,
      COALESCE(
        g.vehicle_year || ' ' || g.vehicle_make || ' ' || g.vehicle_model || 
        CASE WHEN g.vehicle_color IS NOT NULL THEN ' ' || g.vehicle_color ELSE '' END,
        ''
      ) as vehicle,
      g.vehicle_plate,
      '' as card_number -- Guide card number not in guides table yet, can be added later
    INTO v_guide_record
    FROM guides g
    WHERE (LOWER(g.email) = LOWER(NEW.guide_username) OR LOWER(g.username) = LOWER(NEW.guide_username))
      AND g.outfitter_id = NEW.outfitter_id
    LIMIT 1;
    
    IF FOUND THEN
      v_guide_name := v_guide_record.name;
      v_guide_vehicle := v_guide_record.vehicle;
      v_guide_plate := v_guide_record.vehicle_plate;
      v_guide_card_number := v_guide_record.card_number;
      
      -- Try to get guide address from profiles table if it exists
      IF v_guide_record.user_id IS NOT NULL THEN
        SELECT 
          COALESCE(
            address_line1 || 
            CASE WHEN city IS NOT NULL THEN ', ' || city ELSE '' END ||
            CASE WHEN state IS NOT NULL THEN ', ' || state ELSE '' END ||
            CASE WHEN zip IS NOT NULL THEN ' ' || zip ELSE '' END,
            ''
          ) as address
        INTO v_guide_address
        FROM profiles
        WHERE id = v_guide_record.user_id
        LIMIT 1;
      END IF;
    END IF;
  END IF;
  
  -- Get guide fee from pricing_items (only if category is "Guide Fee" or similar)
  IF NEW.selected_pricing_item_id IS NOT NULL THEN
    SELECT amount_usd
    INTO v_guide_fee
    FROM pricing_items
    WHERE id = NEW.selected_pricing_item_id
      AND (category ILIKE '%guide%' OR category ILIKE '%hunt%')
    LIMIT 1;
  END IF;
  
  -- Insert booked_hunt record
  INSERT INTO booked_hunts (
    calendar_event_id,
    outfitter_id,
    hunt_start_date,
    hunt_end_date,
    unit,
    species,
    weapon,
    status,
    camp_name,
    client_email,
    client_name,
    client_address,
    client_phone,
    guide_username,
    guide_name,
    guide_address,
    guide_vehicle,
    guide_plate,
    guide_card_number,
    guide_fee_usd,
    selected_pricing_item_id,
    booked_at
  ) VALUES (
    NEW.id,
    NEW.outfitter_id,
    COALESCE(NEW.start_time, NEW.start_date),
    COALESCE(NEW.end_time, NEW.end_date),
    NEW.unit,
    NEW.species,
    NEW.weapon,
    NEW.status,
    NEW.camp_name,
    NEW.client_email,
    v_client_name,
    v_client_address,
    v_client_phone,
    NEW.guide_username,
    v_guide_name,
    v_guide_address,
    v_guide_vehicle,
    v_guide_plate,
    v_guide_card_number,
    v_guide_fee,
    NEW.selected_pricing_item_id,
    NOW()
  )
  ON CONFLICT (calendar_event_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-create booked_hunt when status becomes "Booked" or "Confirmed"
CREATE TRIGGER trigger_create_booked_hunt_on_booking
  AFTER INSERT OR UPDATE OF status ON calendar_events
  FOR EACH ROW
  WHEN (NEW.status IN ('Booked', 'Confirmed'))
  EXECUTE FUNCTION create_booked_hunt_on_booking();

COMMENT ON TABLE booked_hunts IS 'Snapshots of booked hunts with all relevant data at booking time. Auto-created when calendar_event status becomes "Booked" or "Confirmed".';
COMMENT ON COLUMN booked_hunts.guide_fee_usd IS 'Guide fee only - explicitly excludes private land tag purchases';
