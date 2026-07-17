# Phase 17 — Infrastructure Ops (SOC increment)

_Same honesty rule as Phases 10–16. Phase 17 (full NOC + SOC + observability +
topology + service discovery + alerting + incident mgmt + DR center) is a large
programme. This pass ships the **verified Security Operations Center** built
entirely on the platform's existing security signal, reusing every subsystem, and
honestly maps the rest. No fabricated 250/250._

## Infrastructure audit (no duplication)
- Security signal is already captured: `logger.security()` → `system_logs`
  (source `security`), audit `LOGIN` events, and the Phase-13 AI-guard blocks.
- Existing `/admin/security` is **2FA / session settings**; Logs & Monitoring is
  the **raw stream**; Operations Center (Phase 12) is **infra/SRE telemetry**.
- The new SOC is a distinct **security-analytics** view (threat posture, risk
  scoring, brute-force detection) — it does not duplicate any of the above, and
  reuses the existing log bus + audit trail as its data source.

## Shipped this pass — Security Operations Center

- **Pure risk model** `src/lib/soc/risk.ts`: `riskScore()` (weighted) +
  `riskLevel()` (low/medium/high/critical; brute-force clusters or security errors
  escalate). Deterministic, **unit-tested** (`__tests__/risk.test.ts`, 5 tests).
- **API** `GET /api/admin/soc/overview` (`manage_settings`-gated, read-only):
  aggregates from `system_logs` + `audit_logs` over 24h — failed logins,
  brute-force IPs (via `json_extract(meta,'$.ip')`, ≥5 attempts), AI injection
  blocks, permission-denied, rate-limited, security errors, successful logins;
  returns top offending IPs + a threat timeline + risk posture.
- **Admin UI** `/admin/soc` (`SocDashboard`): risk-posture banner, 6 security-signal
  tiles, top offending IPs, threat timeline; auto-refresh 15s; semantic tokens;
  sidebar entry beside Security & 2FA.

### Verified live (real signal, not mock)
Drove 6 failed logins from one IP + 1 prompt-injection attempt, then queried SOC:
| Metric | Result |
| --- | --- |
| Failed logins | **6** |
| Brute-force IPs | **1** (10.0.0.66, 6 attempts — shown in topIps) |
| Injection blocks | **1** (from the AI guard) |
| Successful logins | 1 |
| **Risk posture** | **HIGH** (score 29) |

Covers the spec's **SOC Platform** (security incidents, suspicious logins,
brute-force, rate-limit/permission violations, security dashboard, risk levels)
on genuine captured data.

## Honest roadmap — NOT delivered this pass
Each is a real subsystem; stubbing to claim "250/250" would be dishonest:
- **NOC platform** (service/infra health matrix already partly in Operations
  Center; needs business-service mapping, maintenance windows, SLA tracking).
- **Infrastructure inventory + network topology + auto service discovery** — the
  Asset Center (Phase 16) is the inventory foundation; topology/discovery is
  net-new.
- **Prometheus/OTel exporter, Alert Center** (multi-channel + escalation +
  silence), **Incident management** (tickets/RCA/postmortem), **DR center**
  (runbooks/simulation — the Backup Engine already does verified dry-restore),
  **certificate expiry monitoring**, **AI ops assistant**, executive dashboards.

The reusable foundation (log-bus security signal, pure risk model, audited/gated
read API pattern) is what these build on.

## Validation after this pass
`tsc` 0 · ESLint 0 · vitest **50/50** (incl. 5 SOC) · all 5 governance audits pass
(0 broken links — `/admin/soc` recognized) · production build OK. SOC verified live
on real security signal. No module duplicated; existing security/ops modules
untouched.
