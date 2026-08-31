# Phase 12 — Supplier Unapplied Payment / Prepayment Consumption

## Baseline

- HEAD at start: `e7aaeb7` (Phase 11's actual completion commit).
- Working tree clean. 1328/1328 tests. 29/29 committed regression suites
  (re-confirmed live before touching any code).
- Typecheck/lint/build clean.

## Discovery — the 15 questions, answered from actual code

**Q1. Can an unapplied purchase_payment safely exist with document_id=NULL?**
Yes — established in Phase 11. `purchase_payments.document_id` is a
nullable FK (`document_id INTEGER REFERENCES purchase_documents(id)`, no
`NOT NULL`), and Phase 11 already writes such rows for Treasury
overpayments. Confirmed unchanged in `src/lib/db/migrate.ts`.

**Q2. Does vendorPosition already include it?**
Yes, with zero code required. `vendorPosition` (`src/lib/erp/purchasingData.ts`)
computes `paid = SUM(amount*exchange_rate) FROM purchase_payments WHERE
vendor_id=$1` — no `document_id` filter. Any row this phase adds (positive
or negative) is automatically reflected in the vendor's AP balance the
instant it commits.

**Q3. How is the remaining unapplied balance calculated?**
Derived, never stored: `SUM(amount) FROM purchase_payments WHERE
vendor_id=$1 AND document_id IS NULL`. Phase 11 wrote only positive rows
here; this phase adds negative "consumed" rows to the same query surface
(see Q10) rather than mutating the original row's `amount` — the codebase's
established append-only discipline for financial ledger rows (the same
principle rule 11/CC-family already enforces for GL reversing entries:
never rewrite a posted row's value, post an offsetting one instead).

**Q4. Can one unapplied payment be consumed across multiple future invoices?**
Yes by design — `consumeUnappliedForVendor` calls `allocateReceipt(sourceRemaining,
openInvoices)` per source row, which already splits one pool across many
targets oldest-invoice-first (verified live, Scenario B).

**Q5. Can multiple unapplied payments be consumed against one invoice?**
Yes — the outer loop iterates unapplied SOURCE rows oldest-first; each
source's own `allocateReceipt` call re-reads the (locally tracked, already
partially consumed) invoice pool, so a single invoice can receive
allocations from several distinct source rows in one run (verified live,
Scenario C).

**Q6/Q7. Concurrent consumption / concurrent consumption vs a new Treasury
payment being processed for the same vendor?**
Both are serialized by the SAME advisory-lock key Phase 11 already
established for its own AP-allocation section:
`treasury_ap_allocate:vendor:${vendorId}` (`pg_advisory_xact_lock`).
`consumeUnappliedForVendor` takes this exact key before reading any
source/invoice state — deliberately the same lock domain as
`processPayment`'s AP-allocation block, not a new one, so a Treasury
payment and a consumption run for the same vendor can never interleave
(verified live, Scenarios D/E/F).

**Q8. What happens if invoice cancellation occurs after an unapplied
payment has been consumed?**
`voidPurchaseInvoice` (`purchasingData.ts`) reverses the invoice's own GL
entry (`reverseEntry`) but does **not** touch `purchase_payments` rows or
`paid_total` at all — this is a pre-existing gap that predates this phase
(voiding an already-partially-paid invoice of ANY kind, not just one paid
via consumption, does not currently reverse the payment side). This phase
does not introduce a new failure mode here: the consumption rows
(negative source adjustment + positive invoice allocation) remain exactly
as correct/incorrect as any other `purchase_payments` row against a
voided invoice would be. Building payment-reversal-on-void is out of this
phase's scope per the master prompt's explicit scope rule (Section 15) —
documented as `not_implemented / architectural gap`, inherited from
before this phase, not created by it.

**Q9. What is the correct accounting identity for consumption?**
`source.amount == Σ(negative adjustment rows referencing that source) +
remaining`, and for each invoice touched, `new_paid_total == old_paid_total
+ Σ(positive allocation rows for that invoice in this run)`. Vendor-level:
consumption's net effect on `SUM(purchase_payments.amount)` for the vendor
is exactly **zero** (a `-X` row and a `+X` row inserted together) — it only
ever moves money between the "unapplied" bucket and a specific invoice's
bucket, never creates or destroys it. Verified live (money-conservation
assertions, Section 10/13 of the verify script).

**Q10. Can this be implemented without schema migration?**
Yes — confirmed before writing any code. No new column, no new table.
Both new row kinds reuse `purchase_payments.document_id`'s existing
nullability, `amount`'s existing sign-agnostic NUMERIC type (already used
for negative correction amounts nowhere else, but nothing in the schema or
any query assumes `amount >= 0` — checked: no CHECK constraint on `amount`
in `purchase_payments`), and the existing free-text `reference` column
(reused as the negative→positive linking key, `AP-CONSUME:${sourceId}`,
rather than adding a new FK column).

