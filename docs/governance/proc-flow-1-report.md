# PROC-FLOW-1 — Purchase & Service-Request Process with 3 Roles

Warehouse Keeper · Procurement · Finance. Audit-first, following CLAUDE.md
rules 2 (read-before-act), 4 (finish every phase completely), 28 (one table,
one owner).

## بند۰ — Mandatory audit (completed BEFORE any schema/code)

| # | Claim | Verified against | Result |
|---|---|---|---|
| 1 | Three roles seeded in `rbac_role_templates` | `src/lib/db/migrate.ts` ~L2693-2700 | Confirmed exactly: Warehouse Keeper (write `erp.inventory`), Procurement (write `erp.purchasing`), CFO/Finance Specialist as the finance equivalents. Reused as-is — **no new template created.** |
| 2 | Full purchase chain already exists | `src/lib/erp/purchasing.ts` + `purchasingData.ts` | Confirmed: `saveDocument`/`convertDocument`/`receiveDocument`/`postPurchaseInvoiceToGl`/`decideApproval`. Not rebuilt — this phase only adds a new entry point (`convertSupplyNoteToPurchase`) that calls `saveDocument`. |
| 3 | Real inventory availability source | `src/lib/inventory/inventoryOpsData.ts` `stockStateFor` | Confirmed (`onHandOf`/`holdsOf`/`inTransitOf` over `inv_moves`/`inv_reservations`). `requestGoods` reads this exact function — no shadow field. |
| 4 | `payment_request` already an approved doc type | `src/lib/approval/matrix.ts` `DOC_TYPES` + seeded `approval_matrix` rows | Confirmed. `requestCashPurchasePayment` calls the EXISTING `createApprovalRequest`/`actOnRequest` — no second approval table/engine. |
| 5 | Service-line detection convention | `purchasingData.ts` `stockPurchaseInvoice` | Confirmed: lines with `product_id == null` ⇒ service-only. `createServiceInvoice` produces lines with `productId: null` — same convention, no new `is_service` flag. |
| 6 (beyond the ask) | Does payment_request SoD need new code? | `approvalData.ts` `actOnRequest` L198 | `isSeparationViolation(docType, createdBy, actorId, onBehalfOf)` runs **unconditionally for every doc type** — SoD for payment_request is inherited with **zero new code**. |
| 7 (beyond the ask) | Is a new sensitive op actually needed? | `erp/approvals/route.ts` gating | `create` only needs generic `erp.approvals:write`; `decide` needs `erp.approvals:approve/reject` + the generic SoD check. Settled: `erp.purchasing:issue_supply_note` NOT needed (covered by `erp.inventory:write`); `erp.finance:approve_payment_request` NOT needed (covered by `erp.approvals:approve` + `users.finance_role`); **`erp.purchasing:request_payment` IS needed** — Procurement's template had no `erp.approvals` grant at all, so without a dedicated op the create-payment_request action couldn't be gated without handing Procurement broad `erp.approvals:write` for every doc type. |

**What rides on existing infrastructure vs. what is genuinely new:**

| Part of the phase | Existing | New |
|---|---|---|
| Inventory availability check | `stockStateFor` | — |
| Direct delivery | `inv_moves` (issue) | — |
| Purchase chain (request→rfq→quotation→order→receipt→invoice) | `saveDocument`/`convertDocument`/`receiveDocument` | — |
| Payment-request approval + SoD | `createApprovalRequest`/`actOnRequest`/`isSeparationViolation` | — |
| GL posting for service invoices | `confirmPurchaseInvoice`/`postPurchaseInvoiceToGl` | — |
| Service-line convention | `stockPurchaseInvoice`'s `product_id == null` read | — |
| RBAC templates | Warehouse Keeper / Procurement / CFO+Finance Specialist | — |
| Supply note raise/convert/auto-close | — | `inv_supply_notes` table + `supplyFlowData.ts` + a hook in `receiveDocument` |
| Service request lifecycle | — | `erp_service_requests` table + `supplyFlowData.ts` |
| `request_payment` op | — | 1 new entry in `SENSITIVE_OPS['erp.purchasing']`, granted to the Procurement template |
| UI | Approval Center inbox (Finance, reused) | Warehouse Keeper "Stock Shortages" tab + Procurement "Supply & Service" tab (`SupplyFlowTab.tsx`) |

