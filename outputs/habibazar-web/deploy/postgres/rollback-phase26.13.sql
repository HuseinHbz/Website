-- Phase 26.13 — Business Operations Intelligence: rollback script. Safe to re-run.
-- Usage: psql "$DATABASE_URL" -f deploy/postgres/rollback-phase26.13.sql
BEGIN;
DROP TABLE IF EXISTS data_quality_checks CASCADE;
DROP TABLE IF EXISTS business_alerts CASCADE;
DROP TABLE IF EXISTS executive_reports CASCADE;
DROP TABLE IF EXISTS process_metrics CASCADE;
DROP TABLE IF EXISTS sla_events CASCADE;
DROP TABLE IF EXISTS sla_definitions CASCADE;
DROP TABLE IF EXISTS okr_results CASCADE;
DROP TABLE IF EXISTS okr_objectives CASCADE;
DROP TABLE IF EXISTS kpi_values CASCADE;
DROP TABLE IF EXISTS kpi_definitions CASCADE;
COMMIT;
