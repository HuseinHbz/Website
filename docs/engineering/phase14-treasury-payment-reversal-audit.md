# Phase 14 — Treasury Payment Reversal

## Baseline

- HEAD at start: `a5b6892` (Phase 13's actual completion commit).
- Working tree clean. 1328/1328 tests. 31/31 committed regression suites
  (re-confirmed live before touching any code).
- Typecheck/lint/build clean.

## Discovery — the 22 questions, answered from actual code/schema

**1. What statuses can `payment_orders` have?**
`draft, pending_approval, approved, processing, completed, rejected,
cancelled` — the exact `CHECK` constraint in `migrate.ts`, matching
`PAYMENT_STATUSES` in `src/lib/treasury/payments.ts`.

**2. Which statuses are legally reversible?**
Only `completed` — it is the only status with a posted GL entry
(`gl_entry_id` is set exclusively by `processPayment` on success). This
phase's `reversePayment` rejects every other status explicitly.

**3. Does `payment_orders` have an existing reversal/void field?**
No. `canTransitionPayment`'s `FLOW` map has `completed: []` (confirmed in
Phase 11) — a dead end, no outgoing transition of any kind, reversal
included.

**4. How is the original GL entry linked?**
`payment_orders.gl_entry_id`, set once by `processPayment` via `postGl`.

**5. How are `purchase_payments` rows linked to the payment?**
Two ways, both already established: `reference='TRZPAY-<paymentId>'` (the
direct link, Phase 10/11) AND `gl_entry_id` (the SAME value
`payment_orders.gl_entry_id` holds — Phase 10 onward stamps every row this
payment causes, directly or indirectly, with this value).

**6. How are Treasury-created AP allocations identified?**
`purchase_payments.reference='TRZPAY-<id>'` with `document_id=<invoiceId>`
— written by `processPayment`'s own AP-allocation loop (Phase 10).

**7. How are unapplied rows identified?**
`purchase_payments.document_id IS NULL` (Phase 11) — a positive row means
"still unapplied"; Phase 12 introduced negative `document_id IS NULL` rows
(`AP-CONSUME:<sourceId>`) representing consumption of a specific source.

**8. How are Phase-12 consumption rows linked to their source?**
`reference='AP-CONSUME:<sourceRowId>'`, and — the decisive fact for this
phase — **both rows of the pair inherit the SOURCE row's own `gl_entry_id`**
(confirmed by re-reading `consumeUnappliedForVendor`'s INSERT statements:
`r.gl_entry_id` is passed to both the negative and positive row). Phase 13's
`reversePurchaseInvoicePaymentAllocations` does the exact same thing for
`AP-VOID:<sourceRowId>` pairs. This means `gl_entry_id` is a **persistent
lineage tag** that survives arbitrarily many consume/void cycles, always
pointing back to whichever GL entry originally moved the cash — decisive
evidence for this phase's design (see below).

**9. Can a payment be reversed after its unapplied amount was consumed?**
Yes — verified live. Because every downstream row (the consumption pair,
and any later void-restoration pair) inherits the SAME `gl_entry_id`,
reversing "every `purchase_payments` row still tagged with this payment's
`gl_entry_id`" automatically finds and undoes the consumption's effect on
whatever invoice it landed on, not just the original unapplied row.

**10. Can a payment be reversed after the invoice receiving the consumed
amount was voided?**
Yes — verified live (the exact chain: pay → consume → void → reverse). The
void's own restoration-to-unapplied pair also carries the original
`gl_entry_id`, so it too is found and reversed, netting everything to zero
regardless of how many consume/void cycles occurred in between.

**11-14. What happens to vendor AP balance / unapplied balance / invoice
paid_total+status / GL?**
- Vendor AP (`vendorPosition`): automatically correct — its `SUM(amount)`
  query is unfiltered, so every reversal row (like every row before it) is
  included with zero code changes.
- Unapplied balance: nets back to its pre-payment value — verified live for
  every chain depth (direct, once-consumed, consumed-then-voided).
