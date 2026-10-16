-- ERPFIX-2 — base-currency GL lines: rollback script. Safe to re-run.
-- Usage: psql "$DATABASE_URL" -f deploy/postgres/rollback-erpfix-2.sql
--
-- ⚠ Run this ONLY together with a code rollback to the commit before ERPFIX-2
--   (runMigrations() re-adds the columns on every boot).
--
-- Deliberately NOT rolled back:
--   • Journal entries posted under ERPFIX-2 (base-currency lines, realized FX
--     lines on 4900/6980, Treasury FX true-ups, restatements booked by
--     deploy/erp-fx-remediate.ts --apply). A posted entry is never deleted
--     (CLAUDE.md rule 11) — correct it with a reversal.
--   • fx_amount / fx_currency are DROPPED only when no posted line uses them:
--     once base-currency entries exist, the foreign amount on the line is the
--     only record of what was invoiced in USD/EUR.
BEGIN;
DO $rb2$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='gl_journal_lines' AND column_name='fx_amount') THEN
    IF NOT EXISTS (SELECT 1 FROM gl_journal_lines WHERE fx_amount IS NOT NULL) THEN
      ALTER TABLE gl_journal_lines DROP COLUMN fx_amount;
      ALTER TABLE gl_journal_lines DROP COLUMN IF EXISTS fx_currency;
    ELSE
      RAISE NOTICE 'fx_amount/fx_currency kept: posted lines carry foreign amounts';
    END IF;
  END IF;
END
$rb2$;
COMMIT;
