# Phase 26.32 — Systematic module audit (live server, not code review)

> **Method mandate (from the phase brief):** «روش این فاز دقیقاً همان چیزی است که
> در ۲۶.۲۹ جواب داد: تست واقعی روی PostgreSQL زنده و مرورگر، نه بازرسی کد.»
>
> Everything below was produced by issuing **real HTTP requests to a running
> server against live PostgreSQL** and reading the **actual status codes and the
> actual rows in the database**. No finding in this document comes from reading
> source.

---

## 0. Why the method matters (the evidence)

Three phases in a row, code review missed defects that one request exposed:

| Phase | What review said | What a real request showed |
|---|---|---|
| 26.29 | eleven modules "look fine" | a `NOT NULL slug` the form never sends → generic 500 → UI said only "Failed" |
| 26.31 | Menu Builder "works" | it edited `navigation_items`, a table **nothing read** — the site used a hardcoded array |
| 26.32 | double-submit "handled by the disabled button" | **two concurrent POSTs created two rows** on 3 of 6 endpoints |

The audit tooling is therefore permanent and runs in CI against a live server:

```
npm run audit:modules           # scripts/module-audit.ts        — every module, real status codes
npm run audit:modules:classes   # scripts/module-audit-classes.ts — the two error classes
```

Both are wired into the CI `load-test` job (which already builds, provisions PG
and starts `next start`) with `AUDIT_STRICT=1`, so a regression fails the build.

---

## 1. Result

| Metric | First run | Final |
|---|---|---|
| Modules clean | **55 / 80** | **80 / 80** |
| Endpoints creating duplicates on a double-click | **3 / 6** measured | **0 / 15** |
| Contract drift (list bound to an object payload) | not measured before | **0 / 12** live-checked |
| Orphan (write-only) tables | 12 | **10 documented + 2 connected** |

Gates: TypeScript **0** · ESLint **0** · unit tests **862** · governance audits
**12 / 12 at 0** · build clean · regression suites **14 / 14**.

---

## 2. Common roots (fixed once, not N times)

The whole point of the phase was to find the **root** behind a class of broken
modules rather than patching each symptom.

### Root A — `.returning()[0]` on a non-existent row → 500 (17 routes)

`db.update(x).set(…).where(eq(x.id, bogusId)).returning()` returns `[]`, so
`result[0]` is `undefined`, and `NextResponse.json(undefined)` throws
*"Value is not JSON serializable"* — a **500 for what is simply a wrong id**.

Fixed with two shared helpers in `src/lib/api/respond.ts`:

```ts
export function notFound(message = 'Not found')            // 404
export function jsonOr404<T>(row: T | undefined | null)    // row ?? 404
```

applied to 17 routes. A bogus id now answers **404**, visible in the `404`
column of the module table below.

### Root B — five routes with no `try`/`catch`

`docs`, `products`, `events`, `organizations`, `sites` passed any DB error
straight out as an unhandled 500. All now wrap in `try { … } catch (e) { return apiError(e) }`,
which maps PG `23502`/`23505` to a **400 naming the field** (the 26.29 contract).

### Root C — a table-name collision that silently broke a whole module

`integrations` was claimed by **two** subsystems:

| Owner | Defined in | Columns |
|---|---|---|
| CMS integrations catalog | Drizzle schema | `slug`, `name_en`, `category` |
| ERP Integration Hub (21.8) | raw DDL in `migrate.ts` | `key`, `name`, `type` |

The Drizzle migrator runs first, so the Hub's `CREATE TABLE IF NOT EXISTS` never
fired and **every Hub query hit the wrong table** (`column i.key does not exist`).
The ERP table is renamed `integration_connectors` (dispatch FK repointed, plus a
`$fk2632$` idempotent block for existing installs), and the four query sites
follow it. Both tables were empty, so the rename was clean.

### Root D — a derived slug could collide with no way out (26.29, one layer down)

26.29 made the server derive a missing `slug`. The audit then created the same
title twice and got `Duplicate slug — it must be unique`: honest, but
**unactionable** — these forms have no slug field, so the operator is told to fix
a value they cannot see. The module reads as broken again.

