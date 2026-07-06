# Phase 21.3 ERP — Module 6: Enterprise Project Management (completed)

Sixth complete ERP module (Inventory → Assets → Financial → Dashboard → Sales →
**Projects**). Real, verified — projects with Kanban, Gantt, milestones and
timesheets. Distinct from `/admin/projects` (the CMS Case Studies content).

## Shipped & verified

- **Project engine** (`src/lib/erp/projects.ts`, pure, 11 unit tests):
  `projectProgress` (hours-weighted share of done tasks, falls back to count),
  `kanbanColumns` (group tasks by status), `projectHealth` (on-track / at-risk /
  overdue / done from progress vs elapsed time), `ganttLayout` (task dates →
  offset%/width% within a range, clamped, dateless tasks hidden), `loggedHours`,
  `projectKpis` (labor cost = hours × rate, budget-used %, task completion).
- **Data model** (PostgreSQL): `pm_projects` (code, customer, manager, status,
  dates, budget, hourly rate), `pm_tasks` (todo/in_progress/review/done,
  priority, assignee, estimate, start/due), `pm_milestones` (open/reached/missed),
  `pm_timesheets` (person, date, hours, optional task).
- **Server layer** (`src/lib/erp/projectData.ts`): enriches each project with
  progress + schedule health + logged hours; builds the per-project detail hub
  (tasks + Gantt bars + milestones + timesheets) and the portfolio dashboard —
  all via the pure engine.
- **APIs**: `/api/admin/erp/projects` (list with progress, detail hub via ?id=,
  dashboard via ?overview=1, project CRUD) + `/api/admin/erp/projects/items`
  (discriminated create/update/move/delete for tasks, milestones and timesheets).
  zod-validated, RBAC-gated, audit-logged.
- **UI** (`/admin/project-management`, `ProjectCenter`, fully bilingual FA/EN):
  Dashboard (8 KPI cards + project progress overview) · Projects (table with live
  progress bar + health badge + logged hours) → **per-project hub** with four
  views: **Kanban** (4 columns, task cards with move ←/→ + priority), **Gantt**
  (bars positioned by the pure layout), **Milestones** (list + add), **Timesheet**
  (log + ledger).

**Verified:** tsc 0 · ESLint 0 · vitest 128/128 (11 projects) · 6 governance
audits pass · build OK · **real PostgreSQL round-trip** — a project with 4 tasks
(40h done of 100h) + 100 logged hours: progress **40%**, health **at_risk**
(75% through the timeline, 40% done), logged hours **100**, Gantt **3/4 bars
visible** (the dateless task correctly hidden).

## Remaining ERP roadmap

Purchasing, Project Costing, Document Generation Engine, visual Workflow Designer,
Business Rules Engine, Integration Hub, Reporting Platform, Global Search — each
built the same way, one complete module at a time.
