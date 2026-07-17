# ADR-002 — Granular per-user RBAC (design only)

- **Status:** Proposed (design). **No implementation in phase 26.26b (R8).** Build
  begins only after this ADR is approved by the maintainer.
- **Context:** today's RBAC is coarse — 5 fixed roles (`super_admin/administrator/
  editor/auditor/viewer`) → `canDo(role, action)` + a per-role workspace whitelist.
  The goal: per-user access — which module, which tab inside it, and read vs write.
- **Supersedes the sketch in the 26.26 report**, which had two serious flaws
  (addressed below) that would force a rewrite if implemented as-sketched.

## Decision (proposed)

### Data model
- `rbac_user_grants(user_id, permission_key, level ∈ {none,read,write}, company_id,
  granted_by, granted_at, UNIQUE(user_id, permission_key))`.
- `rbac_role_templates(key, name_en, name_fa, grants JSONB)` — reusable bundles.
- **Permission registry is GENERATED from `workspaces.ts`**, never hand-listed — a
  new module automatically yields new permission keys (avoids drift, like `audit:nav`).

### Resolution (pure, unit-tested)
`effectiveLevel(baseRole, grants, permissionKey) → none|read|write`:
1. explicit user grant for the key (or its parent module key) — **deny wins over allow**;
2. else role-template grant;
3. else base-role default (super_admin/administrator/editor → write on their allowed
   workspaces; auditor/viewer → read; otherwise none).
- **Backward compatible:** a user with **no grants** resolves to exactly today's
  base-role behaviour (migration seeds nothing → zero behavioural change).

## 🔴 Flaw 1 resolved — the `x-pathname` header is an escalation risk
The sketch said "make `requireAdmin` grant-aware via a middleware-set `x-pathname`
header." If a client sends that header and middleware *preserves* it, or any route
runs without middleware, the attacker chooses their own permission path.
**Decision:**
- The `x-pathname` header approach is **rejected as the sole mechanism**.
- Enforcement is **in the route via `requirePermission(key, 'read'|'write')`** where
  `key` is a **literal declared in the route file** (not derived from a client-
  controllable header). The permission key is compile-time constant per route.
- Middleware keeps its coarse role gate (defence in depth) and **always
  unconditionally overwrites** any inbound `x-pathname`/`x-permission` header
  (strip-then-set), so a forged header is inert.
- **Penetration test (required before ship):** a client sends a forged
  `x-pathname`/`x-permission` header targeting a module it lacks → must be **403**
  (the route's literal key governs; the header is ignored).

## 🔴 Flaw 2 resolved — HTTP-method mapping is too coarse
Routes like the GL journal multiplex operations in the body (`op: post|void|
update|draft`) — all POST/PUT, so a method→level map gives them one level. But
"save a draft" vs "post to the GL" are worlds apart for separation of duties.
**Decision:**
- Permission keys are **operation-scoped**, not method-scoped:
  `erp.finance.journal:draft` ≠ `erp.finance.journal:post` ≠
  `erp.finance.journal:void`. `requirePermission` is called with the **op-specific**
  key inside the branch that handles that op.
- **Op-multiplexed routes to enumerate in the build** (each needs op-level keys):
  `sales/documents` (send/confirm/void/convert/return/post), `finance/journal`
  (post/void/update/draft/approve), `purchasing` (submit/approve/convert/post/
  confirm/void), `approvals` (decide/bulk/escalate), `treasury/*`, `import`
  (validate/approve/execute/rollback), `heroes` (publish/rollback).

## Dependency on بند ۲ (nav)
Tab-level permission filtering rides on the **same registry + `workspaceForPath`**.
The 26.26b context-aware fix (بند ۲.۱) must land first, or tab RBAC is built on a
broken resolver. (Now landed — this dependency is satisfied.)

## Interaction with separation-of-duties (26.24b)
A grant/override must **never** let a user bypass the maker/checker guard
(`isSeparationViolation`, 26.24b). Explicit rule: RBAC governs *can you reach the
operation*; SoD governs *can this specific actor approve their own work*. They are
**AND-ed** — a write grant does not confer approval of one's own document. The
security test matrix must include: user with `journal:post` write **still** cannot
approve their own over-threshold entry.

## Enforcement layers (both mandatory)
- **Server:** `requirePermission` on every admin route + a new `audit:rbac` gate
  that fails the build if any admin route lacks a declared permission key. Middleware
  read-only 403 for non-GET when effective level < write.
- **UI:** modules/tabs with `none` not rendered; `read` → disabled write controls
  with a reason tooltip (not merely hidden); tab filtering via the registry.

## Consequences
- One pure resolver + one server helper + a generated registry → complete coverage
  without per-route bespoke logic beyond the literal key.
- Migration is a no-op for existing users (no grants → base role).
- Not-in-scope here: any table, route, or UI (R8).
