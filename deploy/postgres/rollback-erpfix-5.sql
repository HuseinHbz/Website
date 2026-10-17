-- ERPFIX-5 — subledger/GL completeness: rollback script. Safe to re-run.
-- Usage: psql "$DATABASE_URL" -f deploy/postgres/rollback-erpfix-5.sql
--
-- NOTE: this does NOT delete any gl_journal_entries this phase posted
-- (service/fixed-asset invoices, purchase credit notes, depreciation runs)
-- — those are real, balanced, posted financial history and must be
-- reversed through reverseEntry, never deleted. This script only removes
-- the NEW schema objects this phase added, so a fresh re-migration starts
-- clean; it does not undo already-posted accounting data.
BEGIN;
DROP TABLE IF EXISTS asset_depreciation_postings CASCADE;
ALTER TABLE purchase_document_lines DROP COLUMN IF EXISTS line_class;
DELETE FROM erp_settings WHERE key IN ('gl_map_cash','gl_map_service_expense','gl_map_fixed_assets','gl_map_acc_depreciation','gl_map_depreciation_expense');
-- The 6300/1590 gl_accounts rows are left in place even on rollback — once
-- an account code has been used on ANY posted gl_journal_line, deleting it
-- would orphan real financial history (ERPFIX-1 discipline: never mutate
-- posted data). Deactivate it manually instead if truly unused:
--   UPDATE gl_accounts SET active=0 WHERE code IN ('6300','1590');
COMMIT;
