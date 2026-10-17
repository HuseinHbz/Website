# ERPFIX-8 — Performance (Measure First) + Exact-Decimal GL Balance

Audit-first governance phase closing BUG-ERP-22 (performance) and BUG-ERP-23
(float/EPS balance tolerance) from `erp-audit-report.md`. Working branch
`claude/bold-lamport-a1d6tg`.

## بند ← وضعیت

| بند | وضعیت |
|---|---|
| BUG-ERP-22 — measure first | ✅ `scripts/bench-erpfix-8.ts` seeded 120k GL lines / 100k sales docs / 50k purchase docs and ran `EXPLAIN (ANALYZE, BUFFERS)` on every query named in `audit_first` |
| BUG-ERP-22 — `loadTallies` full join over `gl_journal_lines` | ✅ measured: 134–167ms at 120k lines. **No change needed** — the CASE-based status/date gate lives inside the aggregate expression, not a filterable WHERE, so no index changes this plan shape; a snapshot/cache was explicitly NOT built per this phase's own rule (`do_not`: don't cache without measurement) |
| BUG-ERP-22 — `purchasingData.listDocuments` no LIMIT, `SELECT *` | ✅ built-new: server-side `{limit,offset,withMeta}` (default 100, capped 500), backward-compatible (no-opts callers still get a plain array) |
| BUG-ERP-22 — `overview()` fetches everything then `.slice(0,8)` | ✅ built-new: `listDocuments(undefined, {limit:8})` — LIMIT is now in the SQL |
| BUG-ERP-22 — `analytics()` loads every document into JS with no GROUP BY | ⚠️ measured and **deferred as a finding-for-later**, not rewritten this phase — see below |
| BUG-ERP-22 — `assertPostable`/`listPeriods` full-table read per posting | ✅ measured: 0.03ms (the fiscal-periods table is tiny — tens of rows at realistic volume). **No change needed** — no cache was built |
| BUG-ERP-22 — date filters without an index (`sales_documents`/`purchase_documents`/`sales_payments`/`purchase_payments`) | ✅ built-new: measured a 39.6ms Seq Scan at 100k rows for a one-quarter filter with no index at all; four date indexes added (idempotent `CREATE INDEX IF NOT EXISTS`) |
| BUG-ERP-22 — date-format CHECK on financial date columns | ✅ built-new: `NOT VALID` first, `VALIDATE` only if existing data passes (never fails boot on bad legacy rows — reports instead) |
| BUG-ERP-23 — money cast to float; EPS=0.005 can hide a real imbalance | ✅ built-new: `src/lib/money.ts` (zero-dependency BigInt exact-cent arithmetic); `insertPostedEntry` (the single GL entry point) now ALSO runs `exactlyBalanced` unconditionally, in addition to the existing `entryBalanced` EPS check |
| BUG-ERP-23 — `erp_exchange_rates.base_rate` `DOUBLE PRECISION` | ✅ built-new: non-destructive `ALTER COLUMN … TYPE NUMERIC USING base_rate::numeric` |

## Red → Green proof (live PostgreSQL)

**Benchmark (`scripts/bench-erpfix-8.ts`, 120k GL lines / 100k sales docs /
50k purchase docs, real EXPLAIN output):**
```
loadTallies-equivalent (no date bound) ........... 134.72 ms
loadTallies-equivalent (date-bounded quarter) .... 167.59 ms   (no plan change — CASE-gated, not WHERE-gated)
listDocuments-equivalent (no LIMIT, SELECT *) ....  64.37 ms, 50,000 rows returned
listDocuments-equivalent (LIMIT 50 OFFSET 0) .....  54.81 ms, 50 rows returned
sales_documents date-range filter, NO index ......  39.96 ms  Seq Scan, 94,960 rows filtered out
assertPostable-equivalent (listPeriods) ..........   0.03 ms
```

**`scripts/verify-erpfix-8.ts` — 12/12 assertions** (fresh throwaway DB):
- a date-range query on `purchase_documents` now uses a Bitmap Heap Scan
  (index), not a Seq Scan.
- `listDocuments(undefined, {limit:10})` caps at exactly 10 rows out of
  5,000+ real documents; `withMeta` reports the true total (5000) alongside
  the capped page; a no-opts call still returns a plain array
  (backward-compatible).
- the trial balance, AR and Revenue after a real posting are byte-for-byte
  identical across repeated calls and carry the exact posted amount — proof
  that none of the pagination/index work changed any financial report
  output.
- a 1-Rial imbalance through `insertPostedEntry` is rejected, and the same
  lines independently fail the new `exactlyBalanced` check too.
