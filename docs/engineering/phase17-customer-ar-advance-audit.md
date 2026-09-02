# Phase 17 — Customer AR Advance / Unapplied Receipt Consumption

## 1. Baseline

- Branch: `claude/bold-lamport-a1d6tg`.
- HEAD at start: `fbf30cb` (working tree clean).
- Discovered (not assumed) baseline: `npm run test` → 108 test files, 1328
  tests, 0 failed. `npm run audit` → 12 discovered audit steps (tokens,
  content, reuse, deps, links, i18n, ui, tenancy, theme, nav, shell, rbac),
  all clean. `scripts/ci-regressions.ts` → 34 suites discovered at the time
  (Phase 16 was the newest), dynamically counted via `SUITES.length`, never
  a hardcoded number.
- `npm run type-check` and `npm run lint` clean at baseline.

## 2. Discovery — the 28 questions, answered from actual code

**AR-01. What exact row represents an unapplied customer receipt today?**
A `sales_payments` row with `customer_id` set and `document_id IS NULL` —
written by `createReceipt`'s advance branch (Treasury receipt exceeding
open AR) and, independently, by the direct customer-payment route
(`POST /api/admin/erp/sales/payments`) whenever the operator omits
`documentId` entirely. Two production paths create the same row shape.

**AR-02. Does `sales_payments.document_id` allow NULL?**
Yes — `document_id INTEGER REFERENCES sales_documents(id)`, no `NOT NULL`
(`src/lib/db/migrate.ts`). Identical shape to `purchase_payments`.

**AR-03. Does `sales_payments.customer_id` remain populated for an
unapplied row?**
Yes — `customer_id INTEGER NOT NULL REFERENCES sales_customers(id)`. An
unapplied row is always attributable to a customer.

