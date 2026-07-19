# Phase 26.18 — Enterprise Data Import & Migration Center (Completion Report)

Audit-first migration platform (Migration Architect · Data Migration Lead · CFO ·
Data Governance · DB Architect · Implementation Consultant). Companies can now
migrate customers, suppliers, products, categories, warehouses, opening stock,
opening balances and legacy journal vouchers from CSV/JSON exports — with
structure detection, auto-mapping, validation, duplicate resolution, tiered
approval, transactional execution, full audit, and reverse-migration rollback.

## 1. Audit result (see `phase26.18-data-import-migration-audit.md`)
Existing and REUSED: generic `parseCsv` (DataTable platform — no second CSV
parser), FormData upload pattern (media route), 26.16/26.17 quality validators +
`normalizeKey` duplicate keys, 26.9 `postOpeningBalance` + `entryBalanced`,
Numbering Engine (`nextNumber('journal')`), RBAC (`requireAdmin`/`canDo`), audit
(`logAction` user/IP/date + file hash). Missing (built): job orchestration
tables, mapping engine, entity executors, rollback engine, templates, analytics,
wizard UI.

## 2. Existing capabilities reused
`parseCsv` · masterdata validators (`isValidEmail`/`isValidIranNationalId`/
`isValidEconomicCode`) · `normalizeKey` identity matching · `postOpeningBalance`
(self-balancing opening entry) · `nextNumber` journal numbering · `logAction` ·
`requireAdmin` · DataTable/ui primitives · workspace registry. No duplicate
engines were created.

## 3. New modules built (M1–M12)
- **Pure engine** `src/lib/import/engine.ts` — `ENTITY_SPECS` (8 entities with
  FA/EN labels, required/type/format/identity/ref metadata + header synonyms),
  `templateCsv`, `autoMapColumns` (exact key > EN/FA label > synonym > substring;
  never claims a header twice), `applyMapping`, `coerce` (numbers with thousands
  separators, بله/yes booleans), `validateRecord` (required → type → format →
  relationship → duplicate, resolution-aware), `journalGroupBalanced` (Dr=Cr),
  `approvalTierFor` (<100 auto · 100–1000 manager · >1000 admin) +
  `tierSatisfiedBy` (editor/administrator/super_admin), and the
  `canTransitionJob` job state machine (draft→mapping→validating→validated→
  approved→processing→completed/failed→rolled_back; approval cannot be skipped).
- **Data layer** `src/lib/import/importData.ts` — `createJob` (CSV/JSON parse,
  SHA-256 **file hash**, chunked row storage, suggested mapping, tier assignment),
  `saveJobMapping` (+ resolution skip/update/block), `validateJob` (live-DB
  context: existing identity keys per entity + product/warehouse/account
  reference sets; per-row statuses + `import_validation_errors`; journal groups
  re-checked for balance; exact SQL recount), `approveJob` (tier×role), 
  `executeJob` — **single SQL transaction** for row entities with upsert-by-code
  (`ON CONFLICT … DO UPDATE`, `xmax=0` insert/update detection), skip-mode
  duplicate skipping, inventory FK resolution → real `inv_moves`, journal groups
  → posted `gl_journal_entries` (numbering engine), opening balance → the 26.9
  engine; every inserted record logged to `migration_transactions` —
  `rollbackJob` (reverse-order transactional DELETE of logged inserts; updates
  reported as not-reversible), `importAnalytics`, templates + mapping-profile CRUD,
  `import_history` event log.
- **API** `POST/GET /api/admin/erp/import` — multipart upload (8 MB cap, CSV/JSON
  only) + JSON pipeline actions (map/validate/approve/execute/rollback/template.*
  /mapping.save); rollback administrator-gated; every action `logAction`-audited
  with IP + file hash. GET views: jobs/job/templates/template-csv/mappings/analytics.
- **UI** `/admin/import-center` (bilingual RTL/EN): **Dashboard** (M11 — totals/
  success/failed/records/quality% + per-entity + history), **New Import** — the
  6-step wizard (Upload w/ entity + source-system SAP/Oracle/Dynamics/Odoo/Excel
  + template download → Mapping w/ per-field selects + resolution + save-profile
  → Validation w/ valid/warning/rejected tiles + error DataTable → Approval w/
  tier display → Execute → Report), **Migration Jobs** (M7 — status DataTable,
  contextual validate/approve/execute/rollback actions), **Templates** (M2 —
  create from entity standard, versioned, CSV header download). Registered in the
  ERP workspace (sidebar/switcher/palette).

