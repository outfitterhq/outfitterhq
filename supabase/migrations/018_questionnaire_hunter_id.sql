-- Migration: Add hunter_id to client_questionnaires
-- This allows matching questionnaire responses to draw results

ALTER TABLE client_questionnaires
ADD COLUMN IF NOT EXISTS hunter_id TEXT;

CREATE INDEX IF NOT EXISTS idx_client_questionnaires_hunter_id 
ON client_questionnaires(hunter_id) WHERE hunter_id IS NOT NULL;

-- Also sync hunter_id from questionnaire to clients table when submitted
CREATE OR REPLACE FUNCTION sync_hunter_id_to_client()
RETURNS TRIGGER AS $$
BEGIN
  -- If hunter_id is provided in questionnaire, update the client record
  IF NEW.hunter_id IS NOT NULL AND NEW.hunter_id != '' THEN
    UPDATE clients 
    SET hunter_id = NEW.hunter_id
    WHERE id = NEW.client_id
      AND (hunter_id IS NULL OR hunter_id = '');
  END IF;
  
  -- Also sync DOB if provided
  IF NEW.dob IS NOT NULL THEN
    UPDATE clients 
    SET date_of_birth = NEW.dob::date
    WHERE id = NEW.client_id
      AND date_of_birth IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_hunter_id ON client_questionnaires;

CREATE TRIGGER trigger_sync_hunter_id
  AFTER INSERT OR UPDATE ON client_questionnaires
  FOR EACH ROW
  EXECUTE FUNCTION sync_hunter_id_to_client();

-- Done!