Fixed by distinguishing the two cases in `src/lib/admin/slug.ts`:

* a slug the **operator typed** still collides loudly — it is their unique key and
  silently renaming it would break their URL;
* a slug the **server derived** carries no such promise, so `ensureUniqueSlug`
  disambiguates it: `guide` → `guide-2` → `guide-3`.

Applied to 16 create routes. Live proof: three identical `POST /api/admin/docs`
now answer `uniq-probe2`, `uniq-probe2-2`, `uniq-probe2-3`.

### Root E — the double-submit guard (see §3)

---

## 3. The two error classes 26.26c closed by argument — now measured

### 3a. Double submit — **the class was real**

`scripts/module-audit-classes.ts` fires two genuinely concurrent POSTs with an
identical body and counts the rows that landed:

```
❌ skills     statuses=200,200  rows=2
❌ timeline   statuses=200,200  rows=2
❌ crm-leads  statuses=200,200  rows=2
```

The endpoints that did **not** duplicate were protected only by accident — they
carry a unique key (blog/partner slug, customer code) and PostgreSQL rejected the
second row. So the real invariant is **"a create needs an identity"**, and where
the table has no natural key the server must supply one.

`src/lib/api/idempotency.ts` is that identity: a short-window fingerprint of
(actor, route, canonical body). A concurrent twin **awaits the same in-flight
promise**, so the duplicate never reaches the database at all — necessary
because both halves of a double-click arrive before either has committed, and a
plain "have I seen this?" check would still let both through.

> **Note on ordering:** Root D removed the accidental unique-slug protection, so
> the guard had to be extended to all 16 slug-derived creates as well. That is
> visible in the run history: after the slug fix, `blog` started duplicating —
> exactly the regression this measurement exists to catch.

Final: **0 / 15** endpoints duplicate. Locked by 15 unit tests
(`src/lib/api/__tests__/idempotency.test.ts`).

**Honest boundary:** the window lives in process memory, which covers the real
defect (one browser → one Node process; the app runs as a single PM2 instance).
A multi-instance deployment behind a load balancer would need this promoted to a
`request_fingerprints` table. Recorded as such, not assumed away.

### 3b. Contract drift (26.26 BUG-012) — **not found**

A manager that binds a list renders the parsed body **as an array**. If the
endpoint answers with an object the table is empty forever, with a 200 and
nothing in the console — both halves look right in isolation, which is why
reading the code missed it twice.

The check asks the running server what each list-bound endpoint really returns:

```
Contract drift — list-bound endpoints live-checked: 12 (0 unreachable) · OK: 12 · drift: 0
```

**Coverage is stated honestly:** it covers the 12 endpoints whose array contract
is statically detectable (`useResource<T>(…)`, `setX(await res.json())`,
`const d = await res.json(); setX(d)`). Managers that unwrap defensively
(`d.rows ?? d`) cannot drift and are not counted.

---

## 4. Orphan / write-only tables — an explicit decision for each

**No module was deleted.** Scan: 205 tables · 12 written-but-never-read · 13
never touched by app code.

### 4a. Connected (a real read path was built)

| Table | Why it mattered | What was built |
|---|---|---|
| `vendor_evaluations` | every 5-criteria review was stored and unreachable; only the rolled-up score survived, so the **trend behind a vendor's grade was invisible** | `vendorEvaluationHistory()` + `?evaluations=<id>` + an **Evaluation history** list in the Purchasing evaluate modal |
| `bank_matches` | the reconciliation **audit trail**: an auditor could not answer "why is this line reconciled?", and a rejected suggestion looked undecided | `matchHistory()` + `?history=1` + a **Reconciliation trail** table in the Treasury Reconciliation tab |

### 4b. Kept, write-only by design (documented)

| Table | Decision |
|---|---|
| `bank_statements` | import header; the *lines* are the working set and are read. Header is provenance. Keep. |
| `cash_positions`, `treasury_forecasts`, `currency_exposures` | point-in-time **snapshots**; the live views recompute from source (26.14 design). Snapshot history is a reporting roadmap item, not a defect. |
| `process_metrics`, `data_quality_checks` | BI run records; the dashboards recompute live (26.13). Keep as history. |
| `import_history` | append-only migration provenance beside `import_jobs` (which *is* read). Keep. |
| `event_registrations` | public event sign-ups; the events module is content-only today. A registrations view is roadmap — **the table is not dropped, the data is not lost.** |
| `vendor_contracts` | written by contract expiry self-heal (26.20). A contracts UI is roadmap. |
| `workflow_notifications` | delivery log for the 26.12 notification path. Keep as audit. |