**Q11. Is there already a reusable allocation engine that should be
extended rather than duplicated?**
Yes — `allocateReceipt(amount, targets)` (`src/lib/treasury/payments.ts`),
already used by both the customer-receipt path and Phase 10's Treasury
supplier-payment path. It is symmetric in shape (distribute one pool
across many capped targets, oldest-first) and needed **zero changes** —
`consumeUnappliedForVendor` calls it once per unapplied source row, which
correctly produces both "one-to-many" (Q4) and, via the outer per-source
loop, "many-to-one" (Q5) distributions without any new allocation
algorithm.

**Q12. Is a separate "prepayment" GL account required, or does the
existing AP model intentionally represent the amount directly through
purchase_payments?**
No new account. The vendor's AP position (`vendorPayable`) is computed
from `invoicedTotal - paidTotal - creditNotesTotal` — a single aggregate
that does not care how `paidTotal` is distributed between "against a
specific invoice" and "unapplied". The GL's Accounts Payable control
account already reflects the correct total the instant the original
Treasury payment posts (Phase 11); consumption is a pure subledger
reclassification with **no** GL-account-level effect (see Q13/Section 8
below) — there is no accounting reason to introduce a distinct prepayment
account.

**Q13. Is Treasury reversal required for correctness of this phase, or
can it remain explicitly out of scope?**
Out of scope — confirmed by tracing every code path this phase touches.
Consumption reads/writes only `purchase_payments` and
`purchase_documents.paid_total/status`; it never calls
`postPurchasePaymentToGl`, `reverseEntry`, or any Treasury payment-order
mutation. `canTransitionPayment`'s `completed: []` (still, unchanged) means
no reversal transition exists on the Treasury side at all — exactly the
Phase 11 finding, untouched by this phase. Nothing in this phase's design
depends on payment reversal existing.

**Q14. What audit event should represent consumption?**
`confirmPurchaseInvoice`'s existing route-level `logAction` call (the
route this function is called from) already captures the return value of
`confirmPurchaseInvoice`, which now transitively triggers consumption as
part of the same call — no separate `logAction` call was added inside the
data layer (this codebase's established convention: audit logging lives
at the route layer, not deep in `*Data.ts` functions — confirmed by
grepping for `logAction` calls across `purchasingData.ts`: none exist
there today, including in `confirmPurchaseInvoice` itself). The
consumption detail (`{sourceId, invoiceId, amount}[]`) is fully
reconstructable from the `purchase_payments` rows' own `reference` column
(`AP-CONSUME:<sourceId>`) — a complete, permanent, queryable audit trail
without a parallel audit mechanism.

**Q15. What should happen when an unapplied payment is greater than the
invoice balance?**
Exactly what `allocateReceipt` already does for every other allocation in
this codebase: cap at the invoice's open balance, leave the remainder
unconsumed (still available for the next open invoice, or left unapplied
if none exists) — verified live (Scenario A, an unapplied balance larger
than the single available invoice).

## Design Decision

**Reuse, no migration, no new GL event.** Consumption is represented as a
matched pair of new `purchase_payments` rows per allocation step (a
negative source-side adjustment + a positive invoice-side allocation),
both carrying the source row's own pre-existing `gl_entry_id` — this is
the schema-safe encoding that avoids inventing a hidden convention: it is
just the SAME representation Phase 11 already established
(document_id-nullable rows read by the SAME unfiltered vendor-balance
query), applied twice per consumption step instead of once, linked by the
existing `reference` column. No new column was needed because nothing in
the existing schema prevented a negative `amount` or constrained
`reference`'s content.

## Section 8 — GL decision

**Option A: no new GL event.** Traced `postPurchasePaymentToGl`
(`src/lib/erp/glPosting.ts`): it treats `gl_entry_id IS NULL` as "an
unposted real cash payment" and will post a brand-new `Dr AP / Cr Bank`
entry for such a row. Since consumption creates NO new bank movement (the
cash already moved when the original Treasury payment posted), leaving
the new rows' `gl_entry_id` NULL would let that poster later create a
**phantom duplicate cash-out entry** — a real defect this phase's design
had to avoid, not by adding a guard, but by simply stamping both new rows
with the source row's own already-posted `gl_entry_id` (they are
correctly "already posted" from that poster's point of view). Verified
live: calling `postPurchasePaymentToGl` on either of the two new rows
after a consumption run returns `alreadyPosted: true`, zero new GL
entries, trial balance unchanged before/after consumption.

## Risks / honest limitations

- Invoice cancellation after consumption does not reverse the consumed
  payment rows (Q8) — pre-existing gap, not created by this phase, out of
  scope per the master prompt.
- Consumption triggers automatically on `confirmPurchaseInvoice` (a
  freshly-open invoice is exactly the "future invoice" scenario) but is
  also exported and independently callable/idempotent — there is no admin
  UI action for an operator to manually trigger a settlement run outside
  invoice confirmation; not requested this phase.
- `consumeUnappliedForVendor`'s failure is NOT swallowed inside
  `confirmPurchaseInvoice` — it is deliberately placed OUTSIDE the
  GL-post try/catch so a consumption defect cannot trigger an incorrect
  status-revert on an invoice whose GL entry already posted successfully
  (this asymmetry was verified deliberately, not accidental).
