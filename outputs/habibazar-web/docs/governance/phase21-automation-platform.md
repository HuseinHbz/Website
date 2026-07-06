# Phase 21 — Enterprise Automation Platform

## Honest scope — one real, verified foundation this pass

Phase 21 spans three enormous subsystems (Workflow Designer, Business Rules
Engine, Integration Hub). Per the project's "real, non-fabricated increments"
rule, this pass ships **the Workflow execution foundation end-to-end and
verified**, and documents the rest as a concrete roadmap. Nothing is faked.

## Shipped & verified — Workflow Designer foundation

A script-less, config-driven, **deterministic** workflow engine plus its data
model, RBAC/zod/audited API and admin UI.

- **Engine** (`src/lib/workflow/engine.ts`, pure, unit-tested — 10 tests):
  `executeWorkflow(def, input, { handlers })` walks a node graph — node types
  `start · end · set · condition · log · task · delay · approval` — mutating a
  variables bag and a structured log. Deterministic given input + handlers;
  side effects only via injected `TaskHandler`s. Loop-safe (step budget),
  human-task pause (`approval` → `waiting`), retry/`continueOnError`, and a
  structural `validateWorkflow` (unique ids, resolvable edges, reachable end).
- **Data** (`workflows`, `workflow_runs` tables in `migrate.ts`): definition
  graph (JSON) + versioning (auto-bumped on change) + status (draft/active/
  archived) + full run history (status, steps, log, variables, error).
- **API** (`/api/admin/workflows`, `/api/admin/workflows/run`): CRUD +
  execute + run history. zod-validated, `requireAdmin` RBAC, audit-logged;
  the definition is engine-validated before persist. Built-in safe task
  handlers (`notify`, `log`); external actions (`email`/`webhook`/`http`)
  recorded as **intents, not executed**, until a real integration is wired —
  no silent external calls.
- **UI** (`/admin/workflows`, `WorkflowManager`): list, create/edit (JSON
  graph editor + starter template + client validation), run (with input),
  and a run-history viewer with per-run log. Sidebar: new "Automation" group.

**Verified live on PostgreSQL:** tables auto-created on boot; workflow created;
run under threshold → `completed` (auto branch, 5 steps); run over threshold →
`waiting` at the approval node; 2 runs recorded; versioning + KPIs correct.
tsc 0 · ESLint 0 · vitest 66/66 · 6 governance audits pass · audit:pgcompat 0 · build OK.

## Roadmap (documented, not yet built)

These are real, planned extensions — listed so scope is transparent, not implied
as done:

- **Visual designer**: drag-and-drop BPMN-style canvas (current editor is a
  validated JSON graph + starter templates). Parallel/join gateways, sub-flows.
- **Task library**: real email/webhook/http/db/AI task handlers (wired to the
  existing SMTP, AI and notification subsystems), timers + scheduled triggers
  (via the existing app scheduler), document generation.
- **Resume/rollback**: continue a `waiting` run after approval; compensating
  rollback steps.
- **Business Rules Engine**: decision tables, rule groups/priorities/versioning,
  formula engine — the engine's `task`/`condition` nodes are the integration
  seam (rules run as handlers, no duplicated logic).
- **Integration Hub**: connectors (REST/GraphQL/SOAP/queues), OAuth2/JWT,
  circuit-breaker (reuse `lib/circuitBreaker.ts`), DLQ/retry queues, monitoring.
- **Analytics dashboard**, per-node metrics, simulation/debug mode.

The three subsystems compose through the engine's handler seam: workflows call
rules (as `condition`/`task` handlers) which call integrations (as `task`
handlers) — one reusable execution path, no duplication.

## Phase 21.6 update — Visual Workflow Designer (shipped)

The JSON-graph editor is now backed by an **n8n / Power Automate-style visual
canvas** (`src/app/admin/workflows/WorkflowCanvas.tsx`):

- **Node palette** to drop any node type (start·end·set·condition·log·task·delay·
  approval) onto the canvas.
- **Draggable node cards** — pointer-drag repositions a node; the position is
  persisted as `x`/`y` on the node (the engine ignores these, so a laid-out graph
  executes identically).
- **SVG edges** with arrow markers, drawn from the definition; condition nodes
  render labelled `true` / `false` branch edges.
- **Property panel** to edit the selected node's id (with safe reference
  renaming), label and type-specific fields, and to set its outgoing connections
  (`next` / `whenTrue` / `whenFalse`) from a dropdown of node ids.
- A **Canvas / JSON toggle** — the canvas serialises to (and parses from) the
  exact `WorkflowDefinition` JSON the engine runs; JSON stays available for
  advanced editing and as a fallback for invalid input.

Pure geometry helpers `src/lib/workflow/layout.ts` (`graphEdges`, `autoLayout`
BFS-ranked columns) are unit-tested (5 tests). **Verified:** a canvas-laid-out
graph (x/y on every node) still `validateWorkflow` = valid and executes on the
existing engine — `amount:500` → completed (5 steps, auto branch), `amount:5000`
→ waiting @ approval. tsc 0 · ESLint 0 · vitest 148/148 · 6 audits pass · build OK.

Business Rules Engine + Integration Hub remain the documented roadmap; they
compose through the engine's `task`/`condition` handler seam.