- Invoice `paid_total`: recomputed fresh (`SUM(amount) WHERE
  document_id=X`) after all of this payment's rows against that invoice are
  reversed — exact, not incremental (safe even when a payment touched the
  same invoice more than once across its lifecycle).
- GL: a real SECOND event — `reverseEntry(payment.gl_entry_id)`, unchanged,
  reused verbatim. Unlike Phase 12/13's subledger-only reversals, this one
  needs a genuine new GL entry because the ORIGINAL entry (Dr AP/Cr Bank)
  **is** the cash movement itself — reversing it books the mirror (Dr Bank/
  Cr AP if the account normal-sides are respected; `reverseEntry`'s existing
  `reversalLines` helper flips debit/credit generically, unchanged).

**15. What happens if the fiscal period is closed?**
`reverseEntry` already calls `assertPostable` internally (unchanged,
pre-existing) — a closed period rejects the reversal entry, and the whole
`reverseEntry` transaction rolls back, so `reversed_by` is never set.
Verified live: `reversePayment` then also never reaches its
`purchase_payments`-reversal step (it awaits `reverseEntry` first and
propagates the throw).

**16/17. What happens under concurrent reversal, and what existing advisory
locks protect the same vendor?**
Two independent lock layers, both pre-existing, reused unchanged:
`reverseEntry` self-locks per GL entry id (`gl_entry_reversal:${entryId}`,
Phase 26.23) making the GL-reversal step itself idempotent+safe under a
race. This phase's own subledger-reversal step additionally takes the SAME
`treasury_ap_allocate:vendor:${vendorId}` advisory key Phases 11-13 already
use, so it can never interleave with a concurrent new Treasury payment,
consumption run, or invoice void for the same vendor. Verified live for
all four combinations (Scenarios J/K/L/M/N).

**18. What existing reversal/idempotency mechanisms can be reused?**
`reverseEntry` (GL) verbatim; the `NOT EXISTS`-on-reference idempotency
pattern Phase 12/13 established (this phase reuses the identical shape,
`reference='TRZPAY-REVERSE:<sourceRowId>'`).

**19. What audit event should represent reversal?**
Route-level `logAction(auth.user, 'treasury.payment.reverse',
'payment_orders', id, null, result)` — added at
`src/app/api/admin/erp/treasury/payments/route.ts`, mirroring the existing
`treasury.payment.process` call exactly (same route, same convention, no
new data-layer logging).

**20. What authorization is required?**
The SAME guard `process` already uses at that route:
`['super_admin','administrator'].includes(auth.user.role)` (an inline role
check, not a registered `SENSITIVE_OPS` key — matching the existing,
un-migrated convention for this specific route rather than introducing a
new, asymmetric RBAC registration for reversal alone).

**21. Does schema already support append-only reversal without migration?**
Yes, on every axis: `purchase_payments` needed no schema change (Phase
11/12/13 precedent). `payment_orders` needed **no new column either** — the
"has this payment been reversed?" question is fully answered by
`gl_journal_entries.reversed_by IS NOT NULL` for `payment_orders.gl_entry_id`
(the exact same "don't duplicate what's derivable" principle behind
`vendorPosition`, `paid_total`, and the unapplied-balance queries).
`payment_orders.status` stays `'completed'` after a reversal — mirroring
rule 11 (`gl_journal_entries` keeps a reversed entry `status='posted'`) —
so the pre-existing CHECK constraint needed **zero changes**.

**22. What exact financial conservation identity proves correctness?**
`Σ(rows sharing this payment's gl_entry_id) == 0` after reversal — verified
live for every scenario (the reversal step reverses every unreversed row
under that `gl_entry_id` to an exact negation, so the group necessarily
sums to zero once nothing is left unreversed).

## Design Decision

