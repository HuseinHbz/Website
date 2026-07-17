-- Phase 26.11 — Enterprise Financial Intelligence: rollback script.
-- Drops ONLY the objects introduced in 26.11. Additive columns on existing
-- tables (cost_center_id, users.finance_role) are removed too. Safe to re-run.
-- Usage: psql "$DATABASE_URL" -f deploy/postgres/rollback-phase26.11.sql
BEGIN;

DROP TABLE IF EXISTS erp_financial_alerts CASCADE;
DROP TABLE IF EXISTS erp_kpi_snapshots CASCADE;
DROP TABLE IF EXISTS erp_forecasts CASCADE;
DROP TABLE IF EXISTS erp_budget_versions CASCADE;
DROP TABLE IF EXISTS erp_budget_lines CASCADE;
DROP TABLE IF EXISTS erp_budgets CASCADE;
DROP TABLE IF EXISTS erp_cost_center_members CASCADE;
DROP TABLE IF EXISTS erp_cost_centers CASCADE;

ALTER TABLE gl_journal_lines   DROP COLUMN IF EXISTS cost_center_id;
ALTER TABLE sales_documents    DROP COLUMN IF EXISTS cost_center_id;
ALTER TABLE purchase_documents DROP COLUMN IF EXISTS cost_center_id;
ALTER TABLE users              DROP COLUMN IF EXISTS finance_role;

COMMIT;
