# Phase 13 — Purchase Invoice Cancellation / Payment Allocation Reversal Integrity

## Baseline

- HEAD at start: `8dbf696` (Phase 12's actual completion commit).
- Working tree clean. 1328/1328 tests. 30/30 committed regression suites
  (re-confirmed live before touching any code).
- Typecheck/lint/build clean.

## Discovery

**1. What exact function transitions a purchase invoice into cancelled/void
status?**
`voidPurchaseInvoice` (`src/lib/erp/purchasingData.ts`) — the only writer of
`purchase_documents.status='void'` for the invoice cancellation path
(distinct from `purchase_return`/`credit_note` documents, which are a
different `doc_type`, not a status transition on the original invoice).

**2. What statuses are currently considered cancellable?**
`voidPurchaseInvoice` has no status guard at all — it can be called from
any current status. This phase does not add one (out of scope: the master
prompt's objective is reversal correctness, not a new validation rule), but
it is noted as a pre-existing gap: voiding an already-void invoice is
already idempotent by construction (see Q6/idempotency below), so the
absence of a guard does not create an unsafe state, only a slightly
permissive one.

**3. What happens today (before this phase) to each of the following on
void?**
- `purchase_payments`: **untouched** — this was exactly Phase 12's
  documented gap.
- `purchase_documents.paid_total`: **untouched** — stays at whatever value
  it had, now meaningless once the invoice is void.
- `purchase_documents.status`: set to `'void'`.
- GL entries: **already correctly reversed** — `reverseEntry` books a
  balanced reversal of the invoice's own recognition entry (Dr
  Inventory+Tax / Cr AP flips), idempotent, two-way linked
  (`reversal_of`/`reversed_by`).
- Inventory: **untouched** — no `inv_moves` reversal exists for a voided
  purchase invoice. Confirmed by reading `voidPurchaseInvoice` in full: it
  contains no inventory-table reference. This is a genuine, pre-existing
  gap, **out of this phase's scope** (the master prompt's objective is
  specifically payment-allocation reversal) — documented as
  `architectural_gap`, not fixed here.
- Three-way-match state (`purchase_match`/`match_override`): **untouched**
  — no code path clears or updates match state on void. Also pre-existing,
  also out of scope.
- Unapplied supplier payment rows: **untouched** — the Phase 12 gap this
  phase closes.

**4. Every source of payment allocation into `purchase_payments.document_id
= <invoiceId>`:**
- `recordPayment` (direct payment) — `purchasingData.ts`.
- Treasury `processPayment`'s own AP-allocation loop (Phase 10) —
  `paymentData.ts`.
- `consumeUnappliedForVendor` (Phase 12) — `paymentData.ts`.
All three write the **identical row shape** (`document_id=<invoiceId>,
amount>0`) into the same table — confirmed by reading all three call
sites. This is the decisive fact that makes a single, source-agnostic
reversal mechanism correct (Q8 below): the reversal logic does not need to
know or care which of the three created a given row.

**5/6. Phase 12 consumption row representation / is `purchase_payments`
append-only in practice?**
Confirmed unchanged from Phase 12: a consumption event is a matched pair
(`reference='AP-CONSUME:<sourceId>'`) — a negative row against the
now-consumed unapplied source, a positive row against the target invoice,
both carrying the source's own `gl_entry_id`. Every writer to
`purchase_payments` in this codebase (Phase 4/7/8/10/12, this phase)
**inserts**, never `UPDATE`s a financial `amount` — confirmed by grepping
every `INSERT INTO purchase_payments` and `UPDATE purchase_payments` call
site: the only `UPDATE`s touch `gl_entry_id` (stamping it after posting),
never `amount`. `purchase_payments` is append-only in practice, matching
the GL's own reversing-entry convention.

