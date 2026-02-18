# In-App Signing System (No DocuSign)

Replaces DocuSign with a minimal-but-legally-strong signing flow.

## Phase 1 — Data Model ✅

**Migration 080** adds:
- `contract_id` on hunt_contracts (HC-YYYY-NNNNNN)
- `contract_versions` — immutable PDF snapshots (hash, path, version #)
- `signature_events` — append-only audit ledger
- `econsent_versions` — consent text for audit
- Storage bucket `contract-documents` (create in Dashboard)

## Phase 2 — "Ready to Sign" Snapshot

1. Admin approves contract → status `ready_to_sign`
2. Generate PDF from template + completion data
3. Compute SHA-256, store in contract_versions
4. Path: `{outfitter_id}/{contract_id}/v1_unsigned.pdf`
5. Log: `version_created`, `version_hash_recorded`

## Phase 3 — Consent + Review

1. **Consent screen** — "I agree to electronic signatures..."
2. Require checkbox, log `econsent_given`
3. **Review screen** — show PDF, require "I have reviewed"
4. Log `version_viewed`

## Phase 4 — Signing Flow

1. Capture: typed legal name, confirm email
2. Log `signed` with ip, user_agent, typed_name
3. Generate certificate page (1-page PDF)
4. Append to signed PDF, store as `v1_signed.pdf`
5. Log `version_locked`

## Phase 5 — Locking + Delivery

1. Set version status → `signed_locked`
2. Update hunt_contracts: `client_signed_at`, `signed_document_path`
3. Email signed PDF + certificate to client
4. Log `signed_copy_emailed`

## Phase 6 — Multi-Party (Future)

- signers list per version
- track each signer's consent/signature
- `fully_executed` when all signed

## Phase 7 — Admin Audit View

- Event timeline per contract
- Download signed copy + certificate
- Export audit packet (PDF + JSON)

## API Endpoints (to build)

| Endpoint | Purpose |
|----------|---------|
| POST `/api/hunt-contracts/[id]/finalize-version` | Admin: generate PDF snapshot |
| GET `/api/hunt-contracts/[id]/signing/consent` | Get consent text |
| POST `/api/hunt-contracts/[id]/signing/consent` | Log consent |
| GET `/api/hunt-contracts/[id]/signing/preview` | Get PDF for review |
| POST `/api/hunt-contracts/[id]/signing/sign` | Submit signature |
| GET `/api/hunt-contracts/[id]/audit` | Admin: full audit trail |
