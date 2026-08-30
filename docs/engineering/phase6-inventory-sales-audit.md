# Phase 6 — Sales ↔ Inventory ↔ Fulfillment Discovery

Real repository inspection, before any code change. Baseline commit `c389990`.

## Architecture Map

- **Sales**: `sales_customers` / `sales_documents` (unified quote/order/invoice/
  credit_note, `doc_type` CHECK) / `sales_document_lines` / `sales_payments`.
  Pure engine `src/lib/erp/sales.ts`, data layer `src/lib/erp/salesData.ts`,
  route `src/app/api/admin/erp/sales/documents/route.ts`.
- **Inventory**: `inv_warehouses` / `inv_products` / `inv_moves` (signed-qty
  ledger, the single stock ledger) / `inv_reservations` (holds: kind
  reserve|block|damage, status active|released|consumed) / `inv_shipments` +
  `inv_shipment_lines` (logistics, Phase 26.19 PART 6). Pure engine
  `src/lib/inventory/stockOps.ts` (`stockState`, `canHold`, `canIssueDirect`,
  the shipment state machine), data layer `src/lib/inventory/
  inventoryOpsData.ts`.
- **Purchasing↔Inventory**: already linked (`receiveDocument` writes real
  `inv_moves` receipt rows, Phase 4/5 hardened this atomically).
- **Sales↔Inventory**: **NOT linked at all**, confirmed by grep and by direct
  reading of `salesData.ts` (`saveDocument`/`confirm` never touch
  `inv_moves`/`inv_reservations`/`inv_shipments`) and of `inv_shipments`'
  schema (`customer_id` references `sales_customers` directly for a generic
  logistics ship-to, there is **no `sales_document_id` column** anywhere).

## Current Sales Flow

`quote → order → invoice → credit_note`, one unified `sales_documents` table.
`confirm` on an **invoice** runs a credit-limit check (transactional, advisory-
locked per customer, Phase 3) then auto-posts revenue/AR/VAT to the GL
(`postSalesInvoiceToGl`). `confirm` on an **order** just flips `status` — no
side effect beyond that. There is **no "approved" status** distinct from
`confirmed` for sales documents (`draft/sent/confirmed/partial/paid/void`) —
this repo's real approval concept for sales is `confirmed`.

## Current Inventory Flow

`inv_moves` is the one signed-qty stock ledger (receipt/issue/return/transfer/
count/adjustment). On-hand = `SUM(qty)` per product×warehouse. Reservations
are `inv_reservations` rows (a **hold**, not a physical move) —
`available = onHand − reserved − blocked − damaged` (`stockState` in
`stockOps.ts`), matching the exact formula this phase's own prompt expects.
`canHold(state, qty)` already enforces `reserved <= available` correctly as
pure logic.

## Current Fulfillment Flow

`inv_shipments` already implements a real state machine (`draft → picking →
packed → shipped → delivered/returned/cancelled`, `canTransitionShipment`).
`createShipment` creates a `reserve` hold per line. `advanceShipment` to
`shipped` consumes the hold and writes a real `inv_moves` issue row; to
`cancelled` releases the hold; to `returned` writes a real `inv_moves` return
row. This is a genuine, working fulfillment engine — but it is a **standalone
logistics module** with zero structural connection to `sales_documents`.

## Current Accounting Flow

Sales invoice confirm → `postSalesInvoiceToGl` (Dr AR / Cr Revenue / Cr VAT).
Sales payment → `postSalesPaymentToGl` (Dr Bank / Cr AR). **No COGS posting
exists anywhere in the sales/inventory path** — `valuate()` in
`erp/inventory.ts` computes a `cogs` NUMBER for reporting (FIFO/LIFO/WAVG),
it never writes a GL entry. The only Inventory↔GL posting that exists today
is the inventory-adjustment poster in `stockOps.ts` (Dr/Cr 1200↔5000 for
manual count/adjustment variances) — unrelated to a sale.

## Existing Reservation Support

