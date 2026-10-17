-- ERPFIX-7 — standard financial statements + VAT structure: rollback script.
-- Safe to re-run. Usage: psql "$DATABASE_URL" -f deploy/postgres/rollback-erpfix-7.sql
--
-- NOTE: this does NOT undo any posted GL entries (year-end closings, VAT
-- settlements) already created with this phase's code — those are real
-- ledger history and must be reversed through the normal reversal
-- mechanism, never deleted. This script only removes the NEW schema
-- objects this phase added.
BEGIN;
ALTER TABLE gl_accounts DROP COLUMN IF EXISTS classification;
ALTER TABLE gl_accounts DROP COLUMN IF EXISTS cash_flow_category;
ALTER TABLE gl_accounts DROP COLUMN IF EXISTS classification_verified;
DROP TABLE IF EXISTS vat_settlements;
DROP TABLE IF EXISTS tax_rates;
DELETE FROM erp_settings WHERE key IN ('gl_map_vat_output', 'gl_map_vat_input');
-- The 2160 "VAT Settlement Payable" account is left in place even on
-- rollback if it has ever been posted to (a real account with real history
-- must never be deleted); it is only removed here when it was never used.
DELETE FROM gl_accounts WHERE code = '2160' AND NOT EXISTS (
  SELECT 1 FROM gl_journal_lines l JOIN gl_accounts a ON a.id = l.account_id WHERE a.code = '2160'
);
COMMIT;
