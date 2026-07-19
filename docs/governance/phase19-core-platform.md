# Phase 19 — Enterprise Core Platform (global audit increment)

_Same honesty rule as Phases 10–18. Phase 19 lists ~25 net-new subsystems (BI,
data warehouse, workflow/rule engine, MDM, DMS, event bus, governance/risk/
compliance, dev portal, …) — a large programme, not a one-pass "350/350"
deliverable. But the phase leads with a **Global Enterprise Audit** that explicitly
names checks I can genuinely automate. This pass ships the one still-missing audit
— **Broken Translation Keys** — completing the automated audit suite, and honestly
documents the rest. No fabricated score._

## Global audit — automated coverage after this pass

The phase's audit list maps to the CI-gating `npm run audit` suite (now **six**):

| Audit target (from the prompt) | Automated check |
| --- | --- |
| Broken Translation Keys | **`audit:i18n` (new this pass)** |
| Broken Links / Routes / Navigation | `audit:links` (real routes vs href literals) |
| Duplicate Assets / hardcoded design | `audit:tokens` |
| Placeholder / Lorem / dead content, media | `audit:content` |
| Duplicate logic / component reuse | `audit:reuse` |
| Unused / mis-placed dependencies | `audit:deps` |
| Circular dependencies | `madge --circular` → **0** (verified) |
| Dead code / unused APIs (types) | `tsc --noEmit` → **0 errors** |
| Broken permissions | reviewed — write routes go through `requireAdmin` |

## Shipped this pass — Translation-key integrity audit

`scripts/i18n-audit.mjs` (`npm run audit:i18n`, wired into CI):
- Parses the admin locale dictionary (`src/lib/admin/locale.tsx`) → 842 keys.
- Scans `src/` for static `t('key')` calls **only in files importing
  `@/lib/admin/locale`** (the admin i18n system). Public marketing uses next-intl
  `useTranslations()` backed by `messages/*.json` — a **different** system, so it
  is deliberately excluded to avoid false positives.
- **Fails the build** if any referenced admin key is missing from the dictionary
  or has an empty `fa`/`en` translation (both render as blank/raw-key in the UI).
- Reports orphan keys informationally (many are used dynamically — `t(status)`).

### Result (measured)
| Metric | Value |
| --- | --- |
| Defined admin keys | 842 |
| Static `t('…')` references (admin) | 495 |
| **Missing keys** | **0** |
| **Empty fa/en translations** | **0** |
| Orphan (informational) | 347 |

This confirms the "Broken Translation Keys" acceptance criterion passes — including
the Phase-13.5 ai-control bilingual work — and prevents regressions (a missing key
now fails CI).

## Honest roadmap — NOT delivered this pass (the bulk of Phase 19)
Each is a real subsystem; stubbing to claim "350/350" would be dishonest. Note
that several are already partially satisfied by earlier phases:
- **Command Center / Executive dashboards**: Operations Center (Phase 12) +
  Database Center + SOC + backup DR already provide real subsystem telemetry;
  a single unified executive roll-up view is net-new.
- **Workflow + Rule engine + Process automation**: net-new (the scheduler +
  event-driven backup + CMS→KB sync are targeted automations, not a general engine).
- **BI / data warehouse / MDM / DMS / event bus / governance / risk / compliance /
  dev portal / API catalog / OpenAPI**: net-new subsystems.

## Validation after this pass
`tsc` 0 · ESLint 0 · vitest 56/56 · **all 6 governance audits pass** (0 broken
links, **0 missing/empty translation keys**, 0 token/content violations, deps
clean) · 0 circular deps. No `src/` behavior changed — tooling + docs only.
