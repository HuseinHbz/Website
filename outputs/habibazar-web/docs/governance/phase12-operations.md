# Phase 12 — Enterprise Operations, Observability & SRE

_Same honesty rule as Phases 10–11: the spec spans ~14 "Centers" plus
Prometheus/Grafana/OpenTelemetry exporters, chaos testing, multi-channel alerting
and self-healing workers — a multi-sprint programme, not a one-pass "150/150"
deliverable. This pass ships a real, verified increment and documents the rest
honestly. No fabricated score._

## The core problem found & fixed

The pre-existing **Operations Center** (`/admin/operations`) was almost entirely
**mock data** — `uptime: 99.7 + Math.random()`, hardcoded "Avg Response 124ms",
fake background jobs, hardcoded Core Web Vitals, invented security events, and
inline-hex styling. That is exactly the placeholder liability every enterprise
phase forbids. Per the phase rule ("extend existing modules, don't duplicate"),
the module was **rewired to genuine telemetry** rather than replaced or cloned.

## Shipped this pass — real Operations telemetry

- `src/lib/ops/snapshot.ts` — in-process telemetry, degrades gracefully, never
  throws; unconfigured subsystems report `offline`/`n/a` honestly.
- `GET /api/admin/operations/overview` — read-only, `manage_settings`-gated.
- `OperationsCenter` rewritten (mock removed, token classes, auto-refresh 10s)
  with tabs: **Overview** (SRE + live metrics + subsystem matrix),
  **Infrastructure** (OS/kernel/runtime/compute/storage), **Errors** (real recent
  error logs).

### Verified live (seeded admin, real values)
| Area | Real reading |
| --- | --- |
| Infra | linux, kernel 6.18.5, node v22.22.2, sqlite 3.53.2, Xeon 4 vCPU |
| CPU / Memory / Disk | 36.3% load · 8% mem (1340/16856 MB) · 4.2% disk (259 GB free) |
| Database | `SELECT 1` in 0 ms, 0.6 MB |
| Subsystem matrix | app/db/backup/scheduler/logging/memory/storage **healthy**; email/AI/cache/queue **offline** (not configured — honest) |
| SRE | availability 100%, error budget 100%, latency budget OK |
| Errors | log-derived, real (0 over 24h → 100% success) |

Maps to the spec's **Operations Center, Health Center, Metrics Platform,
Infrastructure Dashboard, and SRE (SLI/SLO/error budget)** — all on real data.

## Already satisfied by prior phases (not duplicated)

| Phase 12 section | Existing |
| --- | --- |
| Real-time logs, correlation IDs, SSE streaming, search/filter/group/export/retention | `lib/logs/bus.ts` + `/admin/logs-monitoring` + `/api/admin/logs/{stream,query,export}` |
| Backup/Restore health, verification, off-site, retention, reports | BackupEngine + `/admin/backup` + `/api/admin/backup/{engine,run}` |
| Database health / integrity / schema / index census | Database Center (`/admin/database`) |
| Health checks (app/db/memory) | public `/api/health` (real checks) |
| Scheduler / background triggers (cron-free) | `lib/backup/scheduler.ts` |
| Security events / audit trail / rate limiting | `/admin/security`, `/admin/audit`, `middleware.ts`, `lib/rateLimit.ts` |

## Honest roadmap — NOT delivered this pass (each its own focused effort)

- **Alerting platform**: multi-channel (email/Telegram/Slack/Discord/webhook) with
  severity + rules. (Alert *detection* exists in `/api/admin/backup/engine`;
  channel delivery + a rules UI do not.)
- **Self-healing workers, incident management, capacity forecasting, service map**:
  net-new subsystems.
- **Prometheus `/metrics` exporter, OpenTelemetry tracing, Grafana dashboards**:
  the snapshot is exporter-ready (structured numeric fields), but no
  `/metrics` endpoint or OTel SDK is wired.
- **Chaos validation**: needs a fault-injection harness.
- **Redis/queue metrics**: reported `offline` because the platform is single-node
  in-process by design; wiring real cache/queue is the Phase-11 scalability track.

## Validation after this pass
`tsc` 0 · ESLint 0 · vitest 25/25 · design-token/content audits 0 violations ·
production build OK · Operations Center verified live on real telemetry · 0 inline
-hex remaining in the module.
