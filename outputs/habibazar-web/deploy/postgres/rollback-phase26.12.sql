-- Phase 26.12 — Approval & Workflow Intelligence: rollback script.
-- Drops ONLY the objects introduced in 26.12. Safe to re-run.
-- Usage: psql "$DATABASE_URL" -f deploy/postgres/rollback-phase26.12.sql
BEGIN;

DROP TABLE IF EXISTS workflow_notifications CASCADE;
DROP TABLE IF EXISTS workflow_comments CASCADE;
DROP TABLE IF EXISTS workflow_escalations CASCADE;
DROP TABLE IF EXISTS approval_delegations CASCADE;
DROP TABLE IF EXISTS approval_actions CASCADE;
DROP TABLE IF EXISTS approval_requests CASCADE;
DROP TABLE IF EXISTS approval_matrix CASCADE;

COMMIT;
