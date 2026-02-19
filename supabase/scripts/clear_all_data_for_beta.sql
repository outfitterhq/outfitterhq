-- =============================================================================
-- CLEAR ALL DATA FOR BETA — DESTRUCTIVE, IRREVERSIBLE
-- =============================================================================
--
-- This script wipes all outfitter, client, hunt, contract, picture, and payment
-- data so you can start fresh for beta testing. Auth users (auth.users) are
-- NOT deleted; they can log in again and re-create outfitters / link memberships.
--
-- HOW TO RUN:
--   1. Run only against the environment you want to reset (e.g. beta/staging).
--   2. Take a backup/snapshot first (Supabase Dashboard, Database, Backups).
--   3. Open Supabase Dashboard, SQL Editor, paste this script, and run it.
--   4. Or run from shell: psql $DATABASE_URL -f clear_all_data_for_beta.sql
--
-- AFTER RUNNING:
--   * All rows in clients, outfitters, and every table that references them
--     will be removed (hunts, contracts, photos, payments, etc.).
--   * Storage buckets listed below will have all objects deleted.
--   * Auth users remain; they can sign in and onboard again for beta.
--
-- =============================================================================

-- Step 1: Truncate clients and all tables that reference clients (CASCADE).
-- This clears: clients, client_outfitter_links, payment_items, documents
-- (client_id), conversations, client_questionnaires, client_predraw_submissions,
-- client_payments, camp_client_assignments, and any other client-FK tables.
TRUNCATE clients CASCADE;

-- Step 2: Truncate outfitters and all tables that reference outfitters (CASCADE).
-- This clears: outfitters, outfitter_memberships, calendar_events, hunt_contracts,
-- contract_versions, signature_events, contract_templates, pricing_items,
-- documents, notifications, hunt_closeouts, hunt_photos, lodges, lodge_photos,
-- camps, cook_profiles, guides, guide_time_off, guide_documents,
-- outfitter_stripe_accounts, outfitter_codes, private_land_tags, etc.
TRUNCATE outfitters CASCADE;

-- Step 3 (optional): Clear storage bucket objects via Dashboard or Storage API.
-- Supabase does not allow direct DELETE FROM storage.objects. To remove files:
--   Supabase Dashboard -> Storage -> open each bucket (hunt-photos, lodge-photos,
--   contract-documents, outfitter-documents, guide-documents) -> select all -> Delete.
-- Or use the Storage API from your app/script (e.g. listObjects + remove).
