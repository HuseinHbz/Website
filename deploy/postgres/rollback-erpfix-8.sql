-- ERPFIX-8 — performance + exact-decimal balance checking: rollback script.
-- Safe to re-run. Usage: psql "$DATABASE_URL" -f deploy/postgres/rollback-erpfix-8.sql
--
-- NOTE: this does NOT revert any posted GL entry — the exact-balance check
-- added this phase can only ever have REJECTED a posting attempt, never
-- altered an already-posted one, so there is nothing financial to undo.
BEGIN;
DROP INDEX IF EXISTS idx_sales_docs_date;
DROP INDEX IF EXISTS idx_purchase_docs_date;
DROP INDEX IF EXISTS idx_sales_payments_date;
DROP INDEX IF EXISTS idx_purchase_payments_date;
ALTER TABLE sales_documents DROP CONSTRAINT IF EXISTS chk_sales_documents_date_fmt;
ALTER TABLE purchase_documents DROP CONSTRAINT IF EXISTS chk_purchase_documents_date_fmt;
ALTER TABLE sales_payments DROP CONSTRAINT IF EXISTS chk_sales_payments_date_fmt;
ALTER TABLE purchase_payments DROP CONSTRAINT IF EXISTS chk_purchase_payments_date_fmt;
-- base_rate NUMERIC -> DOUBLE PRECISION is intentionally NOT reverted here:
-- NUMERIC is a strict precision upgrade with no data loss going forward;
-- reverting it would reintroduce the exact float-precision bug this phase
-- fixes. If a rollback is truly required, run manually with full awareness:
--   ALTER TABLE erp_exchange_rates ALTER COLUMN base_rate TYPE DOUBLE PRECISION USING base_rate::double precision;
COMMIT;
