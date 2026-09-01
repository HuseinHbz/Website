# Phase 16 — Customer Receipt (AR) Per-Invoice Traceability & Reversal

## Baseline (discovered, not assumed)

- HEAD at start: `893add5` (Phase 15's actual completion commit).
- Branch: `claude/bold-lamport-a1d6tg`. Working tree clean.
- Unit tests: discovered via `npx vitest run` → 108 test files, **1328
  discovered, 1328 passed, 0 failed**.
- Regression suites: discovered via `grep -c "{ name:" scripts/ci-regressions.ts`
  → **33 discovered**; ran via `scripts/ci-regressions.ts` →
  **33 passed, 0 failed**.
- Typecheck (`npx tsc --noEmit`): clean.
- Lint (`npm run lint`): clean.
- Governance audits: discovered by counting the `&&`-chained steps in
  `package.json`'s `audit` script → **12 discovered**, all 12 passed
  (0 budget violations) — re-confirmed after implementation.

## Discovery — selecting the Phase 16 objective

Traced the AP side (Phases 10-15: Treasury supplier payment → AP
allocation → unapplied cash → consumption → invoice cancellation reversal
→ Treasury payment reversal → direct AP payment reversal) against its
direct AR counterpart to find the highest-value remaining gap.

**Finding 1 — no customer receipt reversal exists at all.** Grepped the
entire `src/lib` tree for any reversal mechanism touching
`sales_payments`/`receipt_transactions`: zero hits. The exact class of gap
Phases 14/15 closed on the AP side has no AR equivalent.

**Finding 2 — the deeper, decisive discovery: `receipt_transactions.advance`
is still write-only/display-only (grepped every usage — written at
creation, read only by `listReceipts` for display; never consumed by
anything), exactly as documented in Phase 11's audit three phases ago and
still true today.**

**Finding 3 — the real, live, already-broken consumer that justified this
phase's scope.** Reading `createReceipt` (`src/lib/treasury/paymentData.ts`)
in full: it allocates a receipt across open invoices using the same
`allocateReceipt` engine the AP side uses, but then writes exactly **ONE**
opaque `sales_payments` row (`customer_id, amount, date` only — no
`document_id`, no `reference`) per receipt, with the real per-invoice
breakdown recorded **only** as a JSON blob on
`receipt_transactions.allocations` that nothing else queries. Meanwhile
`customer360Data.ts` (Customer 360, a live, shipped feature) already
computes an invoice's paid amount as `SUM(amount) FROM sales_payments
WHERE document_id=d.id` — which is **silently wrong (always reads as 0
contribution from Treasury receipts)** for any invoice actually settled
through a Treasury receipt, since `document_id` was never populated on
that path. This is not a hypothetical defect — it is a currently-shipped,
incorrect value in a real feature, discovered by reading the actual
consumer, not invented to manufacture a phase.

**Confirmed the schema already supports the fix with zero migration:**
`sales_payments.document_id` and `sales_payments.reference` are both
already real, pre-existing, nullable columns (`CREATE TABLE
sales_payments`, `migrate.ts`) — `createReceipt` simply never populated
them. The direct-payment AR path (`salesData.ts`'s payment insert and the
gateway callback path, `erp/payments/paymentData.ts`) already populates
both correctly; only the Treasury receipt path did not.

**Confirmed `postSalesPaymentToGl` is the exact structural mirror of
`postPurchasePaymentToGl`** (`gl_entry_id IS NULL` → posts a new Dr
Bank/Cr AR entry) — the same landmine Phase 12 found on the AP side
applies identically here: any new row this phase writes must carry the
receipt's own `gl_entry_id`, never NULL, or a later call to
`postSalesPaymentToGl` would post a phantom duplicate entry.

**Confirmed the canonical status function already exists and needed no
reimplementation:** `invoiceStatus(total, paid)` in `src/lib/erp/sales.ts`
— the exact AR-side mirror of `purchaseInvoiceStatus` — is a pure,
already-exported function; this phase imports and reuses it directly
rather than reimplementing the three-branch logic inline (unlike Phase
14's own AP reversal, which had reimplemented the equivalent logic — this
phase does not repeat that).

**Considered and rejected: leaving the representation as-is and only
adding a reversal that reads the `allocations` JSON blob.** Rejected
because (a) it would not fix the already-broken Customer 360 per-invoice
figure, (b) it would leave the reversal mechanism unable to reverse a
SINGLE allocation independently (the JSON blob is one document per
receipt, not one row per allocation, so a partial reversal — "undo just
this invoice's portion" — would be unrepresentable without parsing and
rewriting JSON, itself a mutation of historical data this codebase's
append-only convention forbids). Fixing the representation first, then
adding reversal on top of the now-symmetric row shape, is both the more
correct and the more reusable fix — and required no more implementation
effort than patching around the blob would have.

**Considered and rejected: a full "unapplied AR cash consumption" engine
symmetric to Phase 12's `consumeUnappliedForVendor`.** `advance` amounts
on the AR side (rows with `document_id=NULL`) are now representable and
individually reversible by this phase's work, but a future-invoice
consumption mechanism for them is **explicitly out of scope** — matching
Phase 11's own precedent of not building AP-side consumption speculatively
until requested, and there is no evidence a customer-advance consumption
feature has been requested. Documented as remaining work, not built.

## Design Decision

**No schema migration.** `createReceipt` now writes one `sales_payments`
row per invoice allocation (`document_id` set, `reference='TRZRCP-<receiptId>'`)
plus one `document_id=NULL` row for any advance/unapplied remainder — the
exact shape `purchase_payments` already uses on the AP side. All rows
carry the receipt's own `gl_entry_id` (stamped once, after the single GL
post — unchanged from before, one receipt still produces exactly one GL
event regardless of how many invoices it settles).

`reverseCustomerReceipt(receiptId, userId)` mirrors Phase 14's
`reversePayment` exactly: `reverseEntry(receipt.gl_entry_id)` reused
verbatim for the real second GL event (a receipt's own entry IS the cash
movement, Dr Bank/Cr AR — reversing it needs a genuine mirror entry, Dr
AR/Cr Bank), then every `sales_payments` row sharing that `gl_entry_id` is
reversed with an exact-negation row (`reference='TRZRCP-REVERSE:<rowId>'`),
excluding rows that are themselves already a reversal (the identical
self-reversal-loop guard Phase 14's own defect required). Each affected
invoice's status is recomputed via `invoiceStatus`, skipped only when the
invoice is already `void`.

Locked on `treasury_receipt_customer:${customerId}` — the SAME domain
`createReceipt` already uses, not a new one.

Route: `POST /api/admin/erp/treasury/receipts` gained an `action:'reverse'`
branch (existing callers, which never send `action`, are transparently
treated as `action:'create'` via a `zod` preprocess step — verified against
the actual UI caller, `TreasuryCenter.tsx`, which posts the bare shape with
no `action` field). Reversal requires the same
`['super_admin','administrator']` guard the Treasury payments route's own
`reverse` action already uses (Phase 14) — no new RBAC registration.

## Known limitation / remaining work

- Future-invoice consumption of AR advance/unapplied cash: not implemented
  (see rejected-alternatives above) — parity with Phase 11's own precedent
  for the AP side, documented rather than silently built or silently
  ignored.
- `receipt_transactions.advance` remains a display-only aggregate field
  (unchanged) — the authoritative, now-reversible record of any advance
  amount is the `sales_payments` `document_id=NULL` row this phase adds.

## Production Readiness

Per-invoice AR traceability: fixes an already-live incorrect value
(Customer 360's per-invoice paid figure for Treasury-settled invoices).
Customer receipt reversal: implemented, transactional, concurrency-safe
(reuses the existing per-customer advisory lock), money-conserving,
idempotent, live-verified under real PostgreSQL with genuine `Promise.all`
concurrency and forced-failure rollback.
