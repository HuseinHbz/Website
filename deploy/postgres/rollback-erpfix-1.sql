-- ERPFIX-1 — GL core invariants: rollback script. Safe to re-run.
-- Usage: psql "$DATABASE_URL" -f deploy/postgres/rollback-erpfix-1.sql
--
-- ⚠ Run this ONLY together with a code rollback to the commit before ERPFIX-1.
--   runMigrations() executes on every boot, so with the ERPFIX-1 code still
--   deployed every object below is simply recreated at the next start.
--
-- What is NOT rolled back, deliberately:
--   • Journal entries posted under ERPFIX-1 (including any corrective entry
--     booked by deploy/erp-remediate-salary-account.ts --apply). A posted entry
--     is never deleted (CLAUDE.md rule 11) — correct it with a reversal.
--   • erp_settings.gl_map_payroll_expense stays at 6000. Pointing salaries back
--     at 6100 «Rent Expense» would reintroduce BUG-ERP-10; change it by hand only
--     if the accountant explicitly decides so.
--   • The numbering_formats rows (gl_opening/gl_year_end/gl_intercompany/
--     gl_revaluation) and their counters: harmless to the old code, and deleting
--     them would let a re-deploy re-issue numbers already printed on entries.
BEGIN;

-- Deferred balance invariant
DROP TRIGGER IF EXISTS trg_gl_lines_balanced ON gl_journal_lines;
DROP TRIGGER IF EXISTS trg_gl_entries_balanced ON gl_journal_entries;
DROP FUNCTION IF EXISTS gl_assert_entry_balanced();
DROP FUNCTION IF EXISTS gl_check_entry_balance(INTEGER);

-- Line-amount CHECK
ALTER TABLE gl_journal_lines DROP CONSTRAINT IF EXISTS chk_gl_lines_amounts;

-- entry_no uniqueness + year-end idempotency index
DROP INDEX IF EXISTS idx_gl_entries_entry_no_unique;
DROP INDEX IF EXISTS idx_gl_entries_entry_no;
DROP INDEX IF EXISTS idx_gl_entries_year_end_once;

-- Strict-period setting (old code ignores it; removed for a clean state)
DELETE FROM erp_settings WHERE key = 'gl_require_period';

-- Remediation trail. Kept if any corrective entry exists, because it is the
-- only record of which source entries a corrective entry covers.
DO $rb$
BEGIN
  IF to_regclass('public.gl_remediation_links') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM gl_remediation_links) THEN
      DROP TABLE gl_remediation_links;
    ELSE
      RAISE NOTICE 'gl_remediation_links kept: it records corrective entries that exist';
    END IF;
  END IF;
END
$rb$;

COMMIT;