**7. Do existing readers already support negative rows?**
Yes, with zero changes required — confirmed for each:
- `vendorPosition`: `SUM(amount)` — sign-agnostic by construction.
- AP aging / payment reports: not found as a distinct feature reading
  `purchase_payments.amount` with a `> 0` assumption baked in beyond the
  ones this phase itself writes (the allocation queries in `processPayment`/
  `consumeUnappliedForVendor` already filter `amount > 0` intentionally,
  by design, to only ever select *sources* to allocate FROM, not reversal
  rows).
- `paid_total` calculations: every writer computes `paid_total` from
  `SUM(amount) WHERE document_id=X`, which already nets negative rows in
  automatically — confirmed in `recordPayment`, `processPayment`,
  `consumeUnappliedForVendor`, and now this phase's own reversal function.
- GL posting helpers (`postPurchasePaymentToGl`): reads `p.amount` and
  posts `Dr AP num(p.amount) / Cr Bank num(p.amount)` — **a negative
  reversal row reaching this poster unguarded would post a backwards
  entry**. This is why every reversal/consumption row in this codebase
  (Phase 12 and this phase) is stamped with a real, pre-existing
  `gl_entry_id` — making it permanently inert to that poster
  (`gl_entry_id IS NULL` is that function's only "needs posting" signal).
  Verified live this phase (Section 5/GL integrity below).

**8. Should cancellation mutate rows, append reversal rows, create a
dedicated structure, or reuse a mechanism?**
**(B) Append reversal rows — reusing the EXACT representation Phase 11/12
already established, not a new structure.** For every currently
un-reversed positive `purchase_payments` row against the invoice, write a
matched pair sharing `reference='AP-VOID:<sourceRowId>'`:
- a negative row against the SAME invoice (nets that specific allocation
  to zero — `paid_total` returns to 0 once every row is reversed, since it
  is always kept in exact sync with `SUM(amount) WHERE document_id=X`).
- a positive row with `document_id=NULL` (returns the money to the SAME
  unapplied pool Phase 11/12 established — see Q10).
This is deliberately the SAME mechanism Phase 12 used for consumption,
applied in the reverse direction — no second reversal structure, no
mutation of historical rows.

**9. Does cancelling an invoice with different payment histories require
different handling?**
No — by construction. Whether the invoice has no payment (reversal loop
finds zero rows, no-op), a direct payment, a Treasury allocation, a
Phase-12-consumed allocation, or several of these combined, the reversal
query (`document_id=<invoiceId> AND amount>0 AND NOT already reversed`)
treats them all identically — verified live for every one of these cases
(Section 10 scenarios 1–6 below).

**10. What happens to unapplied supplier cash after cancellation, using the
prompt's own worked example (invoice 1,000,000, unapplied 1,000,000,
consume 600,000, then cancel)?**
Verified live exactly as specified: before cancellation, unapplied =
400,000 (1,000,000 − 600,000 consumed). After cancellation, the 600,000
consumption is reversed (negative row against the invoice, positive row
back to `document_id=NULL`) — unapplied returns to **1,000,000**, the
invoice's `paid_total` returns to **0**, `status='void'`. A second
`voidPurchaseInvoice` call is a stable no-op (0 rows reversed, unapplied
unchanged).

**11. Does cancellation need to also reverse inventory, AP GL, tax, COGS,
purchase invoice GL?**
The invoice's OWN recognition GL entry (which already encodes Dr
Inventory+Tax / Cr AP, or Dr COGS-adjacent lines depending on doc
composition) is **already** correctly reversed by the pre-existing
`reverseEntry(d.gl_entry_id)` call — unchanged, untouched by this phase.
That single reversal already flips every GL-account effect (AP, inventory
asset, tax) the original posting had. This phase adds ONLY the
**payment-allocation** (subledger, non-GL) reversal alongside it — it does
not need to and does not create any additional GL event (see Section 5).
Physical inventory quantity (`inv_moves`) reversal on invoice void is
**not implemented** — a genuine pre-existing gap, out of scope (see Q3).