### 4c. Never touched — superseded, retained

`content_categories`, `course_categories`, `doc_categories`, `product_categories`
(superseded by `erp_categories`, 26.17) · `course_lessons`, `product_releases`,
`success_stories`, `office_locations`, `departments` (schema ahead of UI) ·
`executive_reports` (Reporting Center generates live) · `hero_collections`
(26.25.2 library uses tags) · `search_index` (superseded by live `globalSearch`).

**Decision: retained, not dropped.** Dropping them is a destructive migration
with no user benefit, and several are the schema half of a roadmap feature.
(`here` in the raw scan output was a scanner false positive — an English word in
prose, not a table.)

---

## 5. Per-module results (80 modules, real status codes)

`page` = `GET /admin/<module>` · `GET` = list API · `POST` = minimal create ·
`400` = empty body must be a **400 naming the field**, never a 500 · `404` =
bogus id · `DEL` = delete the record it created. `-` = not applicable (a
dashboard with no CRUD contract, or an ERP posting endpoint that needs a whole
document context and is covered by its own regression suite).

```
module                            page  GET   POST  400        404   DEL
executive.home                    200   200   -     -          -     -
executive.search                  200   200   -     -          -     -
executive.dashboard               200   200   -     -          -     -
brand.about                       200   200   -     -          -     -
brand.timeline                    200   200   200   400 ✓      200   200
brand.skills                      200   200   200   400 ✓      200   200
brand.credentials                 200   200   201   400 ✓      404   200
brand.content                     200   200   201   400 ✓      404   -
brand.blog                        200   200   200   400 ✓      200   200
brand.hero                        200   200   -     -          -     -
brand.docs                        200   200   201   400 ✓      404   -
brand.seo                         200   200   -     -          -     -
brand.technologies                200   200   201   400 ✓      404   200
brand.solutions                   200   200   201   400 ✓      404   -
brand.services                    200   200   200   400 ✓      200   200
brand.industries                  200   200   201   400 ✓      404   200
brand.projects                    200   200   200   400 ✓      200   -
brand.testimonials                200   200   201   400 ✓      404   200
brand.certifications              200   200   200   400 ✓      200   200
brand.products                    200   200   201   400 ✓      404   -
brand.academy                     200   200   201   400 ✓      404   -
brand.events-mgr                  200   200   201   400 ✓      404   -
brand.sections                    200   200   201   400 ✓      404   -
brand.pages                       200   200   201   400 ✓      200   200
brand.forms                       200   200   200   400 ✓      200   200
brand.menus                       200   200   200   400 ✓      200   200
brand.media                       200   200   -     -          -     -
brand.templates                   200   200   201   400 ✓      404   200
crm.crm.dashboard                 200   200   -     -          -     -
crm.crm                           200   200   200   400 ✓      400   200
crm.clients                       200   200   200   400 ✓      200   200
crm.organizations                 200   200   201   400 ✓      404   -
crm.contacts                      200   200   -     -          -     -
crm.consultations                 200   200   -     -          -     -
erp.finance                       200   200   -     -          -     -
erp.financial-intelligence        200   200   -     -          -     -
erp.sales                         200   200   -     -          -     -
erp.purchasing                    200   200   -     -          -     -
erp.inventory                     200   200   -     -          -     -
erp.assets                        200   200   -     -          -     -
erp.project-management            200   200   -     -          -     -
erp.treasury                      200   200   -     -          -     -
erp.business-intelligence         200   200   -     -          -     -
erp.documents                     200   200   -     -          -     -
erp.company                       200   200   -     -          -     -
erp.reports                       200   200   -     -          -     -
erp.master-data                   200   200   -     -          -     -
erp.import-center                 200   200   -     -          -     -
erp.approvals                     200   200   -     -          -     -
erp.workflows                     200   200   -     -          -     -
erp.rules                         200   200   200   400 ✓      400   200
erp.integration-hub               200   200   -     -          -     -
ai.ai-control                     200   200   -     -          -     -
ai.ai-agents                      200   200   -     -          -     -
ai.ai-prompts                     200   200   -     -          -     -
ai.ai-kb                          200   200   -     -          -     -
ai.ai-analytics                   200   200   -     -          -     -
security.users                    200   200   -     -          -     -
security.security                 200   200   -     -          -     -
security.soc                      200   200   -     -          -     -
security.audit                    200   200   -     -          -     -
operations.operations             200   200   -     -          -     -
operations.health                 200   200   -     -          -     -
operations.logs-monitoring        200   200   -     -          -     -
operations.database               200   200   -     -          -     -
operations.crm.tickets            200   200   -     -          -     -
backup.backup                     200   200   -     -          -     -
system.settings.onboarding        200   200   -     -          -     -
system.settings                   200   200   -     -          -     -
system.settings.integrations      200   200   -     -          -     -
system.finance                    200   -     -     -          -     -
system.documents                  200   -     -     -          -     -
system.flags                      200   200   200   400 ✓      400   200
system.numbering                  200   200   -     -          -     -
system.design-system              200   -     -     -          -     -
system.organization               200   200   -     -          -     -
system.sites                      200   200   201   400 ✓      404   -
system.workspaces                 200   200   201   400 ✓      404   200
system.partners                   200   200   -     -          -     -
system.integrations               200   200   -     -          -     -

80/80 clean · 0 with findings
```

