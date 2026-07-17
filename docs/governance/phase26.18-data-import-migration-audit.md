# Phase 26.18 — Data Import & Migration Audit (Before Coding)

Audit-first review (Migration Architect · Data Migration Lead · CFO · Data
Governance · DB Architect · Implementation Consultant). Legend: ✅ exists ·
❌ missing gap · ⚠️ needs enhancement.

## Existing import / parse capabilities (REUSE — no duplicate engines)
- ✅ **Generic CSV parser** — `src/lib/admin/dataTableExport.ts` `parseCsv(text)`
  (RFC-4180 quoted-cell matrix) + `importCsv` (header→column mapping, required,
  dedupe). The Import Center reuses `parseCsv`; a second CSV parser is forbidden.
- ✅ **Bank-statement import** (26.14 `treasury/statementImport.ts` CSV/MT940/
  CAMT.053 + duplicate fingerprints) — domain-specific, stays as-is.
- ✅ **Numbering config import/export** (26.11 `numbering/io.ts`) — stays as-is.
- ✅ **File upload pattern** — `POST /api/admin/media` (FormData) → reused for
  import file upload (bypasses the 512 KB JSON body cap).
- ✅ **Validation building blocks** — 26.16/26.17 quality engine (`isValidEmail`,
  `isValidIranNationalId`, `isValidEconomicCode`, `normalizeKey`,
  `duplicateGroups`) → the M4 pipeline + M5 duplicate detection reuse these.
- ✅ **Opening balance** — 26.9 `accountingData.postOpeningBalance` (normal-side
  placement, posted entry) + `ledger.entryBalanced` (Dr=Cr) → M9 reuses both.
- ✅ **Journal insert path** — finance journal route pattern (balanced-validated,
  numbering via `nextNumber('journal')`).
- ✅ **RBAC + audit** — `requireAdmin(action)` / `canDo` + `logAction`
  (user/IP/date/old→new) → M12.
- ✅ **Approval concepts** — 26.12 approval platform; import approval (M6) maps
  count-tiers onto RBAC roles (auto / manager=editor+ / admin) with an explicit
  audited approve step — no second approval engine.
- ✅ **DataTable + workspace registry** — UI shell + nav.

## Missing gaps (❌ → build)
- ❌ Import job orchestration: no `import_jobs`/`import_job_rows`/
  `import_validation_errors`/`import_history`/`migration_transactions` tables,
  no job state machine (draft→mapping→validated→approved→processing→completed/
  failed/rolled_back).
- ❌ Field-mapping engine (M3): header→ERP-field auto-suggest + saved mapping
  profiles (`import_mappings`).
- ❌ Import templates (M2): `import_templates` + per-entity column specs +
  template CSV export.
- ❌ Entity import executors: customer / supplier / product / category /
  warehouse / inventory opening stock / opening balance / journal entries —
  none exist as bulk paths.
- ❌ Rollback engine (M8): no per-record migration transaction log or reverse
  migration.
- ❌ Import analytics (M11) + Import Center UI (M1 wizard).

## Needs enhancement / honest boundaries (⚠️)
- ⚠️ **.xlsx**: the platform has Excel **export** (SpreadsheetML) but no .xlsx
  reader; a real xlsx parser is a heavy dependency the `audit:deps` gate forbids.
  Decision: native **CSV + JSON** import; Excel users save-as-CSV (documented in
  the UI) — same standing pattern as print-HTML→PDF.
- ⚠️ Transactional documents (sales/purchase invoices with line items) and
  assets are **not** in the first executor set — master data + inventory +
  finance (the 9 required live-PG scenarios) are; documents are recorded as
  roadmap, not stubbed.
- ⚠️ M10 legacy wizard: source system (SAP/Oracle/Dynamics/Odoo/Excel) is a
  guided context + saved mapping profile per source — no vendor-specific binary
  readers (they export CSV).

## Decision
Build the import platform (tables + pure engine + data layer + API + wizard UI)
reusing `parseCsv`, the 26.16/26.17 validators + duplicate detection,
`postOpeningBalance`/`entryBalanced`, FormData upload, RBAC/audit — and nothing
duplicated.
