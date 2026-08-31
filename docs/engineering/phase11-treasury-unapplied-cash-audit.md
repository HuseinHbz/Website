# Phase 11 — Treasury Unapplied Cash, Payment Allocation & Financial Closure

## Baseline

- HEAD at start: `a286b6e` (Phase 10's actual completion commit — the
  prompt's reference SHA `04f537e` was Phase 9's; the repository, not the
  prompt, is authoritative, as in every prior phase).
- Working tree clean. 1328/1328 tests. Typecheck/lint/build clean.
- Governance audits clean (9 audits, 40 RBAC ops, 0 failures).
- 28/28 committed live-PostgreSQL regression suites green, re-confirmed
  before and after this phase's change.

## Discovery — the 15 questions, answered from actual code

1. **Can a supplier payment legally exceed currently-open AP?** Nothing in
   `processPayment` (pre-Phase-11) rejected it — the GL entry always
   posted the full amount regardless of how much could be allocated. So
   yes, structurally, an overpayment could already occur; it just wasn't
   tracked anywhere below the GL.
2. **What did GL posting do when this happened?** Posted `Dr AP (full
   amount) / Cr Bank (full amount)` unconditionally — correct
   double-entry for the CASH movement, but with no subledger detail
   showing that part of it wasn't tied to a specific invoice.
3. **Did the AP subledger preserve the excess anywhere?** No — Phase 10's
   allocation loop only wrote `purchase_payments` rows for amounts it
   could place against an open invoice; anything left over vanished from
   the subledger's view (present only in the aggregate GL, not in any
   per-vendor or per-payment record).
4. **Does `purchase_payments` allow a payment with no invoice?**
   **Yes** — `document_id` is a nullable FK (confirmed in the schema:
   `document_id INTEGER REFERENCES purchase_documents(id)`, no `NOT NULL`).
   This is the key discovery: no schema change is needed.
5. **Does `purchase_documents.paid_total` permit amounts greater than
   invoice total?** No — and this phase does not change that; the
   allocation loop (Phase 10, unchanged) caps each invoice's `paid_total`
   at its own `total`.
6. **Is there an existing vendor-credit/prepayment GL account?** No
   dedicated account exists, and none is needed: the existing `Dr AP/Cr
   Bank` entry already correctly represents the cash movement in
   aggregate; a vendor's own balance (computed by `vendorPosition` /
   `vendorPayable`, summing `purchase_payments.amount` by `vendor_id` with
   **no `document_id` filter**) going negative is the standard, already-
   used-elsewhere convention for "this counterparty is now owed money" —
   the exact same "shown, never floored at zero" principle already applied
   to customer returns/credit balances in this codebase.
7. **Is there an existing Treasury advance model that can be reused?**
   Yes, on the customer side: `receipt_transactions.advance` (Phase 8).
   Reading its actual usage across the codebase (grep confirmed) shows it
   is **written and displayed, but never consumed** — no route, function,
   or UI action anywhere applies a stored `advance` to a later invoice.
   This is a material finding for the design decision (see below).
8. **Should excess cash remain unapplied, become a vendor advance, or be
   rejected?** See Design Decision.
9. **Which accounting entry represents the excess?** None separate from
   the payment's own `Dr AP/Cr Bank` entry — see Q6.
10. **How should a future invoice consume it?** Not answered this phase —
    see Section 6/Future Allocation below.
11. **Partially allocated + partially unapplied?** Fully supported by
    construction: `allocateReceipt`'s `{allocations, advance}` result
    already separates the two; this phase persists both.
12. **Supplier refund/return interaction?** Unaffected structurally — a
    purchase return still reduces AP via the existing credit-note path
    (Phase 4/8, unchanged); an unapplied-cash row is just another
    `purchase_payments` row from the vendor's payment history and is
    already included in `vendorPosition`'s balance the same way any other
    payment is.
13. **What happens if the payment is reversed?** **No reversal mechanism
    exists for `payment_orders` at all** — `canTransitionPayment`'s state
    machine defines `completed: []` (a terminal state with zero outgoing
    transitions), and no route/function anywhere calls `reverseEntry` for
    a Treasury payment. This is a genuine, pre-existing architectural gap,
    **not introduced or fixed by this phase** (building a full Treasury
    payment reversal feature is a materially larger scope than "close the
    unapplied-cash gap" and was not requested as this phase's primary
    objective) — documented as `not_implemented`.
14. **Across fiscal periods?** The unapplied-cash row is inserted inside
    the exact same transaction as the GL post, which already goes through
    `insertPostedEntry` → `assertPostable`. A closed/locked period rejects
    the whole transaction, including the unapplied row — verified live.
15. **What audit trail is required?** The existing route-level
    `treasury.payment.process` `logAction` call (unchanged) already logs
    the full `processPayment` result, which now includes `apAllocations`
    and `unappliedAmount` — no new audit call was needed.

## Design Decision

**Option D (existing-model reuse), narrowly interpreted** — reuse
`purchase_payments.document_id`'s existing nullability, not
`receipt_transactions`' schema shape (that table doesn't apply here; a
Treasury *payment* has no `receipt_transactions`-equivalent row at all,
it only has `payment_orders`). This is a genuine hybrid: the underlying
storage decision (a nullable-document_id subledger row) already exists in
the schema and needed zero migration; the *concept* it represents
(unapplied cash) is the same one Option B describes.

