-- ERPFIX-6 — inventory costing + COGS from one reference: rollback script.
-- Safe to re-run. Usage: psql "$DATABASE_URL" -f deploy/postgres/rollback-erpfix-6.sql
--
-- NOTE: this does NOT undo any COGS entries already posted with the
-- corrected issueCost figures, nor any sales-return restock moves — those
-- are real inventory/GL history and must be reversed through the normal
-- reversal mechanisms, never deleted. This script only removes the NEW
-- schema objects this phase added.
BEGIN;
ALTER TABLE inv_products DROP COLUMN IF EXISTS last_cost;
DELETE FROM erp_settings WHERE key = 'invoice_stock_mode';
COMMIT;
