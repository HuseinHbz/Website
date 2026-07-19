# Design Token Governance

_Single source of truth for design values, and the policy that keeps them centralized._

## Token architecture

| Layer | Location | Consumed by |
| --- | --- | --- |
| **CSS custom properties** | `src/app/globals.css` (`:root`, `[data-theme]`) | The runtime theme — light / dark / high-contrast. |
| **Tailwind semantic scale** | `tailwind.config.ts` | All styling classes (`bg-background`, `border-strong`, `text-text-secondary`, `shadow-brand`, `rounded-lg`, `z-modal`, …). Every entry references a CSS variable — **never a raw hex**. |
| **TypeScript tokens** | `src/lib/design/tokens.ts` | The cases a class cannot reach: values passed to JS libraries (recharts, inline SVG, canvas) and seed / fallback data literals. Exposes `BRAND`, `CHART_PALETTE`, `SOCIAL_BRAND`, `chartColor()`. |

**Rule:** styling goes through a semantic Tailwind class; a value that must live in
JS comes from `lib/design/tokens.ts`. A raw hex should never be re-inlined in a
component.

## Policy — what counts as a violation

| Category | Verdict | Why |
| --- | --- | --- |
| Arbitrary Tailwind color class (`bg-[#07070f]`, `border-[#2a2a3e]`) | ❌ **Violation** | Bypasses the theme — stays a fixed shade in every theme, causing drift. Replace with a semantic class. |
| Hardcoded palette hex in a data literal (`color: '#6366f1'`) | ⚠️ **Reviewable** | Works, but should reference `BRAND` / `CHART_PALETTE` so the palette has one owner. |
| `fill`/`stroke`/`stopColor` in inline SVG art | ✅ Accepted | Illustration artwork, not themeable UI surface. |
| Decorative gradients / glow shadows in inline `style` | ✅ Accepted | One-off ornamental effects; not part of the semantic scale. |
| Official external brand colors (LinkedIn `#0077b5`, WhatsApp `#25d366`, …) | ✅ Accepted | Owned by third parties; centralized in `SOCIAL_BRAND`. |

## Automated enforcement

`npm run audit:tokens` (script: `scripts/design-token-audit.mjs`) scans `src/`,
classifies every hex occurrence, and **fails CI** if arbitrary-class violations
exceed the budget (currently `20`, ratcheted toward `0`). It runs in the ESLint
CI job.

```
npm run audit:tokens          # human-readable compliance report
npm run audit:tokens -- --json # machine-readable, includes the violation list
```

## Current compliance snapshot

| Metric | Value |
| --- | --- |
| Files scanned | 263 |
| Total hex occurrences | 1088 |
| **Arbitrary-class violations** | **0** (budget 20) |
| Reviewable data literals | 606 |
| Accepted — SVG art | 269 |
| Accepted — decorative / brand | 127 |

## Remediation performed

- Created `src/lib/design/tokens.ts` as the TypeScript token source of truth.
- Eliminated **all ~40 arbitrary-class violations** — theme-breaking near-duplicate
  surface/border hexes (`#07070f`, `#1e1e2e`, `#2a2a3e`, …) were mapped to their
  semantic classes (`bg-background`, `border-border`, `border-strong`, …), so
  those surfaces now follow the active theme.
- Migrated the highest-traffic data literals (Hero stats, About timeline) to
  `CHART_PALETTE` / `BRAND`, dropping reviewable literals from 630 → 606.
- Added the `audit:tokens` script and wired it into CI to prevent regression.

## Backlog (tracked by the audit budget)

The remaining reviewable literals are seed / fallback content colours and
recharts series colours. They are safe today but should migrate to
`CHART_PALETTE` / `BRAND` opportunistically; lower the `VIOLATION_BUDGET` and
extend the audit to flag palette literals once the count is driven down.
