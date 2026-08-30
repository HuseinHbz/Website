# Phase 7 — Finance ↔ AR ↔ AP ↔ GL ↔ Tax Audit

Real repository inspection before implementation. Baseline commit `3298bdc`
(Phase 6's actual completion commit).

## Architecture Map

- **GL**: `gl_accounts` (chart, seeded standard codes), `gl_journal_entries`
  (draft/posted/void, `reversal_of`/`reversed_by` two-way link),
  `gl_journal_lines`, `gl_fiscal_periods` (open/closed/locked, kind
  year|period, hierarchy via `parent_id`). Pure engine `src/lib/erp/
  ledger.ts` (`entryBalanced`, `trialBalance`, `isJournalEntryDeletable`).
  Shared posting primitives `src/lib/erp/glPosting.ts` (`loadGlMap`,
  `applyGlMap`, `insertPostedEntry`, `accountIdByCode`, `postEntryById`,
  `reverseEntry`, `postSalesPaymentToGl`, `postCustomerRefundToGl`,
  `postPurchasePaymentToGl`).
- **AR**: `sales_documents`/`sales_document_lines` (unified quote/order/
  invoice/credit_note/debit_note) + `sales_payments`. Invoice confirm →
  `postSalesInvoiceToGl` (Dr AR/Cr Revenue/Cr VAT). Payment → `postSalesPaymentToGl`
  (Dr Bank/Cr AR). Return/refund → `createSalesReturn`/`settleReturnIfPaid`/
  `postCustomerRefundToGl` (Dr AR/Cr Bank for the refund).
- **AP**: `purchase_documents`/`purchase_document_lines` (unified PR/RFQ/
  quotation/PO/receipt/invoice/return/credit_note) + `purchase_payments`.
  Confirm → `confirmPurchaseInvoice` → `postPurchaseInvoiceToGl` (Dr
  Inventory/Dr Tax/Cr AP). Payment → `recordPayment` → `postPurchasePaymentToGl`
  (Dr AP/Cr Bank), gated by the Phase-5 three-way-match payment gate.
- **Cash/Bank**: `bank_accounts`/`bank_statement_lines`/`cheques`/
  `petty_cash_entries` (Treasury, Phase 26.14) — payment posting uses the
  mapped `gl_map_bank` account (erp_settings), not a hardcoded account code.
- **Tax**: `src/lib/erp/tax.ts` — pure `computeTaxes`/`extractInclusive`/
  `vatOf`, seeded `IRAN_VAT` (9%). Line-level `tax_pct` on both sales and
  purchase lines, document-level `tax_total` aggregated. GL VAT account
  `2100` (Taxes Payable) — reused via `gl_map_vat`, not hardcoded.
- **Fiscal periods**: real (`gl_fiscal_periods`, open→closed→locked),
  enforced by `assertPostable(date)` (`src/lib/erp/accountingData.ts`) on
  every posting path — already audited/hardened in Phase 26.9.
- **Idempotency/locking helpers**: `withTransaction()` (`src/lib/db/
  index.ts`), `pg_advisory_xact_lock(hashtextextended($1,0))` (the
  established per-entity lock pattern, used throughout Phases 2–6),
  `runOnce()` (`src/lib/api/idempotency.ts`, double-submit guard).

## Confirmed Defects (found by direct code reading, fixed this phase)

All five are the SAME root-cause class: a `gl_entry_id IS NULL` (or
`reversed_by IS NULL`) existence/idempotency pre-check ran as a bare read
**outside** any transaction or lock, before the actual insert (which itself
correctly ran inside `withTransaction`). Two genuinely concurrent calls for
the SAME source id could both pass the pre-check and both post — a real
duplicate/orphan GL entry, not merely a theoretical risk (every GL-posting
path in this codebase is reachable from a user-facing confirm/pay/void
action that can be double-clicked or retried).

1. **P0** `reverseEntry` (`glPosting.ts`) — two concurrent void/reverse calls
   on the same posted entry could both create a full reversal entry, with
   the second overwriting the first's `reversed_by` link. Net effect: the
   original's financial effect gets reversed TWICE while only one reversal
   stays linked — a genuine, silent double-reversal. **Fixed**: whole
   check-insert-link sequence now runs inside one transaction locked per
   entry id (`gl_entry_reversal:{id}`).
2. **P0** `postSalesInvoiceToGl` (`salesData.ts`) — concurrent invoice
   confirms/re-posts could double-post revenue/AR/VAT for the same
   invoice. **Fixed**: re-verified `gl_entry_id` inside a per-document lock
   (`sales_doc_gl_post:{id}`).
3. **P0** `postPurchaseInvoiceToGl` (`purchasingData.ts`) — same class on
   the AP side. **Fixed**: locked per document (`purchase_doc_gl_post:{id}`).
4. **P1** `postSalesPaymentToGl`/`postCustomerRefundToGl` (`glPosting.ts`)
   — concurrent GL-posting of the same payment/refund row could double-post
   the cash movement. **Fixed**: locked per payment id
   (`sales_payment_gl_post:{id}`).
5. **P1** `postPurchasePaymentToGl` (`glPosting.ts`) — same class on the AP
   side. **Fixed**: locked per payment id (`purchase_payment_gl_post:{id}`).
6. **P2** `postEntryById` (`glPosting.ts`) — the manual journal "post"
   action itself was a bare read-then-write with no lock. Posting doesn't
   create a duplicate financial event (it only flips an existing balanced
   entry's status), but the check-then-act race let two concurrent posts
   both run the route's approval-gate/audit side effects as if each were
   the real transition. **Fixed**: locked per entry id
   (`gl_entry_post:{id}`), now returns `alreadyPosted` so callers can tell
   a replayed no-op from a real transition.

## Already Implemented / Verified Sound (not re-fixed, confirmed by reading)

- **Journal create (POST /finance/journal)** — already transactional,
  `runOnce`-guarded, `didWrite`-gated audit (Phase 26.25b/26.26). No defect
  found; not modified.
- **Journal update (PUT op=update)** — draft-only, transactional header+line
  replacement. No defect found.
- **Journal void guard** — `reversedBy`/`reversalOf` pre-checks at the route
  layer are now backed by the fixed, locked `reverseEntry`, so the race the
  route-level check alone could not close is closed at the source.
- **Maker/checker (`makerCheckerGate`)** — routes through the existing
  approval engine (`createApprovalRequest`), which was already hardened
  for concurrency/SoD in Phase 2/2B. Not re-implemented (no second approval
  system).
- **`assertPostable`** (fiscal period gate) — already checks status
  open/closed/locked and rejects a backdated post into a closed period;
  called by every posting path audited above. No architectural gap found.
- **Three-way-match payment gate (Phase 5)** — unaffected by this phase's
  lock additions (the gate itself already ran inside `recordPayment`'s own
  locked transaction).
- **Sales/purchase return guards (BUG-013 class)** — already prevent
  double-return (cumulative-return-vs-invoice-total check) and paid-invoice
  void; not re-implemented, only exercised as part of live verification.

## Architectural Gaps (documented, not invented)

- **Purchase invoice void has no reversal-lock hardening equivalent to
  `reverseEntry`** — `voidPurchaseInvoice` calls the now-fixed shared
  `reverseEntry`, so it inherits the fix; no separate purchase-side
  reversal path exists to audit.
- **No dedicated cash/bank "reconciliation statement vs GL" automated
  check exists beyond Treasury's own statement-import matching (Phase
  26.14)** — this phase reconciles payment-subledger totals against GL
  bank-account movement directly (Section 6 of the master prompt), which
  is a different, narrower check than Treasury's bank-statement matching;
  both are legitimate and neither replaces the other.
- **No configurable tax-rounding-tolerance setting exists** — tax rounding
  uses plain `round2`-style arithmetic throughout (consistent with Phase 5's
  finding that no tolerance mechanism exists anywhere in this codebase);
  not invented here either.

## Out of Scope (per the phase's own instruction not to re-litigate prior phases)

- Phase 2B approval/maker-checker internals — reused as-is.
- Phase 3/3B sales credit-limit/overpayment concurrency — reused as-is,
  re-verified only as part of the master reconciliation run, not re-audited
  line by line.
- Phase 4/5 procurement/three-way-match — reused as-is.
- Phase 6 sales↔inventory↔fulfillment — reused as-is, preserved unchanged.
