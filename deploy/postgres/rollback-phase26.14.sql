-- Phase 26.14 — Enterprise Treasury & Banking: rollback script. Safe to re-run.
-- Note: the prompt labelled this "26.13"; filed as 26.14 (26.13 = BI phase).
-- Usage: psql "$DATABASE_URL" -f deploy/postgres/rollback-phase26.14.sql
BEGIN;
DROP TABLE IF EXISTS currency_exposures CASCADE;
DROP TABLE IF EXISTS treasury_forecasts CASCADE;
DROP TABLE IF EXISTS cash_positions CASCADE;
DROP TABLE IF EXISTS receipt_transactions CASCADE;
DROP TABLE IF EXISTS payment_orders CASCADE;
DROP TABLE IF EXISTS bank_matches CASCADE;
DROP TABLE IF EXISTS bank_statements CASCADE;
ALTER TABLE bank_statement_lines DROP COLUMN IF EXISTS statement_id;
ALTER TABLE bank_statement_lines DROP COLUMN IF EXISTS erp_type;
ALTER TABLE bank_statement_lines DROP COLUMN IF EXISTS fingerprint;
ALTER TABLE bank_accounts DROP COLUMN IF EXISTS swift;
ALTER TABLE bank_accounts DROP COLUMN IF EXISTS branch;
ALTER TABLE bank_accounts DROP COLUMN IF EXISTS country;
ALTER TABLE bank_accounts DROP COLUMN IF EXISTS account_type;
ALTER TABLE bank_accounts DROP COLUMN IF EXISTS company_id;
ALTER TABLE bank_accounts DROP COLUMN IF EXISTS status;
COMMIT;
