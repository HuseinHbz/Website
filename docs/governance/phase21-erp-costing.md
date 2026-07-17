# Phase 21.4 ERP — Module 7: Project Costing (completed)

Seventh complete ERP module, built on Project Management. Real, verified — cost
tracking by category, profit/loss, budget variance and an earned-value forecast.

## Shipped & verified

- **Costing engine** (`src/lib/erp/costing.ts`, pure, 8 unit tests):
  `costByCategory` (labor/equipment/purchase/travel/expense/other, folds in
  timesheet-derived labor), `costingSummary` — total cost, revenue, profit,
  margin %, budget variance + %, and an **earned-value forecast**: EAC (estimate
  at completion = actual cost ÷ % progress) and VAC (budget − EAC) with an
  over-run flag — plus `costingKpis` for the portfolio.
- **Data model** (PostgreSQL): `pm_cost_entries` (project, kind cost|revenue,
  category, description, amount, date). Labor cost is *derived*, not stored —
  timesheet hours × the project's hourly rate.
- **Server layer** (`src/lib/erp/costingData.ts`): assembles each project's
  budget + manual cost/revenue entries + derived labor + % progress and runs the
  pure engine; `costingPortfolio` rolls all projects up.
- **API** `/api/admin/erp/projects/costing`: project costing detail (?id=),
  portfolio (?overview=1), add and delete cost/revenue entries — category
  validated against the kind, zod/RBAC/audited.
- **UI**: a fifth **Costing** view in the project detail hub (bilingual) — 8 cost
  KPI cards (budget/cost/revenue/profit-or-loss/variance/EAC/VAC/labor), an add
  cost-or-revenue form (category by kind), and the entries list (with the derived
  timesheet labor shown as a read-only line).

**Verified:** tsc 0 · ESLint 0 · vitest 136/136 (8 costing) · 6 governance audits
pass · build OK · **real PostgreSQL round-trip** — a project (budget $10k, rate
$50, 100 timesheet hours → labor $5k, +$2k equipment +$1k purchase, revenue $8k,
40% progress): total cost **$8,000**, profit **$0**, variance **+$2,000** (under
budget so far) but **EAC $20,000 / VAC −$10,000 / forecast overrun = true** — the
earned-value math correctly warns that 80% of budget spent at 40% progress
projects a $10k overrun.

## Remaining ERP roadmap

Purchasing, Document Generation Engine, visual Workflow Designer, Business Rules
Engine, Integration Hub, Reporting Platform, Global Search — each built the same
way, one complete module at a time.
