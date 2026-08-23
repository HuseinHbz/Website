# Full Remediation Audit — Phase 0 (Discovery Only)

Source: MASTER ERP HARDENING + FULL PROJECT REMEDIATION prompt (v1.0.0).
This document is **discovery only** — no code was changed to produce it.
Scope note: the master prompt describes a 23-phase, full-ERP-rewrite-scale
program. Per the maintainer's explicit instruction, remediation proceeds
**one phase at a time**, each implemented, tested against real PostgreSQL,
and pushed before the next phase starts (CLAUDE.md rule 3: resume
automatically across limits, never leave a phase half-done).

This pass targeted real, verifiable signal — grep-level scans across
`src/` (876 TS/TSX files) plus direct inspection of the transaction/error/
inventory layers named as P0 in the master prompt — rather than
re-describing the ~60 phases already documented in `CLAUDE.md`. Findings
below are what actually exists in the repository today, not assumptions.

## Modules reviewed this pass
`src/lib/db/index.ts` (connection/pool layer), `src/lib/hr/payrollData.ts`,
`src/lib/hr/employeeData.ts`, `src/lib/masterdata/masterDataData.ts`,
`src/lib/import/importData.ts`, `src/lib/numbering/service.ts`,
`src/lib/api/respond.ts`, `src/lib/erp/documents.ts`, `src/lib/erp/sales.ts`,
`src/lib/inventory/stockOps.ts`, `src/lib/approval/engine.ts`, plus a
repo-wide grep sweep for empty catches, `console.log`, TODO/FIXME/HACK, and
float-based money math.

## P0 findings (real, confirmed by reading the code)

### P0-1 — `pgQuery('BEGIN')` does not create a real transaction
**File**: `src/lib/hr/payrollData.ts:217`, `src/lib/hr/employeeData.ts:211`.

`pgQuery()` (`src/lib/db/index.ts:38`) calls `getPool().query(...)` — the
`pg` `Pool.query()` method acquires a connection, runs ONE statement, and
releases the connection back to the pool immediately. Calling
`await pgQuery('BEGIN')` followed by more `pgQuery(...)` calls does **not**
guarantee those later statements run on the same physical connection under
concurrent load — the pool can (and under `PG_POOL_MAX>1`, will) hand out a
different connection for the next call, so `BEGIN`/`COMMIT` around a payroll
run or employee-history write is **not actually atomic**. This is exactly
RULE-001/RULE-002 territory (payroll postings, employment-history writes).

**Contrast**: `src/lib/masterdata/masterDataData.ts:138`,
`src/lib/import/importData.ts:262/410`, and `src/lib/numbering/
service.ts:90` do this **correctly** — `pool.connect()` → dedicated
`client.query('BEGIN')` → work → `client.query('COMMIT')` → `client.
release()`. This is the established correct pattern already in the
codebase; it is simply not used consistently.

**No shared `withTransaction()` helper exists** — every file that needs a
real transaction hand-rolls the `pool.connect()`/`try`/`finally release()`
scaffolding itself (4 call sites found). This is the P0-1 fix target:
extract one helper, migrate the two broken call sites onto it, and audit
every other multi-statement financial/inventory/approval write for the same
anti-pattern.

### P0-2 — No centralized error catalog
`src/lib/errors/` does not exist. Errors go through `apiError()`
(`src/lib/api/respond.ts:18`), which maps a caught exception to an English
message + HTTP status; there is no `code`/`fa`/`en`/`severity`/`module`
shape, and no single source of truth an API route pulls from. This matches
the master prompt's Phase 7 requirement exactly — genuinely missing, not
partially built.

### P0-3 (verify, not yet confirmed broken) — inventory negative-stock
policy
`stockOps.ts` has GL-posting logic for shrinkage from a *count* variance,
but a dedicated `ALLOW|BLOCK|ALLOW_WITH_APPROVAL` policy read at ISSUE time
across every inventory-consuming path (sales delivery, purchase return,
manual issue) was not confirmed present in this pass — needs a targeted
follow-up read of every call site before claiming a fix, not a rewrite.

## P1 findings

- **No `src/lib/errors/`** bilingual catalog (P0-2 above cascades into
  every module's error UX — counted once at P0, not restated as P1 per
  module).
- Empty `catch {}` blocks: 5 in application code (excluding the huge
  `blogContent.ts` seed-data file, whose 2 matches are inside sample **blog
  post text**, not real code — false positive, verified by reading the
  surrounding content). The 5 real ones are all in `ThemeProvider.tsx`
  (localStorage best-effort) and `HeroCenter.tsx` (video preview
  `currentTime` best-effort) — non-financial, low severity, but still
  violate RULE-005/006/007's spirit of never silently swallowing. Not P0:
  none touch money, inventory, or audit.
- `console.log` usage: exactly 1 file, `src/lib/logger.ts` — this is the
  logger's own internal sink, not a stray debug statement. Not a finding.
- `TODO`/`FIXME`/`HACK`: 0 matches repo-wide. Clean.
- Money arithmetic: `round2()` (`Math.round(n*100)/100`) is used in
  `documents.ts`/`sales.ts` for **display rounding only**, after totals are
  already computed from `numeric`-typed Postgres columns via drizzle/pg
  (which return exact decimal strings, not floats, until JS math is
  applied). This is a real but narrower risk than RULE-019 suggests — needs
  a column-by-column audit of `gl_journal_lines`/`sales_document_lines`
  before claiming "float persistence" is happening (evidence so far shows
  persistence is `numeric`-typed; the risk is in-memory calculation
  precision on large aggregates, not storage).

## What the master prompt assumes is broken but is NOT, per this repo's own
verified history (CLAUDE.md)

The master prompt's Phase 1–5 requirements (atomic GL posting, approval
fail-safe deny-by-default, maker/checker, reversal-not-void, AR/AP≡GL
balance proofs, RBAC tree, negative-inventory-by-default) substantially
**already exist and are live-PG-verified** per this repository's own
governance history — phases 26.9, 26.11, 26.20, 26.23, 26.24b, 26.27, 26.28
specifically. Re-implementing them from the master prompt's spec risks
duplicating or regressing already-verified work. Each phase of this
remediation must **audit first, build only the real gap**, per the
project's own standing rule 4 ("already-exists exception").

## Recommended phase order (real work, smallest safe increments first)

1. **Phase 1a**: extract `withTransaction()` in `src/lib/db/index.ts`,
   migrate `payrollData.ts`/`employeeData.ts` onto it, add a regression
   test proving a mid-transaction failure rolls back fully. This is the
   only confirmed silent-atomicity P0 found this pass.
2. **Phase 1b**: sweep every other `pgQuery('BEGIN'` call site (already
   none exist beyond the two above) and every multi-INSERT financial/
   inventory function for the same anti-pattern, using the new helper.
3. **Phase 7**: bilingual error catalog (`src/lib/errors/`), wired into
   `apiError()` without breaking existing call sites.
4. Subsequent phases per the master prompt's numbering, each audited
   against CLAUDE.md's existing-phase history before writing new code.

## Explicit non-findings (checked, not broken)
- `audit:rbac` gate (159+ routes) already exists and passes.
- `formatCurrency`/`fmtMoney` central formatter already exists
  (`src/lib/format.ts`) — Phase 9's centralization requirement is met.
- Reversal-not-void GL discipline (BUG-020) already exists and is
  regression-tested.
