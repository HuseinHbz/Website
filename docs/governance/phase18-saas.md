# Phase 18 — SaaS Platform (Feature Flag Center increment)

_Same honesty rule as Phases 10–17. **Important caveat:** true multi-tenant
isolation — the core of Phase 18 — is an architectural migration that would add a
`tenant_id` to ~60 tables and enforce row-level isolation everywhere. Done wrong it
leaks data across tenants; done right it is a multi-sprint effort with heavy
isolation testing. The phase prompt also says "do NOT redesign the architecture,"
which directly conflicts with retrofitting multi-tenancy. So this pass does **not**
fake tenancy. It ships one real, self-contained SaaS building block — the **Feature
Flag Center** — with deterministic percentage rollout, verified end-to-end, and
honestly documents the tenancy work as a major deferred migration. No fabricated
280/280._

## Platform audit (no duplication)
No pre-existing flag/feature/tenant/SaaS admin module. The `feature_flags` table
and `/admin/flags` are net-new; nothing duplicated or replaced. Reuses the
established validated+audited CRUD pattern.

## Shipped this pass — Feature Flag Center

- **`feature_flags` table** (migrate.ts, idempotent): unique `key`, `enabled`,
  `rollout_percent` (CHECK 0–100), owner.
- **Pure evaluation** `src/lib/flags/evaluate.ts`: `isEnabled(flag, subject)` with
  a **deterministic** rollout (stable sha1 bucket per `flagKey:subject`) that is
  **monotonic** — raising the percentage never flips an already-enabled subject
  off. `evaluateAll()` maps every flag for a subject. **Unit-tested**
  (`__tests__/evaluate.test.ts`, 6 tests incl. determinism, monotonicity, and a
  2000-subject distribution check).
- **API** `GET/POST/PUT/DELETE /api/admin/flags`: zod validation (key charset +
  0–100 rollout), requireAdmin RBAC (`manage_settings`), audit logging, unique-key
  handling. GET previews each flag's evaluation for the current admin as subject.
- **Admin UI** `/admin/flags` (`FlagsManager`): rollout bar, enable toggle,
  per-you evaluation badge, create/edit modal; sidebar entry in the System group.

### Verified live (seeded admin)
| Check | Result |
| --- | --- |
| RBAC — unauth POST | **401** |
| Create (enabled, 50% rollout) | id 1 |
| Duplicate key | **400** |
| Invalid key chars | **400** (zod regex) |
| Per-admin evaluation | `evaluatedForMe: true` (deterministic bucket) |
| Audit trail | `CREATE · feature_flags · 1` |

Covers the spec's **Feature Flag Center** (global features, enable/disable,
percentage rollout — the deterministic building block for beta/experimental
features and A/B testing).

## Honest roadmap — NOT delivered this pass (the bulk of Phase 18)
- **Multi-tenancy + isolation** (the core): tenant model + `tenant_id` on every
  table + row-level scoping + isolation tests for DB/storage/AI-KB/backup/audit.
  A dedicated, high-risk migration — deliberately NOT stubbed, because a fake
  "isolation" is worse than none.
- **Subscriptions/plans/usage metering/billing foundation**, **white-label
  branding per tenant**, **developer portal + OpenAPI/Swagger + API keys/OAuth**,
  **webhook platform** (HMAC + retry + replay), **marketplace**, **enterprise
  integrations** (M365/Google/Slack/SAML/OIDC/LDAP), **AI multi-tenant
  isolation/quotas/cost**, **compliance** (GDPR export/delete, consent).

The flag engine shipped here is itself infrastructure those modules use (gating
beta features, per-tenant rollout once tenancy exists).

## Validation after this pass
`tsc` 0 · ESLint 0 · vitest **56/56** (incl. 6 flag) · all 5 governance audits pass
(0 broken links — `/admin/flags` recognized) · production build OK. Feature Flag
Center verified live (RBAC, validation, deterministic rollout, audit). No module
duplicated or replaced; no unsafe tenancy pretence.
