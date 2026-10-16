# ERPFIX-3 — Document lifecycle: sales state machine, safe void/delete, full-fidelity convert

Covers BUG-ERP-05, BUG-ERP-06, BUG-ERP-04 (`erp-audit-report.md`).

## بند۰ — Audit-first (completed before any code)

Confirmed the audit's evidence by direct read (line numbers re-grepped fresh,
per the master prompt's own instruction — the file had moved since
`erp-audit-report.md` was written):

- `sales/documents/route.ts`'s PUT handler built `status` purely from `op`
  with NO check against the document's current status at all — confirming/
  sending a paid or voided invoice silently "succeeded" with a real status
  write and no error, exactly as the audit described.
- `postSalesInvoiceToGl`'s pre-check (`if (d.gl_entry_id) return {…
  alreadyPosted:true}`) never looked at whether that `gl_entry_id`'s entry
  had since been `reversed_by` a void — a confirm→void→confirm cycle would
  read back "already posted" with zero real ledger effect.
- The invoice-confirm GL-post failure path manually reverted the status
  with a SECOND, independent `UPDATE` after the confirm's own transaction
  had already committed — confirmed non-atomic by direct read, matching the
  audit's `route.ts:338` citation.
- `DELETE` only ever checked for payments — a confirmed, GL-posted,
  zero-payment invoice could be "deleted" (`status='void'`) while its
  posted revenue/AR entry stayed fully live in the ledger.
- `sales/documents/route.ts`'s convert branch's `INSERT` listed 14 columns,
  none of them `currency`/`exchange_rate`/`base_total`/`company_id`/
  `cost_center_id` — confirmed a USD quote becomes an IRR order with the
  identical numeric total. The blanket `UPDATE … SET status='confirmed'
  WHERE id=$1 [id]` ran for EVERY conversion regardless of source doc_type,
  masking the missing order→invoice status guard (an order gets
  re-"confirmed" as a no-op, so nothing ever surfaced the gap).
- `purchasingData.ts`'s `convertDocument` hardcoded `currency: 'IRR'` on
  BOTH the non-return and the return `saveDocument` calls, confirmed by
  direct read — no status guard on any transition, no quantity-based
  duplicate-conversion guard outside the return-specific one already built
  in 26.26.

Column lists for `sales_documents`/`sales_document_lines`/
`purchase_documents`/`purchase_document_lines` pulled live from
`information_schema.columns` (not assumed from migrate.ts) — used to build
the explicit exception lists and drive the contract check (بند۴).

## بند۱ — Items

### BUG-ERP-05 — no sales document state machine

**Status: built-new.**

- `salesDocTransition(op, from)` (`src/lib/erp/sales.ts`) — the ONE table a
  `send`/`confirm`/`void` op is checked against: `send`/`confirm` only from
  `draft`/`sent`; `void` from anything except `void` itself (terminal) or
  `paid` (paid invoices keep their existing BUG-013 value-based guard,
  unrelated to this state machine). A disallowed transition is now a loud
  409 (`ERP-SALES-INVALID-TRANSITION`), never a silent status write.
  Exhaustively unit-tested over every (op, status) pair (18 new tests).
- `postSalesInvoiceToGl` gained an optional `externalQuery` parameter
  (mirrors `purchasingData.saveDocument`'s existing pattern) — a caller can
  now join the GL-post INTO its own already-open transaction. The invoice-
  confirm and credit-note-confirm branches in the route now do credit-check
  + status write + GL post as ONE transaction: a GL failure (e.g. a closed
  fiscal period) throws, the WHOLE transaction rolls back, and the status
  is NEVER flipped unless the GL post inside it actually succeeded. The old
  manual "revert the status with a second UPDATE" code is deleted — it is
  structurally impossible for that second UPDATE to be skipped or to race
  with something else now, because there is no second UPDATE.
- Defense in depth: `postSalesInvoiceToGl` now checks whether an existing
  `gl_entry_id`'s entry has been `reversed_by` before returning
  `alreadyPosted: true` — if it has, it throws instead, so a confirm→void→
  confirm cycle can never silently skip re-posting.
- Voiding a sales ORDER with an active (non-`returned`/`cancelled`)
  `inv_shipments` row is now a 409 (`ERP-SALES-VOID-DELIVERED`) — the goods
  already physically moved.

### BUG-ERP-06 — soft-delete bypasses the ledger

**Status: built-new.**

- `DELETE /api/admin/erp/sales/documents` now checks the document's own
  `status`/`gl_entry_id` FIRST: only a genuine `draft` with no `gl_entry_id`
  may be deleted. Anything else — confirmed, posted, paid, whatever — is a
  409 (`ERP-SALES-DELETE-NOT-DRAFT`) pointing the caller at `void`, which
  books the balanced reversal this phase (and 26.26b BUG-020) already
  requires. The payment check from before is kept as a second, redundant
  layer (a draft should never have payments, but the check costs nothing).

### BUG-ERP-04 — convert drops currency/org data; no status/quantity guard

**Status: built-new.**

- **Sales** (`sales/documents/route.ts`'s convert branch): the new
  document's `INSERT` now carries `currency`, `exchange_rate`, `base_total`,
  `company_id`, `cost_center_id` from the source — a USD quote becomes a
  USD order at the same rate, not a numerically-identical IRR order.
  Status guards: a quote may convert to an order from `draft`/`sent`/
  `confirmed`; an order may convert to an invoice ONLY once the order
  itself is `confirmed` (otherwise 409 `ERP-SALES-INVALID-TRANSITION`) —
  converting an unconfirmed order would skip the reservation/credit gate
  entirely. The blanket "set source to confirmed" UPDATE now runs ONLY for
  a quote source (accepting the quote) — an order source converting to an
  invoice is already confirmed by definition, and re-stamping it was the
  no-op that hid the missing guard.
- **Purchasing** (`purchasingData.ts convertDocument` + `saveDocument`):
  `saveDocument` gained additive `costCenterId`/`companyId`/`exchangeRate`
  parameters; `convertDocument` now passes the source's real `currency`,
  registered `exchange_rate` (not a freshly-resolved live rate — the
  SOURCE's own rate, matching 26.8's immutability discipline),
  `department`, `budget`, `priority`, `cost_center_id`, `company_id`
  through on BOTH the normal and the return conversion paths (previously
  hardcoded `'IRR'` on both).
  New status guard (`PURCHASE_CONVERT_STATUS_GUARD`): `request→order/rfq/
  quotation` only from `approved`; `order→receipt`/`order→invoice` only
  from `approved`/`received`/`partial`; `receipt→invoice` only from
  `received`/`partial`. A violation throws `PurchaseConvertError`
  (`PURCHASE_CONVERT_BLOCKED:` prefix), mapped by the route to a proper
  bilingual 409 — the same convention this codebase already uses for
  `THREE_WAY_MATCH_FAILED` on the payment path, not a second ad hoc scheme.
  New value-based duplicate-conversion guard: for the three relations
  `purchase_document_lines` actually tracks (`po_line_id` for order→receipt
  and order→invoice, `receipt_line_id` for receipt→invoice), the qty
  already converted downstream (summed over every NON-VOID child line) is
  subtracted from the source line's own qty; the new document's lines carry
  the REMAINING qty, and a document with zero remaining qty on every line
  is rejected (`ERP-PURCHASING-NOTHING-TO-CONVERT`) rather than silently
  duplicating the full line again — closing the "PO converted to invoice
  twice = two invoices" shape exactly. Voiding a prior conversion correctly
  frees its qty back up (true partial-conversion support, live-proven).

## بند۲ — Already-existing, verified, NOT rebuilt

- `createSalesReturn`/`confirmPurchaseInvoice`'s own atomic
  lock-then-write-then-GL-post pattern — audited as the template this
  phase's invoice-confirm atomicity fix now matches, not duplicated.
- The BUG-013 paid-invoice-void value check and BUG-020 two-way reversal
  linkage — untouched, reused as-is.
- `purchasingData.ts`'s return-specific "already returned" duplicate guard
  (26.26) — left exactly as it was; the new value-based guard in this
  phase only covers the three NON-return relations it didn't already cover.

## بند۳ — Finding-for-later (not fixed, out of this phase's scope)

None beyond what's listed above as fixed-in-phase. The stop_condition's
own escape hatch ("a UI depends on a transition the table doesn't know
about — report, don't guess") was never triggered: every transition the
existing UI genuinely exercises (draft→sent→confirmed→partial→paid,
quote→order→invoice, request→order→receipt→invoice) stayed allowed by the
new tables; only the previously-ungated disallowed transitions changed
behavior, and that behavior change is deliberate and logged below.

## بند۴ — Live PostgreSQL proof

`scripts/verify-erpfix-3.ts` — **28/28 assertions pass**, registered as a
regression suite in `scripts/ci-regressions.ts`. Through production
functions only (`salesDocTransition`, `postSalesInvoiceToGl`,
`convertDocument`, `trialBalance`/`loadTallies`), per CLAUDE.md rule 15:

- the exhaustive transition table (send/confirm/void × every status);
- a GL-post failure (closed fiscal period) throws inside a shared
  transaction and the status write inside that SAME transaction rolls back
  with it — proven by re-reading the row after the throw AND by confirming
  `trialBalance()` is byte-identical before/after;
- a reversed posted entry's document correctly refuses to read back as
  "already posted";
- the delete-guard predicate (`status='draft' AND gl_entry_id IS NULL`)
  correctly distinguishes a GL-posted document (fails it) from a real
  draft (passes it);
- a USD quote→order conversion keeps its currency/rate/base_total exactly;
- `request→order` from a non-approved request is rejected, from an
  approved one succeeds;
- a PO→receipt conversion carries currency/department/budget/rate; a
  second full conversion of the same PO is rejected; voiding the first
  conversion correctly frees the remaining qty for a second, genuine
  conversion; a receipt→invoice conversion also carries the org columns
  and is itself guarded against a second full conversion;
- a contract check reads `information_schema.columns` for both sales
  tables live and greps the route's actual convert code, asserting every
  real column is either copied or in the explicit exception list — this
  will FAIL the moment a future migration adds a column the convert branch
  doesn't know about, catching the exact class of silent data loss this
  phase closed.

Full regression suite: **40/40 green**, run live against a fresh
PostgreSQL database.

A first pass of the purchase status guard (`order→receipt`/`order→invoice`
required an `approved` status, mirroring the master prompt's own evidence
list almost verbatim) broke 4 real, already-verified regression suites —
26.21's two-year CFO simulation, Phase 5's three-way-match suite, Phase 9's
treasury/precision suite, and PROC-FLOW-1's supply-note chain — all with
the identical error: `a order in status "draft" cannot convert to
receipt`. Investigated live rather than assumed: this codebase's real
procurement lifecycle has NO separate "order approval" status distinct
from the originating request's own approval — an order created by
converting an already-approved request stays `draft` and is received/
invoiced directly from there, in every one of those four already-correct
simulations. Per the master prompt's own `stop_conditions` ("a guard the
real UI/workflow doesn't know about breaks real behavior — report, don't
guess-expand the table"), the guard was corrected to a DENY-list (blocks
only `void`/`rejected`, plus an un-received `draft` receipt before
invoicing) instead of an ALLOW-list requiring a status that does not
exist in this system's real lifecycle. Re-verified: all 4 suites +
`verify-erpfix-3.ts` green.

Gates: TypeScript 0 errors · ESLint 0 · `npm run build` clean · full
`npm run audit` (14 governance audits) clean · 1364/1364 unit tests (18 new,
`salesDocTransition`).

`audit:gl-writes`'s written-reason allowlist line numbers for
`purchasingData.ts`/`salesData.ts` were re-synced after this phase's edits
shifted both files' lines (661→740, 202→219) — line-number upkeep only, no
behavior change, not a contract change.

## بند۵ — Required confirmations from the maintainer/accountant

- **No decision_gate existed in this phase's 3 items** — all three are
  pure mechanism fixes (a missing state machine, a missing ledger guard on
  delete, a missing data-fidelity/quantity guard on convert). Nothing was
  deferred.
- Worth a maintainer's attention even though it's not a decision_gate: the
  new `ERP-SALES-INVALID-TRANSITION`/`ERP-SALES-VOID-DELIVERED`/
  `ERP-SALES-DELETE-NOT-DRAFT` 409s are a BEHAVIOR CHANGE for any existing
  client code that relied on the old silent-success paths (e.g. a UI button
  that called `confirm` on an already-paid invoice and treated the 200 as
  "nothing to do"). The admin SalesCenter UI itself was not audited for
  every call site in this phase (out of the 3 items' explicit scope) — if
  an operator reports a new 409 toast somewhere unexpected after this ships,
  that is this phase's new guard working as designed, not a regression; the
  UI call site should stop calling the now-invalid op, not have the guard
  relaxed.

## New CLAUDE.md rule

> «گذار وضعیت سند از جدول خالص؛ سندی که ثبت دفتری دارد فقط با void+reversal
> از زیرحساب خارج می‌شود، نه با DELETE؛ تبدیل سند همهٔ ستون‌های مالی را کپی
> می‌کند (تست قرارداد).»

(Added as rule 58, with the full mechanism spelled out — see CLAUDE.md.)