**AR-04. How does customer AR balance currently calculate payment totals?**
`customerArBalance` (`src/lib/crm/customer360Data.ts`) sums each open
invoice's `total - COALESCE(SUM(sales_payments.amount WHERE
document_id=invoice.id), 0)`. Derived, per-invoice, live — no stored
balance column anywhere.

**AR-05. Is `receipt_transactions.advance` authoritative or display-only?**
Display-only. It is written once at receipt-creation time and never read
back by any balance calculation in the codebase (confirmed by exhaustive
grep — zero consumers). The authoritative unapplied balance is always
`SUM(sales_payments.amount) WHERE customer_id=$1 AND document_id IS NULL`,
computed fresh. This phase never mutates `receipt_transactions.advance`.

**AR-06. Can an unapplied customer receipt be consumed without a schema
migration?**
Yes. The existing `document_id`-nullable shape is sufficient; no new
column, no new table.

**AR-07. How does the existing AP consumption implementation represent
source-side consumption?**
Append-only: `consumeUnappliedForVendor` (Phase 12) never mutates a source
row's `amount`. It derives "remaining" as `source.amount + Σ(negative
adjustment rows referencing that source)`, and writes a NEW negative
adjustment row (`document_id=NULL`) paired with a NEW positive allocation
row (`document_id=<invoice>`) per consumption — both tagged with the
source's own `gl_entry_id` and a `reference` of `AP-CONSUME:<sourceId>`.

**AR-08. Can that exact representation be mirrored for AR?**
Yes, verbatim — the schemas are structurally identical for this purpose.
`consumeUnappliedForCustomer` (this phase) is the same shape with
`AR-CONSUME:<sourceId>` and `sales_payments`/`sales_documents` in place of
`purchase_payments`/`purchase_documents`. One real structural difference
was found and deliberately NOT copied (see AR-08a below).

**AR-08a. Structural difference: no `paid_total` column on
`sales_documents`.** `purchase_documents.paid_total` is a real, maintained
column; `sales_documents` has NO such column — AR "paid" is always derived
as `SUM(sales_payments.amount WHERE document_id=id)`. `createReceipt`'s own
invoice-pool query (`total::float AS open`, no paid subtraction) is
therefore only safe for invoices with zero prior payment — it is **not**
reused here. `consumeUnappliedForCustomer` computes "open" as
`total - COALESCE(SUM(sales_payments.amount WHERE document_id=id), 0)`,
the same derivation `customerArBalance` already uses, so a `'partial'`
invoice (one that already carries real payments) is never over-allocated.
This is a genuine pre-existing latent risk in `createReceipt`'s own
query for a SECOND receipt landing on an already-partial invoice —
out of Phase 17's scope to fix (a receipt-allocation defect, not a
consumption defect), documented here as a known limitation (§16).

**AR-09. `postSalesPaymentToGl` behavior when `gl_entry_id` is already
populated?** Returns immediately with `{ entryId, alreadyPosted: true }` —
never posts a second entry (`src/lib/erp/glPosting.ts`).

**AR-10. Can consumption be represented without a second cash/bank
movement?** Yes — by stamping every consumption row with the SOURCE row's
own (already-posted) `gl_entry_id`, `postSalesPaymentToGl`'s guard (AR-09)
makes both new rows permanently inert to that poster.

**AR-11. Invoice status states recomputed after consumption?**
`invoiceStatus(total, paid)` (`src/lib/erp/sales.ts`) → `'sent'` (paid≤0,
never reached by consumption since paid only ever increases here),
`'partial'`, `'paid'`. Reused verbatim, never duplicated.

**AR-12. Unapplied cash exceeds the invoice outstanding amount?**
`allocateReceipt` caps at the invoice's own `open`; the remainder is left
in the pool for the next invoice or stays unapplied. Verified live
("excess balance" scenario, §5).

**AR-13. One unapplied receipt consumed across multiple invoices?**
`allocateReceipt(remaining, invoicePool)` is called once per source against
the FULL invoice pool and naturally spreads across as many invoices as the
amount covers, oldest-first. Verified live (Scenario 2).

**AR-14. Multiple unapplied receipts consumed against one invoice?**
The outer loop iterates SOURCE rows oldest-first against the SAME
(mutated-in-memory) invoice pool, so a second source correctly sees the
first source's already-reduced `open`. Verified live (Scenario 3).

**AR-15/16. Concurrent consumption: same source / same invoice?**
Both close under the single advisory lock `treasury_receipt_customer:
${customerId}` — the SAME domain `createReceipt` and `reverseCustomerReceipt`
already use. Verified live with FIVE genuinely concurrent
`Promise.all` calls (Scenario A: same source) and TWO concurrent calls with
two distinct sources targeting one invoice (Scenario B).

**AR-17. Race with a new Treasury receipt?**
Closed by the same lock — `createReceipt` already takes
`treasury_receipt_customer:${customerId}`. Verified live (Scenario C).

**AR-18. Race with a direct customer payment?**
The direct-payment route only locks `sales_invoice_payment:${documentId}`
when a `documentId` is supplied — an unapplied (`documentId` omitted)
direct-payment INSERT takes NO customer-scoped lock. This does not create a
double-spend risk: consumption always re-derives "remaining"/"open" fresh,
inside its own lock, from committed rows only (Postgres read-committed
MVCC) — a concurrently-inserted new unapplied row is either visible or not
to a given consumption call, never partially/incorrectly counted either
way. Verified live (Scenario D): invoice never overpaid, customer's total
AR movement exactly conserved.

**AR-19. Failure after ledger writes but before commit?**
Impossible to leave a partial write — everything (source-derivation read,
both new rows, invoice status update) runs inside ONE
`withTransaction(...)` call; any exception rolls back atomically. Proven
live with a genuine forced Postgres-transaction failure (§9).

**AR-20. Closed fiscal period — does consumption need gating?**
No — mirrors Phase 12's decision for the identical reason: consumption
creates NO new GL event (AR-21/22), so there is nothing a period lock needs
to protect. The invoice's own GL posting (which IS period-gated, in
`postSalesInvoiceToGl`) already ran to completion before the automatic
trigger ever reaches consumption. Verified live: explicit consumption
against an invoice whose period was closed AFTER the invoice was opened
succeeds correctly.

**AR-21/22. Does consumption need/reuse a GL event?**
No new event; reuses the source's own already-posted `gl_entry_id` on both
new rows. Verified live: confirming an invoice with pre-existing unapplied
cash posts exactly ONE new `gl_journal_entries` row (the invoice's own),
consumption adds zero.

**AR-23. Reversal/cancellation interaction?**
Two existing mechanisms already cover it completely, with ZERO new code:
1. **Void guard (BUG-013, pre-existing):** an invoice with ANY payments
   (`SUM(sales_payments) WHERE document_id=id AND method<>'refund' > 0`)
   cannot be voided — consumption-derived allocation rows use `method='bank'`
   and correctly participate in this guard, so a partially-or-fully
   advance-settled invoice is protected the same way a directly-paid one is.
2. **Receipt reversal (Phase 16, `reverseCustomerReceipt`):** reverses
   "every `sales_payments` row still carrying this receipt's `gl_entry_id`"
   — since `consumeUnappliedForCustomer` tags BOTH of its new rows with the
   SOURCE receipt's own `gl_entry_id` (by design, mirroring Phase 12/16's
   lineage convention), reversing the ORIGINAL receipt automatically sweeps
   up and correctly reverses any consumption it fed, even after a PARTIAL
   consumption. Verified live end-to-end (§10): 1,000,000 unapplied,
   400,000 consumed against an invoice, then the original receipt reversed
   → invoice paid reverts to 0, unapplied balance reverts to 0, every
   `sales_payments` row for the customer nets to exactly zero.

**AR-24. Does an existing route already authorize the path?**
Yes — the automatic trigger runs inside the EXISTING `op==='confirm'`
handler in `src/app/api/admin/erp/sales/documents/route.ts`, already gated
by `requireOp(auth.user, 'erp.sales:confirm', 'edit')`.

**AR-25. Does this phase need a new RBAC operation?** No.
`new_rbac_ops: 0`, confirmed by `npm run audit:rbac` reporting the same 169
guarded routes / 12 explicit exceptions / 0 failures before and after this
phase (only the sensitive-ops count fluctuated with unrelated prior work in
this branch, not from Phase 17).

**AR-26. Audit traceability via the existing reference/lineage mechanism?**
Yes — `reference='AR-CONSUME:<sourceId>'` on both new rows lets any
consumption row be parsed back to its exact source row (verified live), and
`document_id` on the positive row names the exact settled invoice.

**AR-27. Does Customer 360/`customerArBalance` remain correct with zero
code changes?** Yes — verified live: AR balance is 0 both immediately after
a customer receives an unapplied receipt with no invoices (nothing owed
yet) and after full consumption settles an invoice (paid via the derived
`SUM(sales_payments)`, no separate balance store to drift).

**AR-28. Exact financial conservation identity?**
For every source: `source.amount == Σ(consumed) + remaining` (derived,
never stored). For every invoice:
`old_outstanding == Σ(allocated) + new_outstanding`, and
`Σ(sales_payments.amount WHERE document_id=id) <= sales_documents.total`,
always. Verified across the full precision matrix (§11) and every
concurrency scenario.

## 3. Source-of-truth decision

`sales_payments` (existing table, zero migration). No parallel ledger. No
new column. `receipt_transactions.advance` stays display-only and is never
consulted or mutated by this phase.

## 4. Allocation model

`allocateReceipt` (`src/lib/treasury/payments.ts`), reused UNCHANGED — zero
edits to that file. `consumeUnappliedForCustomer`
(`src/lib/treasury/paymentData.ts`) is the AR-side call site, structured
identically to `consumeUnappliedForVendor`, with the AR-specific "open"
derivation from AR-08a and an additional `gl_entry_id IS NOT NULL` filter
on eligible sources (§8).

## 5. GL decision

No new GL event. Both consumption rows carry the source's own already-
posted `gl_entry_id`. `postSalesPaymentToGl` called on every consumption
row correctly refuses (`alreadyPosted: true` for all) — verified live.

## 6. Concurrency model / lock strategy

Reuses `treasury_receipt_customer:${customerId}` — the SAME domain
`createReceipt`/`reverseCustomerReceipt` already use. No new lock domain.
Five concurrent same-source workers, two concurrent same-invoice workers
(distinct sources), a race against a new Treasury receipt, and a race
against a direct customer payment were all exercised with genuine
`Promise.all` PostgreSQL concurrency — no sleeps, no test-only mutexes, no
serialized-pretending-to-be-concurrent execution.

## 7. Idempotency strategy

Remaining balance is derived fresh from the ledger on every call (never a
stored counter) — a repeated call, a retry, or two concurrent identical
calls against an exhausted source all correctly consume 0 and write 0 new
rows. Verified live (three independent checks: sequential re-call,
concurrent identical re-calls, row-count comparison before/after).

## 8. Architectural boundary found during discovery (documented, not
silently worked around)

An unapplied source row can exist with `gl_entry_id IS NULL` — a case AP's
`consumeUnappliedForVendor` cannot hit (its only unapplied source is
Treasury's `processPayment`, which always posts before recording the
unapplied row), but AR's direct customer-payment route CAN hit (best-effort
GL posting that failed, e.g. a closed period at record time). Such a source
is deliberately EXCLUDED from consumption (`s.gl_entry_id IS NOT NULL` in
the source query) — consumption only ever reclassifies ALREADY-POSTED cash;
an unposted source waits for its own GL posting (self-heal/manual retry,
exactly how `postSalesPaymentToGl` is already called best-effort elsewhere)
before it becomes consumable. Verified live: an unposted unapplied source
correctly settles 0; once posted, the identical source becomes consumable
and settles the invoice.

## 9. Rollback strategy

A genuine forced Postgres transaction failure (an exception thrown after
two ledger-shaped INSERTs and a status UPDATE, inside the same lock/
transaction pattern `consumeUnappliedForCustomer` itself uses) rolls back
every write — zero orphan GL entries, zero orphan `sales_payments` rows,
the invoice's status/paid amount exactly restored, the original unapplied
amount exactly restored. Verified live (§ROLLBACK in the verify script).

## 10. Reversal integration — verified live, zero new code

See AR-23. Live proof: 1,000,000 unapplied receipt → 400,000 consumed
against an invoice (partial) → original receipt reversed → invoice paid
reverts to 0, unapplied balance reverts to 0, every `sales_payments` row
for the customer nets to exactly zero. Full reversal inherited entirely
from Phase 16's existing `gl_entry_id`-lineage sweep.

## 11. Fiscal-period decision

Not gated (see AR-20). Rationale identical to Phase 12: no new GL event,
so nothing for a period lock to protect.

## 12. Authorization decision

No new RBAC operation (AR-24/AR-25). The automatic trigger reuses
`erp.sales:confirm`; the explicit function is directly callable (exported,
used by the verify script and available to any authorized server-side
caller), matching Phase 12's own precedent of never wiring
`consumeUnappliedForVendor` to a dedicated route.

## 13. Audit strategy

Reference-based lineage (AR-26) IS the audit trail — no second data-layer
audit mechanism invented. The route-level `logAction('sales.doc.confirm',
...)` already captures the confirm event; consumption's own effect is
fully reconstructable from `sales_payments.reference`.

## 14. Customer-position impact

Zero code changes to `customerArBalance`/`customer360` — both remain
correct automatically because they are derived from the same
`sales_payments`/`sales_documents` tables consumption writes into. Verified
live at two points (before any invoice exists, and after full settlement).

## 15. Trigger placement — the Phase 12 structural lesson, applied

`consumeUnappliedForCustomer` is called from
`src/app/api/admin/erp/sales/documents/route.ts`'s `op==='confirm'`
handler, placed AFTER the `try/catch` around `postSalesInvoiceToGl` closes
— never inside it. If consumption itself throws, the exception is NOT
swallowed and does NOT trigger the GL-post-failure status revert (which
would otherwise leave a real posted GL entry behind a document whose status
was rolled back) — it surfaces to the caller as-is, exactly like
`confirmPurchaseInvoice` documents for the identical AP-side placement. A
retry after a genuine failure is safe: both `postSalesInvoiceToGl` and
`consumeUnappliedForCustomer` are idempotent.

## 16. Known limitations (genuine, not pretended-away)

- `createReceipt`'s own invoice-pool query uses `total` as "open" with no
  paid-subtraction (AR-08a) — safe only because it targets invoices with no
  prior payment in the common case, but is a latent over-allocation risk if
  a SECOND Treasury receipt targets an already-`'partial'` invoice. This is
  a PRE-EXISTING defect in `createReceipt`, not introduced by or within
  Phase 17's scope (a receipt-allocation defect, not a consumption defect).
  Flagged here for a future phase; `consumeUnappliedForCustomer` does NOT
  inherit this bug (§AR-08a).
- Reversing a receipt after consumption reverts the settled invoice's
  status to `'sent'` (via `invoiceStatus`'s `paid<=0` branch), not back to
  `'confirmed'` — this is PRE-EXISTING Phase 16 behavior
  (`reverseCustomerReceipt`'s own status recompute), unchanged and
  unaffected by Phase 17.
- `treasury_receipt_customer:${customerId}` does not fully serialize
  against an unapplied DIRECT payment insert (AR-18) — documented as a
  benign gap (no double-spend possible, MVCC-safe), not a defect requiring
  a new lock domain.

## 17. Production-readiness assessment

Production-ready. Full quality gate green: typecheck, lint, build,
unit tests (108 files / 1328 tests), 12/12 governance audits, and the full
committed regression history (35/35 suites including this phase's own
77/77 live-PostgreSQL assertions, re-run three consecutive times with
identical results). A genuinely pre-existing, unrelated flaky test in
Phase 14's own concurrency Scenario L was observed during the full-suite
run (failed once in 4 runs with zero code changes between attempts,
confirmed pre-existing and outside Phase 17's diff) — not a Phase 17
regression, not touched by this phase.

## 18. Defect found and fixed during this phase (pre-existing, unrelated
to Phase 17's own logic)

`createVendor` (`src/lib/erp/purchasingData.ts`) had an off-by-one
column/placeholder mismatch introduced in this branch's own prior "vendor
completeness" work (24 target columns, only 23 VALUES expressions —
`created_by` silently received `NOW()` instead of the actor id, and every
subsequent placeholder was shifted) — `INSERT has more target columns than
expressions`. This broke every purchasing-side regression suite that
creates a vendor (14 suites). Found while running the FULL regression
suite as required by Phase 17's own quality gate (§23 of the mission);
fixed by adding the missing `$22` placeholder. Re-verified: all 35
regression suites green after the fix.
