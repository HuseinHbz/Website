# Phase 26.19 — Inventory, Supply Chain & Advanced Migration Audit (PART 0)

Audit-first review in eight hats (Architect · Supply Chain Director · Warehouse
Manager · Procurement Director · Manufacturing Consultant · Controller · External
Auditor · QA Lead). Legend: ✅ exists · ⚠️ enhance · ❌ missing.

## Already exists ✅ (REUSE — no rebuild)
- **Inventory core** (Phase 21/26.10/26.15): `inv_warehouses`, `inv_locations`
  (**rack/shelf/bin already modeled**), `inv_products` (track_lot/track_serial
  flags, reorder point, min/max/safety), `inv_moves` signed ledger (**already
  carries `lot`, `serial`, `location_id`**, types receipt/issue/transfer/
  adjustment/return/count), transfers (two rows sharing a ref), opening stock,
  server-limited product search.
- **Costing engine** (pure, tested): FIFO / LIFO / **weighted average** (=moving
  average over the move history), `stockStatus`, `suggestedReorderQty`,
  `inventoryKpis`. GRN→inventory (26.1), purchase invoice → GL Dr 1200 Inventory.
- **Barcode/QR**: pure Code 39 SVG engine (`erp/barcode.ts`) + `qrcode` dep.
- **Import Center** (26.18): CSV/JSON pipeline, mapping, validation, duplicates,
  tiers, transactional execute, `migration_transactions` rollback, analytics.
- **Workflow + Approval engines** (26.12), RBAC + `logAction` audit, Reporting
  Center fixed catalog (inventory valuation report), Currency/Tax engines,
  Master-data quality validators (incl. Iranian national-id), Data Quality.
- **GL**: seeded `1200 Inventory`, `5000 Cost of Goods Sold`; posting primitives
  (`PostingLine`/`postingBalanced`), `nextNumber('journal')`.

## Needs enhancement ⚠️
- Warehouse master: no `wtype` (standard/virtual/transit/damaged/reserved),
  capacity, temperature flag; locations lack an explicit `zone`/`aisle`. → ALTERs.
- Barcode: EAN-13/EAN-8 (retail) missing next to Code 39. → pure check-digit
  engine + SVG.
- Import execute: no **dry-run** (simulate without committing); no input
  **cleansing/normalization** (Persian digits, phone, email). → build.
- Reporting: inventory has only Valuation. → aging/ABC/XYZ/expiry/turnover defs.

## Missing completely ❌ (→ BUILD this phase)
1. **Serial/Batch/IMEI registries** — `inv_serials` (serial/IMEI lifecycle
   in_stock→reserved→sold→returned→damaged→recalled, warranty, IMEI **Luhn**
   validation) + `inv_batches` (lot, expiry, production date, manufacturer, qty)
   with traceability and search-by-serial/IMEI. Moves carry serial/lot strings
   today but nothing registers or tracks them.
2. **Stock states** — reserved/available/blocked/damaged/in-transit. →
   `inv_reservations` (kind reserve/block/damage; available = onHand − held) +
   transit via shipment lifecycle.
3. **Cycle counting** — `inv_counts`/`inv_count_lines` (system vs counted,
   variance) with an approval lifecycle (draft→submitted→approved→posted) that
   posts real `adjustment` moves + a **GL entry** (Dr/Cr 1200 vs 5000).
4. **Logistics** — `inv_shipments`/`inv_shipment_lines` lifecycle
   (draft→picking→packed→shipped→delivered / returned), carrier/tracking/
   container fields; shipping writes real issue moves; cross-dock = transit
   warehouse + transfer.
5. **Stock intelligence** — ABC (cumulative value), XYZ (demand CV), fast/slow/
   dead movement classes, stock aging buckets, turnover, **EOQ**, reorder
   suggestions, near-expiry — pure engine over the existing move ledger.
6. **Native XLSX import** — zero-dependency .xlsx reader (ZIP STORE+DEFLATE via
   node zlib, sharedStrings, multi-sheet, inline strings, cached formula values,
   full Unicode/Persian) closing the 26.18 boundary without a heavy dep.

## Honest boundaries (documented, NOT stubbed)
Direct external connectors (SQL Server/Oracle/MySQL/SAP/Dynamics/Odoo live
connections, FTP/SFTP), scheduled/background-queue imports with pause/resume,
camera/mobile barcode *scanning* (needs a heavy decoder dep; manual scan-input
search ships), offline sync, temperature telemetry, formula *evaluation* (cached
values are read), AI mapping (deterministic auto-map ships; `runCompletion` hook
is the roadmap). These need infra or dependencies the governance gates forbid —
recorded in the completion report as roadmap.
