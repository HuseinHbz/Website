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

## Phase 21.7 update — Business Rules Engine (shipped)

Built after the Workflow Designer, since workflows consume rules.

- **Pure engine** (`src/lib/rules/engine.ts`, 7 unit tests): a decision-table
  evaluator. `evalCondition` supports eq/ne/gt/gte/lt/lte/in/nin/contains/between/
  truthy/falsy over dotted fact paths; `ruleMatches` combines conditions with
  all/any; `runRules` evaluates rules highest-priority first in `first`-match or
  `collect`-merge mode and returns matches + merged outputs + a full trace;
  `validateRuleSet` guards structure. Covers discount/tax/validation/approval/
  inventory/pricing/financial rules through one generic model.
- **Versioned decision tables** (PostgreSQL): `business_rules` (head + active
  version + status) × `business_rule_versions` (immutable history → rollback).
- **API** `/api/admin/erp/rules` (CRUD, newVersion, setActive-rollback, activate,
  archive) + `/rules/simulate` (test facts → matched rules + outputs + trace).
- **UI** `/admin/rules` (bilingual): rule list, JSON decision-table editor,
  live **simulate/test** panel, and version history with one-click rollback.
- **Workflow ↔ Rules composition** (the point of ordering): the workflow run
  route registers a `rule` task handler (`runRuleByKey`) that evaluates a rule's
  active version against the workflow's variables and merges the outputs back.
  So a workflow `task` node `{action:'rule', config:{ruleKey}}` lets the flow
  branch on rule results. **Verified**: a workflow rule-task drives a downstream
  condition — gold customer → rule outputs 20% → "big discount" branch; a bulk
  order → 10% → "small discount" branch. tsc 0 · ESLint 0 · vitest 155/155 · 6
  audits pass · build OK.

Integration Hub remains the documented roadmap; it composes through the same
`task` handler seam (connectors run as task handlers).

## Phase 21.8 update — Enterprise Integration Hub (shipped)

The third automation subsystem, built last (all modules ready to connect out).

**Honest execution model** (no heavy deps, nothing faked): REST, GraphQL and
Webhook use native `fetch`; SMTP uses the existing nodemailer + site SMTP
settings — these are **executed**. Kafka, RabbitMQ and SFTP need a broker + heavy
deps + infra, so their dispatches are recorded as **queued intents** (not
executed) — the same policy the Workflow engine already uses.

- **Pure engine** (`src/lib/integration/engine.ts`, 7 unit tests): `isExecutable`,
  `buildRequest` (REST/GraphQL/webhook with bearer/custom-header auth),
  `redactConfig` (masks token/secret/password values for display), `backoffDelays`
  (capped exponential), `validateConnector`.
- **Dispatcher** (`src/lib/integration/dispatch.ts`): performs the call with
  retry + dead-letter; every attempt is logged to `integration_dispatches`
  (status success/failed/queued/dead). The DLQ is dead+unresolved rows; failed
  items can be re-dispatched.
- **Data model** (PostgreSQL): `integrations` (connectors, config JSON) +
  `integration_dispatches` (log + DLQ).
- **API** `/api/admin/erp/integrations` (CRUD with redacted config) +
  `/integrations/dispatch` (dispatch/test, recent + DLQ list, re-dispatch,
  metrics). RBAC + zod + audit.
- **UI** `/admin/integration-hub` (bilingual): Connectors (typed editor with a
  Test button + executes/intent badge + DLQ count), Monitoring (metrics +
  dispatch log), Dead Letter (retry).
- **Workflow ↔ Integration composition**: the run route registers an
  `integration` task handler (`dispatchByKey`) that sends the workflow variables
  through a connector — so a `task` node `{action:'integration',
  config:{connectorKey}}` calls an external system. This closes the automation
  loop: **workflows → rules → integrations**, one engine + handler seam, no
  duplicated logic.

**Verified vs real PostgreSQL**: a REST connector to a live local server returned
`success` (logged); a failing endpoint retried then landed `dead` after 2
attempts (DLQ); a Kafka connector recorded a `queued` intent. tsc 0 · ESLint 0 ·
vitest 162/162 · 6 audits pass · build OK.

All three automation subsystems now exist — Workflow Designer (visual), Business
Rules Engine, Integration Hub — composing through the engine's task handler seam.
