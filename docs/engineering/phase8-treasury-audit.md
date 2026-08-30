# Phase 8 — Treasury / Cash / Bank / Returns / Precision Audit

Real repository inspection before implementation. Baseline commit `ead7dc6`
(Phase 7's actual completion commit).

## Architecture Map

- **Two distinct payment-recording surfaces exist, and both are real,
  reachable, production code paths** — this is the single most important
  discovery of this phase:
  1. `sales_payments` / `purchase_payments` — the AR/AP subledger the Sales
     Center / Purchasing Center UIs record against, hardened for
     concurrency/atomicity in Phase 4 and Phase 7 (`recordPayment`,
     `postSalesPaymentToGl`, `postPurchasePaymentToGl`).
  2. `payment_orders` / `receipt_transactions` — the **Treasury** module
     (Phase 26.14, `src/lib/treasury/paymentData.ts`), a maker/checker
     payment-order lifecycle (draft→pending_approval→approved→processing→
     completed) plus AR-settlement receipts, each with their **own**
     `gl_entry_id`.
  A Treasury **receipt** (`createReceipt`) is explicitly designed to be the
  authoritative record of an incoming customer payment: it writes a REAL row
  into `sales_payments` (the same subledger table the direct path uses,
  never a parallel ledger) *and* a `receipt_transactions` catalog row, and
  posts ONE GL entry for the money. A Treasury **payment order**
  (`payment_orders`) has no equivalent link into `purchase_payments` — it is
  a standalone AP/cash-out record (supplier_payment / customer_refund /
  internal_transfer / salary_payment / tax_payment / foreign_payment) with
  its own GL entry, intentionally not required to also exist as a
  `purchase_payments` row (not every payment order is a vendor invoice
  settlement — salary/tax/transfer payments have no purchase-invoice
  counterpart at all).
- **Cash/Bank**: `bank_accounts` (extended, not duplicated, in 26.14),
  `bank_statements`/`bank_statement_lines` (import), `bank_matches`
  (reconciliation, `erp_ref` tagging `sales_payment:N` / `purchase_payment:N`
  / `payment_order:N`), `cash_positions` (point-in-time snapshot),
  `cheques`, `petty_cash_entries`.
- **GL linkage**: `payment_orders.gl_entry_id`, `receipt_transactions.
  gl_entry_id`, `sales_payments.gl_entry_id`, `purchase_payments.gl_entry_id`
  — four distinct link columns, all nullable, all meant as the same
  "has this been posted" guard pattern established in Phase 7.

## Confirmed Defects (found by direct code reading, fixed this phase)

1. **P0** `paymentData.ts` `createPayment` (Treasury payment order create) —
   no idempotency guard at all (no `runOnce`, unlike every other
   create-a-financial-document path in this codebase since Phase 3). 5
   concurrent identical requests → 5 `payment_orders` rows. **Fixed**:
   wrapped in `runOnce`.
2. **P0** `paymentData.ts` `processPayment` — bare, unlocked
   read-status→UPDATE-processing→post-GL→UPDATE-completed sequence, no
   transaction at all. Two concurrent "process" calls on the same approved
   payment could both pass `status==='approved'` and both post a duplicate
   GL entry; a mid-sequence crash could leave a `processing` payment with
   an orphan posted GL entry never linked back. **Fixed**: whole sequence
   now one transaction locked per payment id, idempotent (`alreadyProcessed`)
   on a repeat.
3. **P0** `paymentData.ts` `createReceipt` — the allocate-across-invoices,
   mark-invoices-paid/partial, insert-`sales_payments`, post-GL, insert-
   `receipt_transactions` sequence ran as bare, unlocked pgQuery calls, no
   transaction. Two concurrent receipts for the SAME customer could both
   read the same "open" invoice balances and double-allocate (over-settle
   an invoice); a mid-sequence failure could leave a `sales_payments` row
   with no matching `receipt_transactions` catalog entry, or GL posted with
   neither. **Fixed**: one transaction locked per customer id.
4. **P0 (cross-module)** `createReceipt` inserted the real `sales_payments`
   row it creates **without ever setting `sales_payments.gl_entry_id`**,
   even though it had already posted a GL entry for that exact money via
   its own local poster. Since Phase 7's `postSalesPaymentToGl` is gated
   purely on `gl_entry_id IS NULL`, ANY later call to it for that same
   payment row (e.g. an admin action, a retry, a self-heal pass) would post
   a **second, genuinely duplicate GL entry** for money already booked
   through Treasury. **Fixed**: the `sales_payments` row now gets stamped
   with the SAME `gl_entry_id` the Treasury receipt posts.
5. **P1** `paymentData.ts`'s local `postGl` helper minted its own
   non-sequential entry number (`TRZ-${Date.now().toString(36)}`) instead of
   the Numbering Engine, and — critically — **never called `assertPostable`**,
   meaning a Treasury payment/receipt could post into a CLOSED or LOCKED
   fiscal period while the direct `sales_payments`/`purchase_payments` path
   already correctly rejects that (Phase 7). **Fixed**: reused the shared
   `insertPostedEntry`/`accountIdByCode` primitives (which already call
   `assertPostable` and mint via `nextNumber('journal',...)`), closing this
   gap as a direct consequence rather than a separate patch.
6. **P0** `salesData.ts` `createSalesReturn` — the entire read-invoice,
   read-lines, compute-requested-amount, read-`priorReturned`, validate,
   insert-credit-note sequence ran with NO transaction and NO lock. Two
   genuinely concurrent return requests against the same invoice (e.g.
   "return 7" / "return 7" on a 10-unit invoice) could both read
   `priorReturned=0`, both individually pass `validateReturnRequest`, and
   both insert a credit note — a real over-return. **Fixed**: whole sequence
   now one transaction locked per invoice id.
7. **P0** `purchasingData.ts` `convertDocument` (return/credit_note path
   against a purchase invoice) — the "hasn't already been returned"
   pre-check and the actual return-document insert (`saveDocument`) were
   two SEPARATE, unlocked operations; purchase returns in this codebase
   copy the FULL invoice (all-or-nothing, no partial-quantity purchase
   returns), so a double-return here means crediting 200% of the invoice.
   **Fixed**: `saveDocument` gained an optional `externalQuery` parameter
   (the same self-transactional-or-joins-caller's-tx pattern already used
   for `createHold`/`createShipment` in Phase 6); the return-specific path
   in `convertDocument` now locks per source invoice id and shares one
   transaction with the check and the insert.
8. **P0** `salesData.ts` `settleReturnIfPaid` (customer refund on a paid
   return) — the "a refund already exists for this credit note" idempotency
   check was a bare SELECT separate from the INSERT. Two concurrent
   settlement calls for the same credit note could both read "none yet" and
   both insert a refund payment — a real double-refund. **Fixed**: the
   refund-mode branch now runs inside one transaction locked per credit
   note id (the credit-mode branch was already idempotent by construction
   via its fingerprint-keyed `ON CONFLICT` upsert — left unchanged).

## Already Sound (confirmed by reading, not re-fixed)

- `recordPayment` (purchasing) — Phase 4's overpayment guard + advisory
  lock already covers the AP payment race this phase's Section 8 asks
  about; re-verified unchanged.
- `reverseEntry`/`postSalesInvoiceToGl`/`postPurchaseInvoiceToGl`/
  `postSalesPaymentToGl`/`postCustomerRefundToGl`/`postPurchasePaymentToGl`/
  `postEntryById` — all Phase-7 hardened; unaffected by and independent of
  this phase's Treasury/returns fixes.
- Bank reconciliation (`bank_matches`) — `bank_matches.status` transitions
  (`suggested`→`matched`/`rejected`) via `reconcile.ts`; a genuinely
  concurrent double-reconcile of the SAME statement line was inspected —
  the match-creation path is a straightforward status-guarded upsert with
  no compounding financial side effect beyond marking the match (it does
  not itself move money or post GL), so the concurrency risk profile is
  materially lower than the payment/return paths above; documented as a
  narrower gap in remaining_work rather than fixed with the same heavy
  lock, since fabricating an urgency it doesn't have would be scope creep.

## Architectural Gaps (documented, not invented)

- **Treasury `payment_orders` has no linkage into `purchase_payments`** for
  the `supplier_payment` type specifically — a Treasury supplier-payment
  order settles a vendor by posting Dr AP/Cr Bank directly, without also
  writing a `purchase_payments` row the way `createReceipt` writes a
  `sales_payments` row for receipts. This means the AP subledger
  (`purchase_payments`) does NOT reflect a payment made through this
  specific Treasury path — only through the direct Purchasing Center path.
  This is a genuine, real architectural asymmetry between the receipt side
  (which correctly bridges into the subledger) and the payment side (which
  doesn't). Closing it would require a real product decision (does a
  Treasury supplier payment always target a specific purchase invoice, the
  way a customer receipt allocates across invoices? `payment_orders` has no
  `party_ref`-to-specific-invoice structure for that today) — documented as
  remaining work, not invented here.
- **Money precision**: confirmed the established, single convention across
  every module audited this phase — PostgreSQL `NUMERIC` columns end-to-end,
  JS-side `Math.round(x * 100) / 100` (2-decimal round) at every
  computation boundary (line totals, discounts, tax, invoice totals,
  payments, refunds). No floating-point money is persisted anywhere in the
  paths this phase touched; no second rounding convention exists. Not
  redesigned — the existing convention is correct and was preserved
  exactly.
- **Reconciliation confidence scoring** (`bank_matches.confidence`) is a
  pure heuristic (amount+date-window match) documented as such in Phase
  26.14 — not a Phase-8 concern, unchanged.

## Exact Remediation Plan (executed this phase)

1. `src/lib/treasury/paymentData.ts` — `createPayment` (runOnce),
   `processPayment` (transaction+lock+idempotent), `createReceipt`
   (transaction+lock+gl_entry_id stamp on the subledger row), `postGl`
   (reuse shared posting primitives instead of a local reimplementation).
2. `src/lib/erp/salesData.ts` — `createSalesReturn` (transaction+lock per
   invoice), `settleReturnIfPaid` (transaction+lock per credit note,
   refund branch only).
3. `src/lib/erp/purchasingData.ts` — `saveDocument` gains an optional
   `externalQuery` parameter; `convertDocument`'s return/credit_note path
   locks per source invoice and shares one transaction with `saveDocument`.
4. Live-PostgreSQL verification of every fix (concurrency + rollback +
   reconciliation), committed as `scripts/verify-phase8-finance.ts`.