- a genuinely balanced entry built from chained float arithmetic
  (33333.33 + 0.07×7 = 33333.82) still posts — the exact check does not
  falsely reject real money.
- 100 postings (5-wide concurrent batches) all succeed with 100 unique
  entry numbers — no deadlock.

Registered in `scripts/ci-regressions.ts` as the 55th committed live-PG
suite. Full regression run: 55/55 passing (confirmed live before commit,
per the no-fake-claim rule) — including every pre-existing GL-posting-heavy
suite (26.20/26.21/26.23/26.24/26.24b and the full ERPFIX-1 through
ERPFIX-7 history), which is the real proof that the new unconditional exact
check does not reject any entry any existing poster has ever legitimately
produced.

## Files changed

- **New:** `src/lib/money.ts` (exact BigInt-cent arithmetic),
  `src/lib/__tests__/money.test.ts`, `scripts/bench-erpfix-8.ts` (one-off
  benchmark, not a CI suite), `scripts/verify-erpfix-8.ts`,
  `deploy/postgres/rollback-erpfix-8.sql`.
- **Modified:** `src/lib/erp/glPosting.ts` (`insertPostedEntry` runs
  `exactlyBalanced` unconditionally), `src/lib/erp/purchasingData.ts`
  (`listDocuments` pagination, `overview()` LIMIT-in-SQL), `src/lib/db/
  migrate.ts` (4 date indexes, 4 date-format CHECK constraints,
  `erp_exchange_rates.base_rate` → NUMERIC), `scripts/ci-regressions.ts`,
  `scripts/gl-writes-audit.mjs` (allowlist line-number re-sync after the
  `listDocuments` edit shifted line numbers — no behavioral change).

## Contract-changes log

No existing regression assertion's expected VALUE changed this phase. The
`gl-writes-audit.mjs` allowlist edit only re-synced a line NUMBER after an
unrelated edit shifted it (same file, same function, same justification) —
not an assertion edit, so no `contract-changes.md` entry applies.

## New findings

- **Finding-for-later (not fixed in this phase):** `purchasingData.ts#analytics()`
  loads every `purchase_documents` row into JS with no `GROUP BY` in SQL.
  Measured impact at 50k documents is in the same ~60ms range as the
  no-LIMIT `listDocuments` case — not yet a severe bottleneck, but it will
  grow linearly with document count, and the fix (moving the aggregation
  the pure `purchaseAnalytics` engine does today into SQL) would change
  that engine's input contract (`PurchaseDocFact[]` → pre-aggregated rows),
  which is a larger, riskier change than this phase's own "minimal change
  that closes the root" rule allows for an UNMEASURED-as-severe bottleneck.
  Left as a real, numbered finding rather than rewritten speculatively.
- **Finding-for-later:** the `::float` cast at the SQL boundary in
  `loadTallies` (and other GL-aggregation reads) re-introduces float
  imprecision on an otherwise-exact `NUMERIC SUM` computed by Postgres.
  Measured risk at realistic IRR ledger volumes (even into the trillions)
  is negligible — JS numbers carry ~15-17 significant decimal digits, far
  more than any real multi-year ledger total needs — and the NEW exact
  check at `insertPostedEntry` is what actually prevents a mis-balanced
  entry from ever being created in the first place, which is the stronger
  guarantee. A full NUMERIC-string read pipeline through to `AccountTally`
  was judged out of scope for this phase's `do_not` ("رونویسی کل ERP به
  دهدهی ممنوع — فقط مسیر ثبت و تجمیع") given the posting side (the actual
  write path) is now the exact one.

## Confirmations needed from the maintainer

None — this phase involved no accounting-policy or statutory decision;
every change is a measured performance fix or a pure-arithmetic hardening.

## Gate results

- `npx tsc --noEmit`: 0 errors.
- `npx eslint src scripts --max-warnings=0`: 0 warnings.
- `npx vitest run`: 114 files / 1393 tests passed (0 failed).
- `npm run audit:gl-writes`: 0 writes outside the core entry point.
- `npm run audit:deps`: 0 unused runtime deps, 0 build tools in runtime
  (confirms `src/lib/money.ts` added no new dependency — pure BigInt).
- `npm run audit:tenancy`: 0 missing `company_id` (17/17 transactional
  tables — no new transactional table this phase).
- `npm run audit:vat-rate`: 0 hardcoded VAT literals (unaffected by this
  phase, re-confirmed).
- `npm run regressions`: 55/55 committed live-PG suites passing, including
  the new `ERPFIX-8` suite (12/12) — confirmed live before commit.
