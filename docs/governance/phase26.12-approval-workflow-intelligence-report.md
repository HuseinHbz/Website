# Phase 26.12 — Enterprise Approval & Workflow Intelligence Platform (Completion Report)

Upgraded the ERP workflow system into a centralized **approval orchestration
platform**. Audit-first, **NO DUPLICATE WORKFLOW ENGINE / NO FAKE**: the graph
workflow engine, Business Rules engine, notifications, RBAC, audit trail and AI
are all reused; a matrix-driven approval store was added alongside them. Audit:
`phase26.12-approval-workflow-audit.md`.

## Modules delivered (16/16)

| # | Module | Built | Reuse |
|---|---|---|---|
| M1 | Approval Matrix Engine (all doc types, amount tiers → levels) | `approval/matrix.ts` + `approval_matrix` | generalises purchasing `ApprovalTier` |
| M2 | Dynamic routing (condition/role/user/dept/cost-center/project) | `matrix.ts` `routeMatches` | **Business Rules `evalCondition`** |
| M3 | Workflow Designer node types (parallel / notification / ai_decision) | additive in `workflow/engine.ts` + `WorkflowCanvas` palette | graph engine unchanged |
| M4 | Parallel approval (all / any / min completion; any-rejection-stops) | `approval/engine.ts` `approvalState` | — |
| M5 | Delegation (window + doc/dept scope + audit) | `engine.ts` `canActFor`/`effectiveApprovers` + `approval_delegations` | — |
| M6 | SLA escalation (24h reminder / 48h manager / 72h CEO) | `approval/escalation.ts` + `workflow_escalations` (idempotent) | — |
| M7 | Business Rules integration | matrix conditions run through the rules engine | Rules Engine |
| M8 | Approval Inbox (pending/approved/rejected/delegated/expired + bulk) | `inbox()` + `/admin/approvals` UI | — |
| M9 | Comments & collaboration (internal notes, attachments, mentions) | `workflow_comments` + `addComment` | — |
| M10 | AI Approval Assistant (summary/risk/recommendation; **advisory only**) | `approvals/ai` route + deterministic history pre-analysis | **`runCompletion`** |
| M11 | Approval Analytics (avg time, bottlenecks, rejection rate, SLA, dept) | `approval/analytics.ts` | — |
| M12 | Notification Engine (email/internal/webhook intents logged) | `workflow_notifications` + `queueNotification` | `notifications.ts` / Integration Hub |
| M13 | Security & Audit (user/date/IP/action/old/new + RBAC) | `logAction` on every action + `resolveActor` | audit + `canDo`/`finance_role` |
| M14 | DB (idempotent + rollback + indexed) | 7 tables in `migrate.ts`; `rollback-phase26.12.sql` | — |
| M15 | ERP integration (advance the source document on approval) | `advanceDocument` (purchase/sales/gen docs) + generic `createApprovalRequest` hook | ERP modules |
| M16 | Tests (unit + integration + live-PG) | 14 engine units + full live-PG integration | — |

## Verification (Final Quality Gates)
```
TypeScript ....... 0 errors
ESLint ........... 0 errors
Unit tests ....... 428 passed (56 files)   ← +14 approval-engine units
Governance audits  tokens 0 · content 0 · deps clean · links 0 · i18n 0 · ui 0
Build ............ clean (/admin/approvals 7.02 kB / 164 kB)
PostgreSQL ....... PASS — full integration below
```

**Live-PG integration** (ephemeral real PostgreSQL): seeded matrix → a 2B-Rial
purchase document routes to **3 levels** (dept_manager → CFO → CEO) → approve
L1/L2/L3 → request **approved** and the **purchase document advances to
approved** → 3 actions audited (approver + comment + IP) → a rejection stops a
second request → a 73h-stale request fires **escalation stages 1,2,3** + SLA
breach, and a re-scan is **idempotent** → delegation stored → analytics
computed. Every assertion passed.

## Design (no duplicate / honest)
- The approval platform is a **matrix/step store**, NOT a second graph executor.
  The graph engine's `approval`/`parallel` nodes pause to `waiting`; the central
  platform owns multi-level/parallel approval state for ERP documents.
- **Routing conditions reuse the Business Rules `evalCondition`** — no second
  condition evaluator.
- **RBAC** layers on the existing `canDo` + `finance_role` (26.11): a user acts
  when their finance role matches a level's role approver, they're a named user
  approver, they're a core admin, or an **active delegation** grants it.
- **AI advises, never decides** — the assistant returns Approve/Review/Reject as
  a suggestion the human may override; the decision endpoint is separate.

## Honest boundaries
- **Notifications** are recorded as intents in `workflow_notifications` and sent
  best-effort via the shared `sendMail` when a recipient resolves — the log is
  real; delivery depends on SMTP/webhook config.
- **Escalation** runs on-demand via a scan endpoint (administrator-gated); no OS
  cron was added — the in-app scheduler seam can drive it periodically later.

**Phase 26.12 Status: ENTERPRISE APPROVAL & WORKFLOW INTELLIGENCE COMPLETE.**