Real (`inv_reservations` + `createHold`/`releaseHold`), but **not
transactional and not lock-protected** — `createHold` does a bare read
(`stockStateFor`) then a bare `INSERT`, no `withTransaction`, no
`pg_advisory_xact_lock`. Two concurrent holds on the same product×warehouse
can both read the same `available` and both pass `canHold`, over-reserving
past physical stock. **Confirmed, real, P0 concurrency defect** — this is
the exact race the phase's own 6B test describes.

## Existing Delivery Support

Real (`inv_shipments`/`inv_shipment_lines`/`advanceShipment`), same defect
class: `createShipment` and `advanceShipment` run as sequences of bare
`pgQuery` calls with **no transaction at all** — a mid-sequence failure
(e.g. the 3rd of 5 shipment lines fails to insert) leaves a shipment header
with a fraction of its lines and a fraction of its holds; a forced failure
during `advanceShipment`'s ship transition could leave holds consumed but
`inv_moves` rows only partially written. **Confirmed, real, P0/P1 atomicity
defect.**

## Existing COGS Support

None tied to a sale. `gl_accounts` seed already has the standard 1200
(Inventory) / 5000 (COGS) pair (reused by the adjustment poster), so the
accounts exist — only the posting trigger for a sales-driven stock issue
does not.

## Transaction Boundaries

`withTransaction()` (`src/lib/db/index.ts`) is the established helper —
already used correctly by `purchasingData.ts` (Phase 4/5), `glPosting.ts`,
`salesData.ts`'s confirm/credit-check path. Not yet used anywhere in
`inventoryOpsData.ts`.

## Concurrency Risks

1. `createHold` — read-then-insert race (above). **Real, confirmed.**
2. `createShipment` — per-line loop of unlocked inserts + `createHold` calls;
   two concurrent shipments for the same product can each pass their own
   pre-loop `canHold` check (computed before any insert) and then both
   insert, over-reserving. **Real, confirmed** (same root cause as #1,
   compounds it).
3. `advanceShipment` to `shipped` — reads shipment status, then does a
   sequence of unlocked updates/inserts; two concurrent "ship" calls on the
   *same* shipment could both pass the `canTransitionShipment` check (read
   before either writes) and both attempt to consume the same hold and both
   write an issue move — **double stock issue**. **Real, confirmed.**

## Idempotency Risks

No idempotency guard exists on any inventory-ops write path (`createHold`,
`createShipment`, `advanceShipment`) — unlike the sales/purchasing routes,
which gained `runOnce` guards in Phases 3–5. A retried "ship" request today
has no protection beyond the state machine itself, and the state machine
check itself races (above).

## Authorization Risks

`inv_reservations`/`inv_shipments` writes are RBAC-gated at the route level
today (`erp.inventory` permission on `/api/admin/erp/inventory/ops`) — this
part is sound and unchanged by this phase. No IDOR was found in existing
inventory-ops routes (ids are looked up and a missing row already 404s/400s
per the established pattern). Nothing about sales-order fulfillment
authorization exists yet because the linkage itself doesn't exist.

## Audit Gaps

`inv_reservations`/`inv_shipments` mutations are **not** currently
`logAction`-audited at all (grep of `inventoryOpsData.ts` and its route: no
`logAction` calls). This is a real, pre-existing gap, not introduced here.

## Error Handling Gaps

`createHold`/`createShipment`/`advanceShipment` all `throw new Error(string)`
on failure — none of them use the bilingual error catalog
(`src/lib/errors/`). The route wraps them in a try/catch → generic `apiError`
(English only, no `code`/`fa`). This phase's new failure paths (insufficient
stock on reservation, delivery exceeding reservation) will use the catalog;
the pre-existing plain-Error paths in `advanceShipment`/etc. are left as is
(fixing every existing inventory-ops error message is outside this phase's
scope — see CLAUDE.md "never modify unrelated modules").

## Schema Gaps

- `sales_documents` has **no warehouse concept at all** — a genuine,
  necessary, minimal schema decision this phase must make (a sales order
  needs a fulfillment warehouse before anything can be reserved against it).
  Added: `sales_documents.warehouse_id` (nullable FK → `inv_warehouses`,
  additive, backward compatible — existing orders/invoices with no warehouse
  simply never reserve/deliver, exactly like a standalone purchase invoice
  with no PO behind it in Phase 5).
