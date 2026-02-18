-- Add client_signed_at to client_predraw_submissions for in-app signing
ALTER TABLE client_predraw_submissions
  ADD COLUMN IF NOT EXISTS client_signed_at TIMESTAMPTZ;

COMMENT ON COLUMN client_predraw_submissions.client_signed_at IS 'When client signed the pre-draw contract in-app (typed name). Used for unified signing flow.';
