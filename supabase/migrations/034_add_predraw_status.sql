-- Migration: Add status field to client_predraw_submissions
-- Allows admins to mark applications as completed and move them out of the queue

-- Add status column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'client_predraw_submissions' 
    AND column_name = 'submission_status'
  ) THEN
    ALTER TABLE client_predraw_submissions 
    ADD COLUMN submission_status TEXT DEFAULT 'pending' 
    CHECK (submission_status IN ('pending', 'completed', 'submitted'));
    
    -- Create index for filtering
    CREATE INDEX IF NOT EXISTS idx_predraw_submission_status 
    ON client_predraw_submissions(submission_status) 
    WHERE submission_status IS NOT NULL;
  END IF;
END $$;

-- Add completed_at timestamp
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'client_predraw_submissions' 
    AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE client_predraw_submissions 
    ADD COLUMN completed_at TIMESTAMPTZ;
  END IF;
END $$;

COMMENT ON COLUMN client_predraw_submissions.submission_status IS 'Status of the draw application submission: pending (in queue), completed (admin marked as done), submitted (actually submitted to NMDGF)';
COMMENT ON COLUMN client_predraw_submissions.completed_at IS 'Timestamp when admin marked this application as completed';