**Future allocation (Section 6) is explicitly NOT implemented.** Reason:
the symmetric, already-shipped customer-side feature
(`receipt_transactions.advance`) has been record-only with **no
consumption path** since Phase 8 (three phases in production). Building a
consumption mechanism for the supplier side while the customer side
remains permanently half-finished would create an unjustified capability
asymmetry with no evidenced product requirement driving it — exactly the
"half-finished advance system" Section 6 itself warns against building.
The honest, evidence-based choice is to bring the supplier side to
**parity** with the existing customer side (record, don't yet consume),
not to leapfrog past it speculatively.

## Schema Decision

**No migration.** `purchase_payments.document_id` was already nullable;
`purchase_payments.gl_entry_id` already existed (Phase 8). Zero new
columns, zero new tables. Confirmed by direct schema inspection before
writing any code (`docs/engineering/phase11-treasury-unapplied-cash-audit.md`
§Discovery Q4).

## Implementation

`processPayment` (`src/lib/treasury/paymentData.ts`): after the existing
Phase-10 allocation loop, any `allocateReceipt`-computed `advance` (money
that couldn't be placed against an open invoice) is now persisted as its
own `purchase_payments` row (`document_id=NULL`, `vendor_id` set, the same
`gl_entry_id`, a descriptive `note`) inside the SAME transaction/lock this
function already had. `vendorPosition`/`vendorPayable` require **zero
code changes** — their existing `SUM(amount) FROM purchase_payments WHERE
vendor_id=$1` (no `document_id` filter) already includes this row
correctly. `processPayment`'s return type gained `unappliedAmount`
(additive, backward compatible with every existing caller).

## Concurrency / Rollback / Reconciliation / Audit / Fiscal Period

See `scripts/verify-phase11-financial-controls.ts` (committed, live-PG)
for executed, evidenced results — summarized in the final phase JSON
report. Every concurrency/rollback claim is backed by an actual
`Promise.allSettled`/forced-failure run against real PostgreSQL.

### P0 defect found and fixed during this phase

Writing the genuine two-distinct-payment concurrency scenario (two
different Treasury supplier payments, same vendor, same single open
invoice, running truly concurrently via `Promise.all`) exposed a real,
pre-existing race: `processPayment`'s advisory lock is keyed by
**payment id** (`treasury_payment_process:${id}`), which correctly
serializes repeat calls against the SAME payment but does **nothing**
to serialize two DIFFERENT payments racing to allocate against the SAME
vendor's open invoices. Under load, both transactions could read an
invoice's pre-race outstanding balance before either committed, each
independently decide how much of their own payment to allocate against
it, and — because each transaction's own `purchase_documents` UPDATE
re-reads `paid_total` fresh immediately before writing (correct for a
single payment, insufficient for two) — the SECOND transaction's
allocation decision (already computed against stale data) could still
drive `paid_total` past the invoice's own total once it was unblocked
by the first transaction's commit. This was reproduced live (observed
`paid_total=1,400,000` against a `1,000,000` invoice) and is a genuine
overpayment defect, not a cosmetic test issue.

**Fix**: a second advisory lock, `treasury_ap_allocate:vendor:${vendorId}`,
taken immediately before the AP-allocation section (after confirming the
vendor exists — see below). This serializes the entire read-decide-write
allocation sequence per vendor, so a second concurrent payment for the
same vendor always sees the first payment's fully committed allocation
before making its own decision. Re-run 3× consecutively plus inside the
full 29-suite regression run: 0 failures.

### Secondary defect found and fixed: FK violation on an unresolvable vendor ref

Phase 9's own committed regression script creates a Treasury payment
with `partyRef: 'vendor:1'` where no vendor with id 1 exists, to
document the (pre-Phase-11) architectural limitation that a payment
with no resolvable AP target simply posts its GL entry and does
nothing else. Phase 11's new unapplied-cash insert broke this: since
`party_ref` is free text (not a real FK), `vendorIdFromPartyRef` will
happily parse a numeric id that does not exist in `purchase_vendors`,
and — because the vendor has zero open invoices — the ENTIRE payment
amount becomes `alloc.advance`, which the new code then tried to
`INSERT` as an unapplied `purchase_payments` row keyed to that
non-existent `vendor_id`, violating `purchase_payments_vendor_id_fkey`.
**Fix**: `processPayment` now confirms the parsed vendor id actually
exists (`SELECT id FROM purchase_vendors WHERE id=$1`) before treating
it as usable for allocation OR unapplied-cash recording; an
unresolvable/stale vendor ref falls back to the pre-existing "nothing to
allocate, GL-only" behavior, unchanged from Phase 10.

## Known Limitations / Remaining Work

- Future-invoice consumption of unapplied supplier cash: not implemented
  (see Design Decision — intentional parity with the customer side, not
  an oversight).
- Treasury payment reversal (of any kind — fully allocated, partially
  allocated, or with an unapplied component): not implemented — no
  reversal mechanism exists for `payment_orders` at all, on either the
  customer or supplier side, pre-dating this phase. Out of this phase's
  scope (a materially larger feature than the unapplied-cash gap it was
  asked to close).
- Advance/unapplied amounts have no dedicated report/UI surface beyond
  what already existed (they appear in `vendorPosition`'s balance and in
  the vendor's `purchase_payments` history like any other payment row);
  a dedicated "vendor prepayment balance" view was not built (not
  requested, and would be premature before a consumption mechanism
  exists to use it).

## Production Readiness

Unapplied-cash recording: implemented, transactional, concurrency-safe,
money-conserving, live-verified. Future consumption and Treasury payment
reversal remain real, honestly-documented gaps — not blocking normal
supplier-payment processing, but relevant to a maintainer deciding
whether prepayments are a business reality this ERP needs to fully close
the loop on.