**12. Is there a reusable pattern from sales cancellation/reversal?**
Yes — `settleReturnIfPaid` (`salesData.ts`)'s refund path already appends
a **negative** `sales_payments` row (`method='refund'`,
`reference='REFUND-CN-<creditNoteId>'`) rather than mutating the original
payment — the identical append-only philosophy this phase's design reuses
on the purchase side. Confirms this phase's design is consistent with the
codebase's one established reversal idiom, not a new one.

## Accounting Decision

**Append-only reversal rows, no migration, no new GL event for the payment
side.** The provable invariant, verified live:

```
original invoice outstanding (paid_total before)
+ Σ(new negative reversal rows against the invoice)
= 0 for every fully-reversed row
```

and

```
original unapplied balance
− consumed amount (Phase 12)
+ reversal amount (Phase 13, this phase)
= current unapplied balance
```

No money is created or destroyed — every reversal step writes a matched
±amount pair, so the vendor's total `SUM(purchase_payments.amount)`
(the input to `vendorPosition`) is **unchanged** by any reversal; only the
invoice's own `invoicedTotal` contribution drops out (via the pre-existing
`status NOT IN ('void','draft')` filter `vendorPosition` already applies),
correctly moving the vendor's payable position by exactly the voided
invoice's total.

## Section 4 — Concurrency / lock keys

`reversePurchaseInvoicePaymentAllocations` takes the SAME
`treasury_ap_allocate:vendor:${vendorId}` advisory key Phase 11
(`processPayment`) and Phase 12 (`consumeUnappliedForVendor`) already use
— deliberately the same lock domain, not a new one, so a cancellation for
a given vendor can never interleave with a concurrent Treasury payment or
consumption run for that same vendor (Scenarios B/C, live-verified). No
additional invoice-level lock was needed: `reverseEntry` is already
self-locked per GL entry id and idempotent (pre-existing), and the
payment-reversal function's own `NOT EXISTS ... AP-VOID:` idempotency
filter, run under the vendor lock, makes two concurrent `voidPurchaseInvoice`
calls for the SAME invoice naturally produce exactly one GL reversal and
one payment reversal — verified live (Scenario A), not merely assumed.

## Section 5 — GL decision

**No new GL event for the payment-allocation reversal** — preserves
exactly the principle Phase 12 established. Both rows of every reversal
pair carry the SOURCE row's own already-posted `gl_entry_id`, so
`postPurchasePaymentToGl` (which posts a new entry only when
`gl_entry_id IS NULL`) correctly refuses to post anything for them —
verified live. The invoice's OWN recognition entry reversal (pre-existing
`reverseEntry` call) is the only GL event cancellation ever produces, and
it is unaffected by this phase's change — verified: debit==credit before
and after, GL entry count increases by exactly one (the invoice reversal)
per cancellation, not two.

## Known gaps / honest limitations (not fixed this phase, by scope)

- Physical inventory (`inv_moves`) is not reversed on invoice void — a
  pre-existing gap predating this phase.
- Three-way-match state (`purchase_match`, `match_override`) is not
  cleared/updated on void — pre-existing, out of scope.
- No status guard on which `purchase_documents.status` values are
  "cancellable" — `voidPurchaseInvoice` remains callable from any status,
  as before this phase; not a new risk (fully idempotent either way), but
  not tightened either, since that was not this phase's objective.
- Treasury payment reversal (of the Treasury `payment_orders` entity
  itself) remains explicitly **not_implemented**, per this phase's
  required scope discipline (Section 13) — Phase 14 territory.

## Production Readiness

Payment-allocation reversal on purchase invoice cancellation: implemented,
transactional per reversal step, concurrency-safe (shares Phase 11/12's
lock domain), money-conserving, creates zero new GL events beyond the
pre-existing invoice-recognition reversal, live-verified under real
PostgreSQL with genuine `Promise.all` concurrency and forced-failure
rollback. Inventory reversal and three-way-match cleanup on void remain
real, honestly-documented gaps outside this phase's scope.
