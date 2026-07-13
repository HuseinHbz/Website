# Phase 26.19 — Performance Report

Measured on the live-PG verification run (PostgreSQL 16, fresh DB, ephemeral).

## Simulation timings (cumulative ms from start)
| Stage | Cumulative | Stage cost |
|---|---:|---:|
| migrate + seed (full 80+ table schema) | 2 775 | 2 775 |
| warehouse profile/layout + receiving | 2 820 | 45 |
| serial + IMEI + batch registration/search | 2 843 | 23 |
| stock states + 3 holds + over-hold guard | 2 858 | 15 |
| full shipment lifecycle (6 transitions) | 2 921 | 63 |
| cycle count + approval + GL posting | 2 955 | 34 |
| intelligence (ABC/XYZ/aging) + 2 reports | 2 987 | 32 |
| native XLSX import (parse→validate→dry-run→execute) | 3 063 | 76 |

Everything after schema creation runs in **< 300 ms total** — every operational
path is a handful of indexed queries.

## Design choices that keep it fast
- **Intelligence** assembles from 3 aggregate queries (monthly issues, last
  move, last receipt) + one `loadProductLevels` pass — no per-product N+1.
- **Serial/IMEI search** uses `idx_inv_serials_imei` + `LIMIT 25`; traceability
  loads per hit only.
- **Cycle count snapshot** is a single `GROUP BY` over the move ledger.
- **XLSX parsing** is single-pass in memory (regex extraction over fixed OOXML
  shapes, zlib native inflate); uploads capped at 8 MB / 20 000 rows.
- **Import execution** stays a single transaction with prepared statements;
  dry-run reuses the identical path + ROLLBACK (zero write amplification).
- Stock-state math is pure (one holds query + one transit query per lookup).

## Bundle impact
`/admin/inventory` gains four lazy-rendered tabs in the same route chunk;
no new dependency was added anywhere in the phase (XLSX/EAN-13/cleansing are
hand-written pure modules).