## 4. Database changes (idempotent, migrate.ts)
`import_templates` · `import_mappings` · `import_jobs` (status CHECK, counts,
mapping JSON, approval tier, file hash) · `import_job_rows` (raw/mapped JSON,
per-row status) · `import_validation_errors` · `import_history` ·
`migration_transactions` (job × table × record × op) + status/job indexes.

## 5. API changes
One new route `/api/admin/erp/import` (GET 6 views · POST upload + 8 actions).
No existing API modified.

## 6. UI screens
Import Center with 4 tabs + the 6-step wizard (above). Excel guidance is explicit
("save as CSV"), template CSVs downloadable per entity, progress + error detail
tables, permission-hidden buttons (rollback admin-only).

## 7. Security review (M12)
The prompt's `IMPORT_*` permissions map onto RBAC: view = any admin session;
create/validate/execute = `edit`; approve = tier-gated (auto→editor+, manager→
administrator+, admin→super_admin); rollback = administrator+. Every action is
audited (user, IP, date, detail) and `import_jobs` stores the SHA-256 **file
hash**; `import_history` records created/validated/approved/executed/failed/
rolled_back with before/after counts.

## 8. Test results
- **43 new unit tests** (`import/__tests__/engine.test.ts`): CSV parsing (6,
  incl. quotes/CRLF/newlines/Persian), templates (2), auto-mapping (6), mapping
  application (3), coercion (4), validation (12 — required/type/format/national-id
  check digit/relationships/duplicates×3 resolutions/journal sides), balance (4),
  approval tiers (2), state machine (4). Full suite **578 pass**.
- **Live PostgreSQL 27/27 assertions across the 9 required scenarios**:
  ① 100 customers imported from a messy legacy CSV (auto-mapped Cust_Code/
  MobileNo/E-Mail) ② duplicate customer detected + skipped ③ manager-tier
  approval (editor rejected, admin approved) ④ rollback reversed all 100 inserts
  (DB restored, job rolled_back) ⑤ products imported (synonym mapping)
  ⑥ inventory opening stock → real `inv_moves` (ghost SKU rejected by the
  relationship check; on-hand = 50) ⑦ opening balance → balanced posted entry
  (Dr 7,000,000 = Cr) ⑧ journal groups → one posted balanced entry; unbalanced
  voucher rejected ⑨ analytics report (6 jobs, 5 completed + 1 rolled back,
  110 records, full `import_history` audit trail).
- TypeScript 0 · ESLint 0 · 7 governance audits 0 · production build clean.

## 9. Performance review
Row storage is chunked (200-row multi-inserts); validation prefetches identity/
reference key sets once per job (no N+1); execution runs in one transaction with
per-row prepared statements; jobs capped at 20,000 rows / 8 MB per file (split
larger migrations). Analytics is a single aggregate query.

## 10. Remaining ERP roadmap (honest boundaries)
- **.xlsx** parsing needs a heavy dependency (`audit:deps` forbids) — users save
  Excel as CSV (documented in the wizard); same standing pattern as print-PDF.
- **Sales/purchase invoice + asset imports** (multi-line transactional documents)
  are the next executor set — recorded, not stubbed.
- **Update-mode rollback** restores inserts fully; overwritten (update) rows are
  logged in `migration_transactions` but not value-reversed (would need old-value
  snapshots; the 26.17 versioning engine is the natural future hook).
- **AI-assisted mapping** — the auto-mapper is deterministic (synonyms +
  similarity); an LLM suggestion pass can reuse `runCompletion` later.

---
**Acceptance:** Import Center works · CSV/JSON supported (Excel via save-as-CSV)
· mapping works · validation works · duplicate handling works · approval tiers
work · rollback works · opening-balance migration works · legacy wizard works ·
analytics works · RBAC + audit complete · TypeScript 0 · ESLint 0 · build clean ·
578 tests pass · live PostgreSQL 9/9 scenarios.

**Phase 26.18 — Enterprise Data Import & Migration Center Complete.**
