# ERPFIX-4 — Purchasing controls: edit lock, separation of duties, unified approval, input validation

Covers BUG-ERP-15, BUG-ERP-16, BUG-ERP-18, BUG-ERP-17 (`erp-audit-report.md`).

## بند۰ — Audit-first + decision_gates (before any code)

Confirmed by direct read: `saveDocument` with an `id` had NO status guard —
an approved/received/invoiced document's price and lines could be rewritten
by a plain `doc.save`, and the DELETE+reinsert pattern would have orphaned
`po_line_id`/`receipt_line_id` downstream pointers on a document that
already had a receipt. `purchasing/route.ts`'s POST handler gated EVERY
action (vendor IBAN change, receive, convert, approve level 1 and level≥2,
direct payment) under one `erp.purchasing:write` check — `doc.approve`'s
level≥2 gate was a hardcoded role-name check (`['super_admin',
'administrator']`), not a registered op; `doc.payment` had no RBAC op and
no threshold check at all. `requiredApprovalLevels` used the hardcoded
`DEFAULT_APPROVAL_MATRIX` (50M/500M) while a SEPARATE, real `approval_matrix`
table already held purchasing tiers (0–100M/100M–1B/>1B) that the Approval
Center reads — two sources of truth. `submitDocument`'s budget check
summed `date LIKE 'YYYY%'` (Gregorian-string hack) and counted EVERY
document in a department for the year, including a PR *and* the PO *and*
the invoice it was converted into — the same purchase counted up to three
times. `lineSchema`/`docSave` had no qty/percentage bounds and `date` was
free text; `?id=`/`?vendorPosition=`/`?evaluations=`/`?compare=` all did
`Number(sp.get(...))` — a bogus value became `NaN` and hit PostgreSQL raw.

**Two decision_gates, both answered by the maintainer before any code for
those specific sub-items:**
- BUG-ERP-16: `doc.payment`'s default mode is **warn**, thresholds are
  **Rial** (the `erp_settings.direct_payment_mode` seed and `migrate.ts`'s
  stray "Toman tiers" comment are now explicitly addressed — the comment
  was simply wrong, not a real unit).
- BUG-ERP-17: purchase approval stays on the **existing legacy path**
  (`decideApproval`/`purchase_approvals`), which now READS its threshold
  from the configurable `approval_matrix` table instead of a second
  hardcoded matrix — no migration of open approvals needed, no UI change.

## بند۱ — Items

### BUG-ERP-15 — approved/received purchase documents were editable

**Status: built-new.**

`saveDocument` now `SELECT ... FOR UPDATE`s the document when `id` is
given and rejects the edit (`PurchaseDocLockedError`, mapped to a 409
`ERP-PURCHASING-DOC-LOCKED`) unless the current status is `draft` or
`rejected` — both guaranteed to have no downstream document referencing
their lines yet, so the existing delete-and-reinsert line-write pattern is
safe to keep as-is (the orphaning risk the audit described can only occur
on a document a receipt/invoice already points at, and that document can
no longer be edited at all now).

### BUG-ERP-16 — separation of duties not enforced

**Status: built-new.**

- New ops registered in `SENSITIVE_OPS['erp.purchasing']`: `receive`,
  `convert`, `approve`, `approve_high`, `pay`, `vendor_bank_change`.
