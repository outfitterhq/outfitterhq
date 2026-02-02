-- Migration: Per-outfitter waiver PDF (Liability waiver document)
-- Each outfitter can upload their own waiver PDF; clients view it and sign via DocuSign.
--
-- Storage bucket "outfitter-documents" must be created in Supabase Dashboard:
-- 1. Storage → New bucket → Name: outfitter-documents
-- 2. Private (recommended). RLS or service role will be used for signed URLs.
-- Path format: {outfitter_id}/waiver.pdf

ALTER TABLE outfitters
  ADD COLUMN IF NOT EXISTS waiver_document_path TEXT;

COMMENT ON COLUMN outfitters.waiver_document_path IS 'Storage path for waiver PDF in bucket outfitter-documents (e.g. {outfitter_id}/waiver.pdf). Clients see this PDF before signing via DocuSign.';