## بند۱ — Roles

No new role template created. Op `erp.purchasing:request_payment` added to
`SENSITIVE_OPS` (`src/lib/rbac/registry.ts`) and granted to the existing
`Procurement` template (plus `erp.approvals:write` so it can create approval
requests at all, with `erp.approvals:approve/reject` explicitly `false` — it
can raise a payment_request but never decide one). Retro-fit `UPDATE` added
in `migrate.ts` so an already-seeded install picks up the change.

Separation of duties is enforced for free: `isSeparationViolation` (shared,
generic, already called by `actOnRequest` for every doc type) rejects a
payment_request's creator from approving their own request — proven live
(§ بند۵ below), with zero new SoD code written.

## بند۲ — Data model (two new tables, both with `company_id`)

- `inv_supply_notes` — note_no (via the numbering engine), product/warehouse,
  qty_needed, qty_available_snapshot, status
  (raised→sent_to_procurement→linked_to_purchase→closed/cancelled),
  linked_purchase_document_id.
- `erp_service_requests` — request_no, requester, description, vendor,
  status (requested→quoted→invoiced→financial_doc_sent→closed),
  linked_purchase_document_id.

No "payment request" table was created — `approval_requests` with
`doc_type='payment_request'` is reused exactly as instructed. No
`purchase_documents` schema change was needed for بند۳.۱/۳.۳ (بند۳.۲ never
reached the step that might have required one — see below).

Both tables added to `scripts/tenancy-audit.mjs`'s TRANSACTIONAL list; the
two seeded `numbering_formats` rows (`supply_note`, `service_request`) give
them a proper document-number sequence through the existing Numbering
Engine rather than the fallback.

## بند۳ — Three process paths

### ۳.۱ Main path — BUILT AND VERIFIED
`requestGoods()` checks `stockStateFor`; sufficient → one signed `issue`
`inv_moves` row, no purchase document. Insufficient → `inv_supply_notes`
row (`sent_to_procurement`). Procurement's `convertSupplyNoteToPurchase()`
creates a `purchase_documents` `request` via the EXISTING `saveDocument`,
links it, sets `linked_to_purchase`. From there the existing chain
(submit→approve→convert to order→convert to receipt→receive) runs
completely unchanged. `receiveDocument` (in `purchasingData.ts`) was given
one small addition: when a GRN fully receives, it walks the `source_id`
chain back to the root request and auto-closes any `inv_supply_notes` row
linked to it — no manual close call anywhere.

### ۳.۲ Cash purchase + pre-invoice payment — BUILT UP TO STEP 3 ONLY, THEN STOPPED
Steps 1-3 built and verified: supply note → `requestCashPurchasePayment()`
creates a `payment_request` approval through the EXISTING
`createApprovalRequest`; Finance (role-resolved via the EXISTING
`users.finance_role`/matrix) approves through the EXISTING `actOnRequest`.

**Step 4 is the mandatory stop.** Per the explicit instruction, this exact
question was never guessed and must be put to the project owner:

> **After the pre-invoice cash payment, must the goods still go through a
> warehouse receiving step (GRN), or does payment mark the process as fully
> complete?**

Until answered, nothing beyond step 3 (payment approval) was built for this
path — no GRN-after-payment logic, no "payment = done" terminal status, and
no `purchase_documents` schema change was added for it (the schema change
mentioned as a possibility in بند۲ was never needed because this sub-path
was correctly stopped before reaching the point that would have required
it). This is recorded here as **OPEN**, not quietly deferred.