- The route's top-level gate is now `requirePermission('erp.purchasing',
  'read')` (was `'write'`) — a Warehouse Keeper, who only ever holds `read`
  on the module, can now reach `doc.receive` through its own `requireOp`
  check. Every action that needs GENERIC write capability (not covered by
  a specific op — vendor create, non-bank vendor update, evaluate, doc.save,
  doc.submit, portal link/revoke) re-checks `write` itself via a small
  `requireWrite()` helper.
- `vendor.update` splits: changing `iban`/`bankName` requires
  `erp.purchasing:vendor_bank_change` specifically, is audited with the
  OLD and NEW values, and raises a `vendor_bank_changed` business_alert —
  a plain purchasing-write grant no longer lets anyone silently redirect
  where a vendor's money goes.
- `doc.approve`'s level≥2 check is now `erp.purchasing:approve_high` (an
  op, grantable per-user) instead of a hardcoded role-name check.
- `doc.convert` requires `erp.purchasing:convert`.
- `doc.payment` requires `erp.purchasing:pay` AND passes through
  `directPaymentGate` (new function): `erp_settings.direct_payment_mode`
  (`off`|`warn`|`block`, default **warn** per the decision_gate) compares
  the Rial amount against the SAME `DEFAULT_APPROVAL_MATRIX`'s first tier;
  `warn` raises a `direct_payment_above_tier` business_alert and still
  allows the payment, `block` rejects with 409
  `ERP-PURCHASING-DIRECT-PAYMENT-BLOCKED`.
- Role templates updated NON-DESTRUCTIVELY (idempotent `UPDATE ... WHERE
  is_system=true AND NOT (ops::jsonb ? '<key>')` — never touches a row an
  operator has since customized, matching the existing PROC-FLOW-1
  precedent): Warehouse Keeper gets `receive`; Procurement gets `convert`+
  `receive`; CFO/Finance Specialist/Finance & HR Manager/Senior Admin get
  `approve`+`approve_high`+`pay`+`vendor_bank_change`; Admin gets only the
  lower-tier `approve` (mirroring its existing lighter-than-Senior-Admin
  pattern on confirm/void/post).

### BUG-ERP-18 — weak input validation

**Status: built-new.**

New `src/lib/api/financeSchemas.ts` — shared zod primitives: `money`
(finite, ≥0, capped), `positiveMoney`, `signedMoney`, `qty` (strictly
positive), `pct` (0–100), `isoDate` (format AND real-calendar-date
checked — `2024-02-30` is rejected), `currencyCode`, `idParam` (coerced,
positive integer) + `parseIdParam`. Wired into:
- `purchasing/route.ts`: `lineSchema` (qty/unitPrice/discountPct/taxPct),
  `docSave`'s `date`/`budget`, `docPayment`'s `amount`/`date`, and every
  `?id=`/`?vendorPosition=`/`?evaluations=`/`?compare=` query param (a
  bogus value is now a 400 naming the field, never a raw 500 from a NaN
  reaching Postgres).
- `sales/documents/route.ts`: the `?id=` param (same NaN class) and
  `createSchema`'s `date`/`dueDate`.
- Scoped to the two routes the audit's own evidence cites and
  `audit_first` names; `sales/payments`, `finance/journal`, `treasury` were
  not touched this phase — logged as finding-for-later (بند۳), since this
  codebase's other routes already have reasonably-bounded ad hoc schemas
  (verified by direct read) and migrating them onto the shared module with
  live proof for each is a larger, separate piece of work.

### BUG-ERP-17 — two approval systems; wrong-unit hardcoded thresholds; budget triple-counted

**Status: built-new (decision_gate ب answered).**

- New `purchaseApprovalLevels(baseAmount, docType)` — reads `approval_matrix`
  (doc_type `purchase_order`/`purchase_request`) for the active row whose
  `[min_amount, max_amount]` band contains the amount, returns that row's
  `levels` JSON-plan length; falls back to the pure `DEFAULT_APPROVAL_MATRIX`
  only when no matrix row exists for that doc_type. `submitDocument` now
  calls this instead of the pure `requiredApprovalLevels` directly — one
  real source of truth, matching the Approval Center's own matrix exactly.
- Budget committed-spend query now excludes any document that has a
  non-void CHILD via `source_id` (`NOT EXISTS (SELECT 1 FROM
  purchase_documents c WHERE c.source_id=p.id AND c.status<>'void')`) — only
  the HEAD of each conversion chain (PR→PO→invoice) is counted, so the same
  purchase is counted exactly once regardless of how many stages it has
  gone through.
- Fiscal year is now the real `gl_fiscal_periods` row (`kind='year'`
  covering the document's date), not a `LIKE 'YYYY%'` Gregorian-string hack.
- `department` is now validated against `erp_cost_centers` (`kind=
  'department'`, active) — the existing canonical registry this codebase
  already built in Phase 26.11 to replace free-text department strings on
  other tables — instead of accepting any string. An unknown department is
  rejected with the exact name.

## بند۲ — Already-existing, verified, NOT rebuilt

- `erp_cost_centers` (kind='department') — Phase 26.11's canonical
  department registry, reused as the validation source, not duplicated.
- `approval_matrix` + its seeded `purchase_order` tiers — already existed
  (Approval Center), reused as the one real threshold source per the
  decision_gate's answer, not rebuilt.
- The maker≠checker guard on `decideApproval` — untouched, still the real
  separation-of-duties backbone for the approval decision itself.

## بند۳ — Finding-for-later (not fixed, out of this phase's scope)

- `sales/payments`, `finance/journal`, and `treasury` routes were not
  migrated onto `financeSchemas` this phase (BUG-ERP-18's evidence list
  named purchasing + sales/documents specifically; the others already have
  reasonable per-field bounds on direct read and would need their own
  red/green proof to touch responsibly).
- A pre-existing, UNRELATED bug surfaced while writing this phase's own
  verify script: the seeded `CFO` role template's `grants` JSON contains a
  bare `"analytics":"read"` key that `setGrant`'s `isValidKey` rejects —
  applying the CFO template via the real `/admin/users/[id]/permissions`
  UI would throw on that one key today. Not a purchasing-controls defect,
  logged here rather than silently fixed inside this phase's scope.

## بند۴ — Live PostgreSQL proof

`scripts/verify-erpfix-4.ts` — **28/28 assertions pass**, registered as a
regression suite in `scripts/ci-regressions.ts`. Through production
functions (`saveDocument`, `submitDocument`, `convertDocument`,
`decideApproval`, `directPaymentGate`, `purchaseApprovalLevels`) and real
role-template application (`setGrant`/`setOp` — the SAME primitives the
real permissions UI uses), per CLAUDE.md rule 15:

- a real Warehouse Keeper/Procurement/CFO user (built from the actual
  seeded role templates) holds exactly the ops each should and none it
  shouldn't — receive-only for the warehouse, convert+receive for
  procurement, approve_high/pay/vendor_bank_change for the CFO;
- the direct-payment gate correctly passes a small amount through
  unchanged and warns (never blocks) an amount over the first tier, per
  the decision_gate's answer;
- editing an APPROVED PO's price is rejected and the price is provably
  unchanged; a DRAFT PO's price is still editable;
- every `financeSchemas` primitive rejects its documented bad input;
- `purchaseApprovalLevels` returns 1 for a 50M PO and 3 for a 2B PO,
  matching the real `approval_matrix` seed, not the old hardcoded matrix;
- a PR→PO chain for the same 100,000,000 Rial purchase submits successfully
  against a 1B budget TWICE (once per stage) without double-counting — the
  chain-head-only query independently confirms exactly 100,000,000 committed,
  not 200M+;
- an unknown department is rejected by name.

Full regression suite: **41/41 green**, run live against a fresh
PostgreSQL database. Gates: TypeScript 0 errors · ESLint 0 · `npm run build`
clean · full `npm run audit` (14 governance audits) clean · 1371/1371 unit
tests (7 new, `financeSchemas`).

`audit:sql`/`audit:gl-writes`'s written-reason allowlist line numbers for
`sales/documents/route.ts` and `purchasingData.ts` were re-synced after
this phase's edits shifted both files' lines — line-number upkeep only, no
behavior change, not a contract change.

## بند۵ — Required confirmations from the maintainer/accountant

- **BUG-ERP-16 decision_gate: answered.** `direct_payment_mode` defaults
  to `warn`, thresholds are Rial.
- **BUG-ERP-17 decision_gate: answered.** Purchase approval stays on the
  legacy `decideApproval` path, now reading `approval_matrix`.
- **New, smaller decision for the maintainer:** the `approval_matrix`
  seed's purchasing tiers (0–100M→1 level, 100M–1B→2, >1B→3) are a
  DIFFERENT shape than the old hardcoded `DEFAULT_APPROVAL_MATRIX`
  (50M/500M). Every purchase document now follows the matrix's tiers —
  please confirm 100M/1B are the intended real thresholds (they were
  already live in the Approval Center before this phase; this phase only
  stopped `submitDocument` from silently diverging from them).
- Recommended, not done this phase: extend `financeSchemas` to
  `sales/payments`/`finance/journal`/`treasury`, and fix the CFO role
  template's invalid `analytics` grant key (بند۳).

## New CLAUDE.md rule

> «هر شاخهٔ حساس خرید requireOp مجزا دارد؛ سند خرید بعد از تأیید
> غیرقابل‌ویرایش است؛ ورودی مالی فقط با financeSchemas.»

(Added as rule 59, with the full mechanism spelled out — see CLAUDE.md.)
