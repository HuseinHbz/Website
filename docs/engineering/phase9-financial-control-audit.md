# Phase 9 — Treasury ↔ AP Integration, Bank Reconciliation & Financial Control Closure

Real repository inspection before implementation. Baseline commit `1945dbe`
(Phase 8's actual completion commit).

## Treasury ↔ AP (Section 2 — answered from the code, not invented)

1. **Does `supplier_payment` always target one purchase invoice?** No.
   `payment_orders.party_ref` is a free-text tag (`vendor:5`) identifying
   the VENDOR, not an invoice. There is no `purchaseDocumentId`/`invoiceIds`
   field anywhere in `PaymentInput` or the `payment_orders` schema.
2. **Can one supplier payment settle multiple invoices?** Architecturally
   plausible at the vendor level, but no allocation logic exists for
   payments the way `allocateReceipt` exists for receipts.
3. **Can one invoice be partially paid?** Yes — via the direct
   `purchasingData.recordPayment` path (Phase 4/5/7/8-hardened). NOT via
   Treasury, which has no invoice-level concept at all for payments.
4. **Is allocation already represented elsewhere?** Yes, asymmetrically:
   `ReceiptInput.invoiceIds` + `allocateReceipt` exist for the RECEIPT
   (customer) side; nothing symmetric exists for the PAYMENT (supplier)
   side.
5. **Does `purchase_payments` represent allocation or merely events?**
   Each `purchase_payments` row already carries `document_id` (allocated
   at creation time, one row = one invoice) — a different shape from the
   receipt model's post-hoc allocation.
6. **Does Treasury already contain enough information to determine AP
   allocation?** No. `party_ref='vendor:N'` identifies only the vendor.
   There is no signal anywhere in a `createPayment` call for WHICH
   invoice(s) of that vendor the money should apply against.
7. **Existing relationships?** `payment_orders` → vendor (weak, via a
   parsed string, not a FK) → GL (real, its own entry) → nothing → nothing.
   No FK to `purchase_documents`, no FK to `purchase_payments`.

**Conclusion, per the phase's own explicit instruction:** the business
model does NOT support a deterministic Treasury-payment → specific-invoice
relationship today — building one would require inventing a NEW input
field (which invoice(s) to apply against) and a NEW allocation algorithm,
which is a real, undecided product decision, not "using information the
system already has." **Not implemented.** System behavior is unchanged;
the limitation is proven by a live regression test (a Treasury
`supplier_payment` posts its own GL entry correctly but intentionally
creates NO `purchase_payments` row and reduces NO specific invoice's AP —
verified in `scripts/verify-phase9-financial-controls.ts`).

**If this gap is ever closed**, the correct model (for the maintainer to
decide, not assumed here) would most likely mirror the receipt side:
`PaymentInput` gains an optional `invoiceIds`, a pure `allocatePayment`
engine (symmetric to `allocateReceipt`), and `createPayment`/`processPayment`
write real `purchase_payments` rows per allocated invoice inside the
existing locked transaction.

## Bank Reconciliation (Section 3)

`confirmMatch` (`src/lib/treasury/bankOpsData.ts`) ran as two bare,
unlocked statements (INSERT `bank_matches`, then UPDATE
`bank_statement_lines.status`) with **no transaction and no "already
matched" guard**. Confirmed real defects:
- Two concurrent `confirmMatch` calls on the SAME line could both insert a
  match row and both flip the line — worse, a line already matched to one
  ERP reference could be silently RE-matched to a different one (a
  contradictory final state, Scenario D's exact concern).
- No transaction: a crash between the two statements could leave
  `bank_matches` saying "matched" while `bank_statement_lines.status`
  stayed `unmatched`.

**Fixed**: whole check-insert-update sequence now runs inside one
transaction locked per statement-line id
(`bank_stmt_line_match:{lineId}`); a line already `status='matched'`
returns the EXISTING match deterministically (`alreadyReconciled: true`)
instead of creating a second, possibly-contradictory one. A **rejected**
suggestion intentionally does NOT flip `bank_statement_lines.status` (this
is established, documented behavior from Phase 26.32 بند۴ — a rejection is
logged to the audit trail so it isn't re-suggested by a smarter future
scorer, but the line itself stays `unmatched` and available for a
different, correct match) — preserved exactly, not changed.

**Scenario C ("wrong account")**: `confirmMatch` takes only `lineId` +
`erpRef`, not an `accountId` — there is no cross-account mismatch to
reject at this layer (a statement line already belongs to exactly one
account via its own row; there is no "confirm against a different
account" operation anywhere in the API). Not a gap — the scenario doesn't
apply to how this system models the operation.

## Returns / Refunds (Sections 5, 11)

Already hardened in Phase 8 (`createSalesReturn`, `convertDocument`'s
purchase-return path, `settleReturnIfPaid`) — re-verified this phase with
the SAME live-concurrency methodology as the committed Phase-8 suite,
folded into this phase's own new script rather than duplicated wholesale
(Phase 8's suite still runs in CI unchanged).

## Audit Integrity (Section 6)

- `treasury.recon.*` (bank reconciliation) — **route-level** `logAction`,
  called once after `confirmMatch` returns; `confirmMatch`'s new
  `alreadyReconciled` idempotent-return still lets the route continue to
  `logAction` unconditionally today (a replayed "confirm" on an
  already-matched line still logs a "confirm" audit event, since the
  system correctly recognizes it as a deliberate operator action −
  "I confirm this is/isn't a match" − rather than an accidental network
  retry the way a payment double-submit is). This is intentional,
  documented here rather than silently changed: reconciliation is a human
  review decision made once per statement line in the UI, not a
  double-click-prone financial mutation like a payment amount — the
  existing route-level audit call was left as is.
- `treasury.payment.process` / `treasury.receipt.create` / sales-return /
  purchase-return / refund audit call sites are unchanged this phase
  (Phase 8 already verified their concurrency-safety at the data layer;
  this phase did not add or remove any `logAction` call).

## Money Precision (Section 4)

Confirmed, by reading every path touched in Phases 7/8/9: PostgreSQL
`NUMERIC` columns end-to-end, `Math.round(x * 100) / 100` (2-decimal
round) at every JS-side computation boundary — the SAME single convention
everywhere, no drift, no second policy. Codified in a dedicated test
matrix this phase (`scripts/verify-phase9-financial-controls.ts` +
existing pure-engine unit tests) rather than changed.

## Fiscal Period / Rollback / Concurrency Matrix

Covered by `scripts/verify-phase9-financial-controls.ts` (Section 13),
described in the phase's live-verification results.

## Architectural Gaps (summary)

1. **Treasury supplier-payment ↔ specific-invoice allocation**: not
   implemented — genuinely undecided product model, documented above,
   proven-as-a-limitation by a live regression test.
2. Everything else audited this phase (bank reconciliation, returns,
   refunds, precision, fiscal periods) had confirmed, fixable defects and
   was fixed; no other undecided business model was found.