### ۳.۳ Service requests — BUILT AND VERIFIED
`erp_service_requests` → `createServiceInvoice()` builds a `purchase_documents`
`invoice` via the EXISTING `saveDocument` with every line's `productId: null`
— the exact existing service-line convention. Posting goes through the
UNCHANGED `confirmPurchaseInvoice` → `postPurchaseInvoiceToGl` (Phase
26.15.1 auto-post). `markServiceRequestFinancialDocSent`/`closeServiceRequest`
mirror status, exactly like `advanceDocument`'s pattern for other ref types.

## بند۴ — UI

- Warehouse Keeper: new **"Stock Shortages"** tab in Inventory Center
  (`InventoryCenter.tsx` → `GoodsRequestPanel`) — request-goods form + own
  supply notes on the shared `DataTable`.
- Procurement: new **"Supply & Service"** tab in Purchasing Center
  (`PurchasingCenter.tsx` → `ProcurementSupplyQueue` + `ServiceRequestsPanel`)
  — inbox with Convert/Request-payment row actions, service request create +
  invoice actions.
- Finance: **no new UI** — the existing Approval Center inbox
  (`/admin/approvals`) already lists `payment_request` rows and lets a
  `finance_manager`/`cfo`/`ceo` decide them; nothing was missing.

Both new panels live in one shared file (`SupplyFlowTab.tsx`) reused by both
Centers — no parallel component duplication.

## بند۵ — Live PostgreSQL proof

`scripts/verify-procflow1-supply-service.ts` — **33/33 assertions pass**
against a real PostgreSQL instance, registered as suite #37 in
`scripts/ci-regressions.ts` (full regression run: **36/36 suites green**,
including all pre-existing Phase 17/26.x/27/28.x suites, unaffected).

Covers, through the production functions (no hand-SQL re-interpretation):
1. Sufficient inventory → direct delivery (signed `issue` move), zero
   purchase documents created.
2. Insufficient inventory → supply note → purchase request → submit →
   approve → order → receipt → full receive → supply note auto-closes.
3. Cash purchase → `payment_request` (50M, matrix level 1) does not
   auto-approve; Procurement cannot act on its own request at all (not an
   authorized approver); a Finance user who is ALSO the creator of a
   second request is blocked by `isSeparationViolation` specifically;
   Finance (finance_manager) approves the original Procurement-created
   request successfully; an unrelated Warehouse Keeper is also rejected.
4. Service request → service invoice with zero product_id lines →
   `confirmPurchaseInvoice` → exactly one new posted `gl_journal_entries`
   row → request closes.
5. Three real users (`u-wk1`/`u-proc1`/`u-fin1`), each assigned one of the
   EXISTING seeded RBAC templates via the same `setGrant`/`setOp` code path
   the permissions UI uses — RBAC-tree assertions confirm each role's grant
   boundaries (Warehouse Keeper has no finance access, Procurement holds
   `request_payment` but not `approve`, Finance has finance write).

Gates: TypeScript 0 errors · ESLint 0 · `npm run build` clean · `audit:rbac`
157→171 routes guarded, 0 failures · `audit:tenancy` 17/17 company-aware ·
full `npm run audit` (9 governance audits) clean · 1334/1334 unit tests ·
36/36 regression suites.

## بند۶ — New CLAUDE.md rule

Added verbatim (see CLAUDE.md working rules):

> «برگ تأمین تنها ماشهٔ معتبر ورود به زنجیرهٔ خرید موجود بر مبنای کسری انبار
> است؛ مسیر پرداخت نقدی از نوع سند تأیید `payment_request` موجود عبور
> می‌کند، نه جدول موازی؛ نقش‌های انباردار/تدارکات/مالی از تمپلیت‌های RBAC
> seed‌شدهٔ موجود reuse می‌شوند.»

## Open items (explicit, not silently deferred)

- **بند۳.۲.۴** — GRN-after-payment vs. payment-as-completion: unanswered,
  blocking any work past step 3 of the cash-purchase path. Awaiting the
  project owner's decision.
