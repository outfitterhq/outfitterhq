-- Migration: Contract Review Queue
-- Adds pending_admin_review status and admin review tracking

-- Add new status to hunt_contracts
ALTER TABLE hunt_contracts 
DROP CONSTRAINT IF EXISTS hunt_contracts_status_check;

ALTER TABLE hunt_contracts 
ADD CONSTRAINT hunt_contracts_status_check 
CHECK (status IN (
  'draft',
  'pending_client_completion', 
  'pending_admin_review',  -- NEW: Client has submitted, awaiting admin review
  'ready_for_signature',
  'sent_to_docusign',
  'client_signed',
  'fully_executed',
  'cancelled'
));

-- Add admin review tracking fields
ALTER TABLE hunt_contracts
ADD COLUMN IF NOT EXISTS admin_reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS admin_reviewed_by TEXT,
ADD COLUMN IF NOT EXISTS admin_review_notes TEXT;

-- Create index for efficient querying of pending reviews
CREATE INDEX IF NOT EXISTS idx_hunt_contracts_pending_review 
ON hunt_contracts(outfitter_id, status) 
WHERE status = 'pending_admin_review';

COMMENT ON COLUMN hunt_contracts.status IS 'Contract status: draft, pending_client_completion, pending_admin_review, ready_for_signature, sent_to_docusign, client_signed, fully_executed, cancelled';
COMMENT ON COLUMN hunt_contracts.admin_reviewed_at IS 'Timestamp when admin reviewed the contract';
COMMENT ON COLUMN hunt_contracts.admin_reviewed_by IS 'Email or username of admin who reviewed';
COMMENT ON COLUMN hunt_contracts.admin_review_notes IS 'Optional notes from admin during review';
