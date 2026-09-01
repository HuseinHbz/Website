# Phase 15 — Direct AP Payment Reversal

## Baseline

- HEAD at start: `488cebb` (Phase 14's actual completion commit).
- Working tree clean. 1328/1328 tests. 32/32 committed regression suites
  (re-confirmed live before touching any code).
- Typecheck/lint/build clean.

## Discovery — the 24 questions, answered from actual code/schema

**1. What exactly creates a direct AP payment?**
`purchasingData.recordPayment(documentId, vendorId, amount, method, date,
reference?, userId?, currency?)` — the only writer of a `purchase_payments`
row OUTSIDE the Treasury (`payment_orders`) path.

**2. Does `recordPayment` create exactly one `purchase_payments` row, or
multiple?**
Exactly one, always — a single `INSERT` inside its own locked transaction.

**3. Can `document_id` be NULL?**
Never on this path. `recordPayment` always inserts a real `documentId`
(there is no "unapplied cash" concept here — `validatePayment` rejects any
amount that would overpay the invoice, unlike Treasury's `allocateReceipt`
which deliberately allows an excess to become unapplied).

**4. What identifies the source payment?**
`purchase_payments.id` itself — there is no parent entity (no
`payment_orders` row) the way a Treasury payment has. This is the whole
"lineage": a direct payment is never itself a source for a LATER derived
row the way a Treasury unapplied row can be (Phase 12's
`consumeUnappliedForVendor` only ever reads `document_id IS NULL` rows,
which `recordPayment` never creates).

**5. What identifies the invoice?**
`purchase_payments.document_id`, unchanged/read directly off the row.

**6. Where is `gl_entry_id` stored?**
On the SAME `purchase_payments` row — but set by a **separate, best-effort,
non-atomic** step. `recordPayment`'s own transaction inserts the row
WITHOUT `gl_entry_id` at all (absent from its `INSERT` column list); AFTER
that transaction commits, `recordPayment` calls
`postPurchasePaymentToGl(paymentId, userId)` wrapped in a bare
`try {...} catch { /* stays unposted */ }` — a closed fiscal period at
recording time leaves the row permanently `gl_entry_id IS NULL` unless
something re-posts it later. This is a genuine structural difference from
every other payment path in this codebase (Treasury's `processPayment`
posts GL synchronously, inside the SAME transaction, always setting
`gl_entry_id` before returning).

**7. Can multiple `purchase_payments` rows share the same `gl_entry_id`?**
Not for direct payments — each `recordPayment` call posts its OWN,
independent GL entry via `postPurchasePaymentToGl` (contrast Phase 14's
Treasury design, where `gl_entry_id` is a deliberate shared lineage tag
across a whole consume/void chain). A direct payment's `gl_entry_id`
belongs to exactly one row.

**8. How is `paid_total` updated?**
`paid = already + amount` (computed fresh from `SUM(purchase_payments.amount)
WHERE document_id=X` inside the SAME locked transaction), written directly
— the identical "always derived, kept in sync" pattern every prior phase
relies on.

**9. How is invoice status recalculated?**
`purchaseInvoiceStatus(total, paid)` — the pure, already-exported function
from `purchasing.ts`, already imported into `purchasingData.ts`. (Phase 14
had reimplemented the same three-branch logic inline in `paymentData.ts`
rather than importing this cross-module; this phase reuses the actual
canonical function directly, since it lives in the same module.)

**10. Is there already an idempotency/reversal marker?**
No dedicated field — same answer as every prior phase. This phase reuses
the identical `reference`-based `NOT EXISTS`/existence-check convention
(`AP-DIRECT-REVERSE:<paymentId>`).

**11. Does `reverseEntry` already support this GL entry?**
Yes, unconditionally — `postPurchasePaymentToGl` posts through the exact
same `insertPostedEntry` primitive Treasury uses, so the resulting entry is
structurally identical and `reverseEntry` (which only cares about an
`entryId`, never what created it) works on it unchanged.

**12/13. What happens if the invoice is partially/fully paid and the
payment is reversed?**
Both verified live. `reverseDirectPayment` recomputes `paid_total` AND
`status` fresh from the invoice's current, real `SUM(purchase_payments.amount)`
after the reversal row lands — correct whether that leaves the invoice at
0 (`confirmed`), partially covered by OTHER payments (`partial`), or (in
principle) still fully covered by other sources (`paid`).

**14. What happens if multiple direct payments exist against the same
invoice?**
Each is reversed independently by its own `paymentId` — verified live
(reversing one leaves the other's contribution to `paid_total`/`status`
untouched).

**15. What happens if a Treasury payment and a direct AP payment both
affect the same invoice?**
Each writes its own independent `purchase_payments` row (different
`reference` prefixes: `TRZPAY-<id>` vs whatever `recordPayment`'s caller
supplied), so reversing one never touches the other — verified live
(Scenario C).

**16. What advisory lock domain is required?**
The SAME `treasury_ap_allocate:vendor:${vendorId}` key Phases 11-14 all
already share — reused unchanged, not a new domain. This is what lets
Scenarios C/D (direct reversal vs Treasury allocation, vs unapplied
consumption) serialize correctly without inventing a second lock
convention.

**17/18. What happens if reversal is attempted twice / 5 times
concurrently?**
Idempotent no-op after the first (verified: `alreadyReversed: true`,
`amountReversed: 0`, same `reversalId`); 5 concurrent calls on the same
payment produce exactly one reversal row and one GL entry (verified live,
Scenario A).

**19/20/21. Races vs a new direct payment / Treasury allocation / unapplied
consumption?**
All three verified live via genuine `Promise.all` — the shared vendor lock
serializes them; money conservation holds regardless of which operation's
transaction wins the lock first (both valid orderings accepted, exactly
matching the honesty standard Phase 14 already established for its own
equivalent races).

**22. What happens if reversal is attempted while the reversal posting date
is inside a closed fiscal period?**
Rejected — `reverseEntry`'s own pre-existing `assertPostable` gate
(unchanged, reused verbatim) dates the reversal `asOf ?? today`, so a
period covering TODAY being closed rejects the GL reversal and the whole
function throws before touching `purchase_payments` at all. Verified live
(matches Phase 14's identical finding).

**23. What exact rows must roll back if a later operation fails?**
The one reversal `purchase_payments` row plus the invoice's `paid_total`/
`status` update — both written inside the SAME `withTransaction` block, so
a forced failure after either write rolls back both together. Verified
live with a forced-failure injection.

**24. Does reversal need to affect inventory? — STOPPED, not implemented.**
Traced `recordPayment` and `reverseDirectPayment` end to end: neither
touches `inv_moves` or any inventory table — payment recording (and its
reversal) is a purely financial/subledger operation; inventory was already
received (or not) independently of when/whether the invoice gets paid.
**This question is answered but deliberately NOT acted on** — inventory
reversal remains explicitly out of Phase 15's scope, exactly as Phase 13's
own audit already found and documented as a separate, pre-existing gap.
`purchase_match`/`match_override` cleanup is similarly out of scope,
unchanged.

## Design Decision

**No migration.** `reverseDirectPayment(paymentId, userId)` — a single
exact-negation `purchase_payments` row (`reference='AP-DIRECT-REVERSE:<id>'`,
same `gl_entry_id` as its source, never NULL-when-the-source-had-one),
`reverseEntry` reused verbatim (skipped when `gl_entry_id IS NULL`, since a
never-posted payment has no GL entry to reverse), invoice `paid_total`+
`status` recomputed via the canonical `purchaseInvoiceStatus` (skipping the
status write, but not the `paid_total` write, when the invoice is already
`void` — never silently un-voiding it, matching Phase 14's identical
guard). Guards against being called on a row that is itself already a
reversal/consumption adjustment, or on a Treasury-sourced row (which must
go through `reversePayment(paymentOrderId)` instead) — a clear, explicit
error rather than a silently wrong double-reversal path.

## Scope discipline

Not touched, not needed: inventory reversal, `purchase_match`/
`match_override` cleanup (both explicitly deferred, Q24), any new GL
posting mechanism (reused `reverseEntry`/`postPurchasePaymentToGl`
unchanged), any new allocation engine, any new lock domain, any new RBAC
operation, any new error code, any schema migration.

## Production Readiness

Direct AP payment reversal: implemented, transactional, concurrency-safe
(shares the established vendor-lock domain), money-conserving, idempotent,
live-verified under real PostgreSQL with genuine `Promise.all` concurrency
and forced-failure rollback across full, partial, multi-payment, never-
posted-GL, and cross-path (Treasury/consumption) scenarios.
