# Phase 26.19 — CFO Operational Simulation (PART 16)

Executed as one scripted end-to-end simulation against a **real PostgreSQL 16**
database (fresh migrate + seed), switching hats per section. 43/43 assertions.
Script: the phase verification runner (ephemeral DB, dropped after the run).

## As Warehouse Manager
1. Created `MAIN` (standard, temperature-controlled, capacity 10 000) and
   `TRANSIT` (transit-type) warehouses; profile persisted.
2. Built the layout: zone A / aisle 1 / rack R2 / shelf S3 / bin B4.
3. **Received** 200 units of BULK-1 in two GRNs (100 @ 100, 100 @ 120).
4. Registered 2 serialized phones (one with a valid-Luhn IMEI); a bad-Luhn IMEI
   was **rejected**. Registered 2 medicine batches (one expiring in 10 days);
   production-after-expiry was **rejected**.
5. Cycle count: snapshot (3 lines) → counted 195 (5 missing) → submitted.

## As Sales/Logistics
6. Created shipment SHP-… (20 bulk + 1 serialized phone) — stock auto-reserved;
   available dropped 200→145→(60 reserved after shipment).
7. Lifecycle enforced: draft→shipped (skipping pick/pack) **rejected**;
   picking showed 20 **in-transit**; packed → **shipped** wrote real issue moves
   (on-hand 200→180), consumed the reservation, marked SN-1001 **sold**
   (tracking TPX-123, container C-9); delivered; then **returned** — stock back
   to 200, serial → returned.

## As CFO
8. Approved the cycle count (posting **before approval was rejected**) and
   posted it: 1 adjustment move, value Δ **−500**, GL entry **Dr 5000 COGS 500 /
   Cr 1200 Inventory 500** — balanced.
9. Revalued BULK-1 100→110 (× 195 on hand): Δ **+1950** posted to the GL.
10. Reviewed Stock Intelligence: BULK-1 = class **A**, movement classes live,
    near-expiry LOT-EXP flagged, reorder suggestions ranked.
11. Migrated legacy customers from a **native .xlsx** (Persian sheet «مشتریان»,
    legacy headers auto-mapped): **dry run** simulated 2 rows and wrote
    **nothing**; the real run imported 2; the Persian-digit phone
    «۰۹۱۲ ۳۴۵ ۶۷۸۹» was cleansed to `09123456789`.

## As External Auditor
12. The **entire posted ledger balances** (Dr 2 450 = Cr 2 450 across the
    shrinkage + revaluation entries).
13. The **inventory ledger reconciles** with the physical count (195).
14. The valuation, Stock Intelligence and Expiration **reports reconcile** with
    the ledger. Recall marked every affected serial; EAN-13 labels render.

**Verdict: inventory ⇄ warehouse ⇄ logistics ⇄ accounting ⇄ reports all
reconcile. Simulation PASSED (43/43).**
