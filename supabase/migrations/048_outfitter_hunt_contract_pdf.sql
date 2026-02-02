-- Per-outfitter hunt contract PDF (optional upload)
-- When set, this PDF can be used for DocuSign instead of template content.
-- Storage: outfitter-documents/{outfitter_id}/hunt-contract.pdf

ALTER TABLE outfitters
  ADD COLUMN IF NOT EXISTS hunt_contract_document_path TEXT;

COMMENT ON COLUMN outfitters.hunt_contract_document_path IS 'Optional storage path for hunt contract PDF in bucket outfitter-documents (e.g. {outfitter_id}/hunt-contract.pdf). If set, used for DocuSign; otherwise template content is used.';