- `inv_shipments` has no link back to `sales_documents` — added:
  `inv_shipments.sales_document_id` (nullable FK), `gl_entry_id` (nullable,
  for idempotent COGS posting).

## Confirmed Defects

1. **P0** `createHold` — unlocked read-then-write reservation race.
2. **P0** `createShipment`/`advanceShipment` — no transaction at all; a mid-
   sequence failure leaves partial shipment/hold/inv_moves state; concurrent
   "ship" on the same shipment can double-issue stock.
3. **P1** No COGS posting exists for a sales-driven stock issue — revenue is
   recognized (via invoice confirm → GL) with nothing relieving inventory /
   charging COGS, so the income statement is structurally incomplete for any
   company actually using the inventory module for sales fulfillment.

## Architectural Gaps

- No per-order reserved/delivered quantity tracking exists on
  `sales_document_lines` (no `reserved_qty`/`delivered_qty` columns). Adding
  full per-line quantity ledgering (mirroring purchasing's `received_qty`)
  is a legitimate, larger product decision than "the smallest architecture
  consistent with the existing model" calls for in one phase — this phase
  computes delivered/reserved-remaining **from the `inv_reservations`/
  `inv_moves` `ref` tag** (`SO-{orderId}-{lineId}`) rather than adding
  redundant denormalized counters on the sales line, avoiding a second
  source of truth. This is the smallest correct addition; a full
  denormalized counter set remains documented as future work if reporting
  performance ever requires it.
- No distinct "approved" status exists for sales orders (see above) —
  `confirmed` is used as this phase's approval gate, matching the
  established real terminology rather than inventing a new status.
- No per-line delivery entity exists (mirroring purchasing's GRN) —
  delivery reuses the EXISTING `inv_shipments` engine (adds one FK) rather
  than building a second delivery framework, per the phase's own explicit
  instruction not to duplicate concepts.

## Out-of-Scope Items (this phase)

- A full picking/packing UI workflow (draft→picking→packed intermediate
  steps stay available via the existing granular `advanceShipment` API; a
  convenience "confirm delivery" wrapper walks all three hops in one
  transaction for the common case of an already-packed simple sale).
- Sales return / delivery reversal beyond what already exists on the
  `inv_shipments` `returned` transition (already writes a real reversing
  `inv_moves` return row) — a COGS reversal on return is added since it is
  a direct, required consequence of adding COGS in the first place;
  anything beyond that (partial returns with different valuation) is
  documented as remaining work.
- Auditing every pre-existing inventory-ops error message through the
  catalog (only the new failure paths this phase introduces use it).
- Multi-warehouse split delivery in one shipment (a shipment already has one
  `warehouse_id`; splitting one sales order across two warehouses in one
  delivery would need two shipments — already possible by calling deliver
  twice, not a new concept).

## Recommended Implementation Order

1. Schema additions (`sales_documents.warehouse_id`,
   `inv_shipments.sales_document_id`/`gl_entry_id`) — additive, safe.
2. Harden `createHold`/`releaseHold` (transaction + advisory lock,
   `stockStateFor`/`onHandOf`/`holdsOf`/`inTransitOf` gain an optional
   injected `TxQuery` param, default `pgQuery`, backward compatible).
3. Harden `createShipment`/`advanceShipment` (single transaction, holds
   created via the SAME injected query/lock — closes the compound race).
4. Add COGS posting inline inside `advanceShipment`'s ship-transition
   transaction (idempotent via `inv_shipments.gl_entry_id`), and a reversal
   on the return transition.
5. Add `reserveSalesOrder`/`releaseSalesOrderReservation`/`deliverSalesOrder`/
   `confirmDelivery` in a new `src/lib/erp/salesFulfillment.ts`, wired into
   the sales/documents route's existing `confirm` branch for `doc_type=
   'order'` (reservation) and a new fulfillment route (delivery).
6. New error catalog codes actually wired to behavior only.
7. Audit logging on every new mutation point.
8. Live-PostgreSQL verification: concurrency (reservation race, shipment
   race), rollback (forced failure), idempotency (concurrent identical
   delivery), financial reconciliation (order→delivery→inventory→COGS→GL,
   trial balance).
9. Regression suite + full quality gate + governance audits.