**No migration, no new column, no new status value.** Two reused
mechanisms compose into the whole feature:
1. `reverseEntry(payment.gl_entry_id)` — verbatim reuse, the real second GL
   event this phase's cash-movement reversal genuinely needs (unlike Phase
   12/13's subledger reclassifications).
2. A new `reversePayment` function (`src/lib/treasury/paymentData.ts`)
   whose ENTIRE job is: find every `purchase_payments` row still carrying
   this payment's `gl_entry_id` (excluding rows that are themselves already
   a reversal — see Defects below) and write its exact negation, tagged
   `reference='TRZPAY-REVERSE:<sourceRowId>'`, then recompute
   `paid_total` fresh for every invoice touched.

This is deliberately NOT a graph walk of `TRZPAY-N → AP-CONSUME:N →
AP-VOID:M → …` references — `gl_entry_id`'s persistent-lineage property
(Q8 above) makes that unnecessary: querying by `gl_entry_id` already
flattens the whole chain into one result set, regardless of depth.

## Defects found and fixed during implementation

**1. Self-reversal loop.** A reversal row itself carries the SAME
`gl_entry_id` as its source (by design, so it too stays inert to
`postPurchasePaymentToGl`). Without an explicit exclusion, `reversePayment`'s
own `NOT EXISTS`-based row selection picked up its OWN just-inserted
reversal rows as "still needing reversal" on the very next call — an
infinite self-reversal loop across repeated calls. Caught by a manual
idempotency check before any test was written. **Fix**: the row-selection
query also excludes `reference LIKE 'TRZPAY-REVERSE:%'`. Verified live: a
second `reversePayment` call now returns `ledgerRowsReversed: 0`, stable
indefinitely.

**2. Stale invoice status after a partial reversal.** The row-reversal step
originally recomputed `paid_total` but never `status`. For a FULL reversal
this was invisible (status is overwritten again moments later by whatever
set it, or the invoice is fully drained to 0/`confirmed`), but for a
PARTIAL reversal — one of several payment sources on an invoice — this
left `status` stuck at `'paid'` even though `paid_total` had dropped below
`total`. Since `processPayment`'s and `consumeUnappliedForVendor`'s own
open-invoice queries filter `status IN ('confirmed','partial')`, a
stuck-'paid' invoice silently disappeared from BOTH — caught live by the
mandatory partial-reversal (Scenario C/I) and concurrency (Scenario L)
tests, not by inspection. **Fix**: recompute `status` from `paid_total` vs
`total` alongside `paid_total`, using the identical `confirmed
(paid<=0) / partial / paid` logic `purchaseInvoiceStatus` and every other
writer already use — except when the invoice's CURRENT status is already
`'void'`, in which case only `paid_total` is corrected and `status` is
deliberately left alone (a payment reversal must never silently un-void an
invoice as a side effect).

## Scope discipline (per the master prompt's explicit rule)

Not touched, not needed: physical inventory reversal, `purchase_match`/
`match_override` cleanup, sales-side reversal, any new GL architecture, any
new RBAC operation (reused the existing inline role check), any new error
code, any schema migration. All confirmed unnecessary by discovery, not
skipped for convenience.

## Known limitation

`reversePayment` targets `payment_orders` rows created via the Treasury
`createPayment`/`processPayment` path specifically (identified by
`gl_entry_id` lineage). A payment recorded through the OTHER path —
`purchasingData.recordPayment` (direct AP payment, its own independent
`gl_entry_id` from `postPurchasePaymentToGl`) — is a structurally different
entity (it has no `payment_orders` row at all) and is out of this phase's
scope; reversing a direct `recordPayment` would need its own function,
not requested here and not silently added.

## Production Readiness

Treasury payment reversal: implemented, transactional per step,
concurrency-safe (reuses both the GL-entry-level and vendor-level advisory
locks already established), money-conserving across arbitrarily deep
consume/void chains, idempotent (including the self-reversal defect found
and fixed before any test ran), live-verified under real PostgreSQL with
genuine `Promise.all` concurrency and forced-failure rollback.
