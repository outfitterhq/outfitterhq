-- Add unique constraint on cook_profiles for outfitter_id + contact_email
-- This allows upserting cook profiles by email when inviting

DO $$ 
BEGIN
  -- Check if constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'cook_profiles_outfitter_email_unique'
  ) THEN
    ALTER TABLE cook_profiles
    ADD CONSTRAINT cook_profiles_outfitter_email_unique 
    UNIQUE (outfitter_id, contact_email);
  END IF;
END $$;

COMMENT ON CONSTRAINT cook_profiles_outfitter_email_unique ON cook_profiles IS 
'Ensures one cook profile per email per outfitter, allowing upsert by email';