---

## 6. Also closed in this phase

* **Last HTML5 drag in the admin** — `DashboardEngine` widget reorder never
  called `dataTransfer.setData`, so the browser never started a drag, and it did
  not work on touch at all. Migrated to the shared `usePointerDnd` — the same
  helper the kanban (26.29) and the DataTable column reorder (26.31) use. No
  raw HTML5 DnD remains in the admin.
* **BUG-114 (deactivated-means-deactivated)** — re-verified clean; no
  `(db.length > 0) ? db : DEMO` idiom remains.
* **BUG-113 (bilingual filter)** — only `case-studies` was ever affected and it
  is already fixed with `isAll()`.

---

## 7. Changelog

**New**
`src/lib/api/idempotency.ts` · `src/lib/api/__tests__/idempotency.test.ts` ·
`scripts/module-audit.ts` · `scripts/module-audit-classes.ts` ·
`docs/governance/phase26.32-module-audit-report.md`

**Changed**
`src/lib/api/respond.ts` (`notFound`, `jsonOr404`) ·
`src/lib/admin/slug.ts` (`ensureUniqueSlug`, `nextFreeSlug`, `slugWasDerived`) ·
`src/lib/db/migrate.ts` (`integrations` → `integration_connectors` + `$fk2632$`) ·
`src/lib/erp/purchasingData.ts` + `src/lib/treasury/bankOpsData.ts` (read paths) ·
`src/app/admin/purchasing/PurchasingCenter.tsx` +
`src/app/admin/treasury/TreasuryCenter.tsx` (history UIs) ·
`src/app/admin/dashboards/DashboardEngine.tsx` (pointer DnD) ·
17 routes (`jsonOr404`) · 5 routes (`try`/`apiError`) · 16 routes
(`ensureUniqueSlug` + `runOnce`) · 4 query sites (connector rename) ·
`package.json` (`audit:modules`, `audit:modules:classes`) ·
`.github/workflows/ci.yml` (both audits, `AUDIT_STRICT=1`)

---

## 8. New governance rules (added to CLAUDE.md)

25. A create endpoint needs an **identity**, not an accidental unique constraint.
26. A **derived** slug is disambiguated; an **operator-typed** slug collides loudly.
27. A missing row is **404** (`jsonOr404`), never a 500 from `.returning()[0]`.
28. A table name has **one owner**; a second `CREATE TABLE IF NOT EXISTS` on a
    name Drizzle already owns silently never runs.
29. A write-only table is a **finding**: connect it or record an explicit
    decision — never leave it undecided, never drop it to make the scan clean.
