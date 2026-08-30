# Phase 10 — Enterprise AP Settlement, Financial Controls & End-to-End Reconciliation

## 1. Baseline

- HEAD at start: `04f537e` (Phase 9's actual completion commit — the
  prompt's reference SHA `ead7dc6` was Phase 7's commit; the repository,
  not the prompt, is authoritative, matching the pattern of every prior
  phase in this program).
- Working tree: clean.
- Unit tests: 1328/1328 passing.
- Typecheck: clean. Lint: clean. Build: clean.
- Governance audits: all clean (9 audits, 40 RBAC sensitive ops, 169
  guarded routes, 0 failures).
- Committed live-PostgreSQL regression suites: 27/27 green, re-confirmed
  BEFORE any Phase 10 code change and again AFTER.

## 2. Existing Architecture (confirmed by reading, not assumed)

- Treasury `payment_orders`/`receipt_transactions` (Phase 26.14), hardened
  for concurrency/atomicity in Phase 8, fiscal-period-gated via the shared
  `insertPostedEntry` in Phase 8, bank reconciliation (`bank_matches`)
  hardened in Phase 9.
- Procurement AP (`purchase_documents`/`purchase_payments`) hardened for
  concurrency in Phase 4/5/7/8; three-way match in Phase 5.
- Sales AR (`sales_documents`/`sales_payments`) hardened in Phase 3/6/7/8.
- GL (`gl_journal_entries`/`gl_journal_lines`) hardened for duplicate-post
  concurrency in Phase 7.

## 3. Supplier-Payment ↔ AP Analysis (Section 2's 10 questions, answered from code)

1. **Can a Treasury supplier payment identify exactly one purchase
   invoice?** Not structurally by itself (`party_ref` is vendor-level:
   `vendor:N`) — but once the vendor is known, its open invoices are
   queryable.
2. **Can it safely identify multiple invoices?** Yes — nothing prevents
   allocating one payment across several of the same vendor's open
   invoices, exactly like the receipt side already does.
3. **Does an existing API already expose invoice allocation?**
   Yes, on the RECEIPT side (`ReceiptInput.invoiceIds` + `allocateReceipt`,
   Phase 8). Nothing existed on the payment side before this phase.
4. **Is there an existing allocation engine that can be reused?** Yes —
   `allocateReceipt` (`src/lib/treasury/payments.ts`) is already fully
   generic (`amount` + a list of `{id, open}` → oldest-first allocation +
   leftover). It is not sales-specific in any way. **Reused directly,
   unchanged — no second allocation engine was written.**
5. **Can partial payment be represented?** Yes —
   `purchase_documents.paid_total` already exists and is exactly what
   `recordPayment` (the direct path) already maintains; this phase reuses
   the identical column and the identical `purchaseInvoiceStatus`-style
   threshold logic.
6. **Can overpayment be represented?** The allocation itself is capped at
   each invoice's real `(total - paid_total)` — an invoice can never be
   allocated more than its outstanding balance. Money the vendor's open
   invoices can't absorb (payment amount exceeds total open AP) is left
   unallocated (mirrors the receipt side's `advance` concept, which
   Treasury `payment_orders` has no column for — documented below as a
   narrower, pre-existing asymmetry, not invented or fixed this phase).
7. **Can a payment be split across multiple invoices?** Yes, by
   construction of `allocateReceipt`.
8. **What happens with multiple unpaid invoices for one vendor?** Oldest
   date first, same discipline as receipts.
9. **Is vendor identity a real FK or only a string?** Only a string
   (`party_ref`) parsed defensively (`/^vendor:(\d+)$/`) — an unparseable
   or missing ref means "no vendor identified, allocate nothing," never a
   guess.
10. **Can allocation be deterministic without inventing accounting
    rules?** Yes — it reuses the exact same, already-shipped, already-
    tested allocation algorithm and the exact same paid_total/status
    semantics the direct purchasing path already uses. No new business
    rule was invented; the SAME rule was extended to a second call site.

**Decision: implemented** (Section 3 applies — the model already supports
this deterministically). `processPayment` now, for `payment_type=
'supplier_payment'` with a resolvable vendor, allocates the payment across
that vendor's open invoices inside the SAME locked transaction that already
posts the GL entry — one commit covers the status transition, every
allocated `purchase_payments` row (each stamped with the SAME `gl_entry_id`
the Treasury payment posts, closing the identical cross-module double-post
risk Phase 8 closed for receipts), each invoice's `paid_total`/status
update, and the GL post.

## 4. Defects Discovered This Phase

None beyond the Treasury↔AP gap itself (which was an architectural gap,
not a code defect — Phase 9 already correctly classified it as such).

## 5. Architectural Gaps (remaining, documented not invented)

- Treasury `payment_orders` has no `advance`/overpayment-carry-forward
  column the way `receipt_transactions.advance` does — a supplier payment
  larger than the vendor's total open AP simply leaves the excess
  unallocated (still posted to GL as a cash outflow and an AP debit, just
  not tied to a specific invoice). This mirrors a real accounting
  question (is unapplied vendor cash a prepayment asset or a credit
  memo?) that the receipt side answered for customers but the payment
  side has never answered for vendors — a genuine, undecided product
  decision, not fixed here.

## 6. Changes Implemented

- `src/lib/treasury/paymentData.ts`: `processPayment` allocates supplier
  payments across open purchase invoices (see §3), reusing
  `allocateReceipt` unchanged.

## 7–13. Concurrency / Rollback / Reconciliation / Audit / Precision / Authorization

See `scripts/verify-phase10-financial-controls.ts` (committed, live-PG) for
the executed, evidenced results — summarized in the final phase JSON
report. Every claim below is backed by an actual run against real
PostgreSQL, not a sequential simulation.

## 14. Remaining Work

- Treasury payment "advance"/unapplied-cash concept for vendors (see §5).
- A dedicated multi-tenant/company-scoped IDOR matrix for the NEW
  allocation code path was not built as a separate large test — the
  existing `erp.treasury`/`erp.finance` RBAC gates (unchanged, reused) were
  confirmed to already cover the modified route; no new sensitive
  operation was introduced.

## 15. Production Readiness

Treasury supplier-payment allocation: implemented, transactional,
concurrency-safe, live-verified. The remaining "advance" gap is a real
but narrow limitation with a clear existing precedent (the receipt side)
to follow if/when a product decision is made.
