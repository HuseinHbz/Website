# Phase 15 — Enterprise Business Platform (CRM foundation)

_Same honesty rule as Phases 10–14. Unlike earlier phases (where most modules
already existed), Phase 15 is genuinely **net-new business software**: CRM, client
portal, projects, contracts, quotations, invoices, support desk, workflow engine.
A production build of all of that is a multi-quarter programme, not a one-pass
"200/200" deliverable. This pass ships the **foundational, verified CRM lead
pipeline** that the rest builds on, reusing every existing subsystem, and honestly
documents the roadmap. No fabricated score._

## Business audit (no duplication)

Existing inbound capture — `contact_requests` (`/admin/contacts`) and
`consultation_requests` (`/admin/consultations`) — is **raw inbound**, not a sales
pipeline. The new CRM `crm_leads` entity is deliberately distinct (it carries
pipeline stage, source, score, deal value and an owner) and does **not** replace or
duplicate those tables; a future step can promote a contact/consultation into a
lead. Existing Organizations/Clients/Projects modules are left untouched.

## Shipped this pass — CRM Lead pipeline

- **`crm_leads` table** (migrate.ts, idempotent) with CHECK-constrained
  `source`/`status`, `score`, `value`, `owner_id → users(id)`.
- **Pure domain logic** `src/lib/crm/leads.ts`: `scoreLead()` (0–100 from
  completeness + source quality + pipeline stage + deal value) and
  `pipelineStats()` (open/won value, win rate, avg score, per-stage counts).
  Deterministic + **unit-tested** (`__tests__/leads.test.ts`, 5 tests).
- **API** `GET/POST/PUT/DELETE /api/admin/crm/leads` — reuses the validated
  subsystems: **zod** validation, **requireAdmin** RBAC (`edit` for writes,
  `delete` for delete), and **audit logging** (`logAction`, full actor/timestamp/
  before-after trail). Writes re-score the lead server-side; GET returns leads +
  aggregate sales KPIs.
- **Admin UI** `/admin/crm` (`LeadsManager`): sales-KPI tiles, pipeline-stage
  filter, inline stage change, create/edit modal with auto-score. Semantic token
  classes; sidebar entry under a new "Business" group.

### Verified live (seeded admin)
| Check | Result |
| --- | --- |
| RBAC — unauth POST | **401** |
| Create (referral/qualified/$50k) | id 1, **score 100** (auto) |
| Validation — bad email | **400** |
| List + pipeline stats | total 1, qualified 1, openValue $50k — correct aggregation |
| Audit trail | `CREATE · crm_leads · 1` written (actor + timestamp) |

Covers the spec's **Lead Management / Lead Sources / Lead Scoring / Pipeline /
Sales Dashboard (KPIs) / Win-Loss (win rate)**, plus **RBAC**, **API validation +
audit logging**, and **AI-ready** (leads flow into the existing CMS→KB sync path if
promoted to content).

## Honest roadmap — NOT delivered this pass

Each is a real, sizeable module; stubbing them to claim "200/200" would be
dishonest:
- **Organizations CRM depth** (departments/branches/custom fields/relationship map),
  **Opportunities/Deals/Activities/Meetings/Tasks/Reminders**.
- **Client Portal** (customer-facing auth, profile, project/contract/invoice views,
  ticket creation) — a separate authenticated surface.
- **Project management** (milestones/tasks/kanban/gantt), **Contracts**,
  **Quotations/Proposals (PDF)**, **Invoice foundation**.
- **Support desk** (tickets/SLA/escalation/CSAT), **workflow automation engine**,
  **notification center**, **business dashboards**, **OpenAPI docs**.

The pieces shipped here (scoring, pipeline stats, the validated+audited CRUD
pattern) are the reusable foundation these build on.

## Validation after this pass
`tsc` 0 · ESLint 0 · vitest **42/42** (incl. 5 CRM) · all 5 governance audits pass
(0 broken links — `/admin/crm` recognized) · production build OK. CRM lead pipeline
verified live (RBAC, scoring, validation, audit). No existing module duplicated or
replaced.
