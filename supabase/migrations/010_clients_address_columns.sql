-- Add address columns to clients table (if they don't exist)
-- These are needed for client signup from the iOS app

DO $$
BEGIN
  -- Add address_line1 if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'clients' AND column_name = 'address_line1'
  ) THEN
    ALTER TABLE clients ADD COLUMN address_line1 TEXT;
  END IF;

  -- Add city if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'clients' AND column_name = 'city'
  ) THEN
    ALTER TABLE clients ADD COLUMN city TEXT;
  END IF;

  -- Add state if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'clients' AND column_name = 'state'
  ) THEN
    ALTER TABLE clients ADD COLUMN state TEXT;
  END IF;

  -- Add postal_code if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'clients' AND column_name = 'postal_code'
  ) THEN
    ALTER TABLE clients ADD COLUMN postal_code TEXT;
  END IF;
END $$;
