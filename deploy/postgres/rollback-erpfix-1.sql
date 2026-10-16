-- ERPFIX-1 — GL core: rollback script.
-- Drops ONLY the DB-level objects this phase added — the trigger, the
-- CHECK constraint, and the two new unique indexes. Does NOT touch any
-- column, table, or row data (none were added by this phase — only
-- behavior/code changed, plus the two gl_require_period/gl_map_payroll_*
-- erp_settings rows, left in place since they are harmless config).
-- Safe to re-run.
-- Usage: psql "$DATABASE_URL" -f deploy/postgres/rollback-erpfix-1.sql
BEGIN;

DROP TRIGGER IF EXISTS trg_erpfix1_gl_entry_balance ON gl_journal_entries;
DROP FUNCTION IF EXISTS erpfix1_check_gl_entry_balance();

ALTER TABLE gl_journal_lines DROP CONSTRAINT IF EXISTS gl_journal_lines_sign_check;

DROP INDEX IF EXISTS uq_gl_entries_entryno_company;
DROP INDEX IF EXISTS uq_gl_yearend_close_ref;

COMMIT;

-- NOT rolled back (config, not schema — reverting these is a separate,
-- explicit decision, not part of an emergency rollback):
--   erp_settings.gl_require_period
--   erp_settings.gl_map_payroll_expense (and the other gl_map_payroll_* keys)
--   numbering_formats 'opening_balance' / 'year_end_closing' rows
