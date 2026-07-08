# Phase 25.1 — Hero Platform Intelligence (AI Assistant · Performance · A11y · Recommendations)

Mandatory completion pass on the Phase-23/25 Hero Platform. Adds the intelligence
layer — reusing the **existing AI Platform** (no second AI system) — and the
real-time performance / accessibility / recommendation engines. No rewrite; every
existing hero, template, animation, API, route and public page is preserved.

## Audit (what already existed — not duplicated)

Hero Builder/Center/Experience, Animation Engine (53 presets) + Animation Builder,
Rule Engine (publish-gated), Analytics, Publishing workflow (draft→…→archived +
rollback), Versioning (`hero_versions`), A/B testing, 50 templates
(Classic+Premium), Media picker, and the AI Platform (`runCompletion` — provider
manager, RAG, telemetry `ai_usage`, prompt versioning) were all already present.
Phase 25.1 adds only what was missing, and **reuses** the AI engine.

## What shipped (real, verified)

### AI Content Assistant — reuses the shared AI Platform
- Pure prompt builder `src/lib/hero/aiAssist.ts` (14 actions: title/subtitle/cta/
  features/benefits/value-prop/seo-title/meta/keywords/faq/improve/rewrite/
  summarize/translate × 7 tones × en/fa) — unit-tested.
- API `POST /api/admin/heroes/ai` dispatches through **`runCompletion`** (same
  provider manager + telemetry + prompt system as the rest of the platform),
  RBAC-gated (`edit`) + audited (`hero.ai.generate`). Clean 400 when no AI
  provider is configured. Every suggestion is returned as **editable text** — no
  automatic writes.
- Wired into `HeroBuilder`: an AI toolbar in the Content card (Headline / Subtitle
  / Improve / SEO title / Meta) that fills the current-locale field.

### Smart Recommendation Engine (deterministic + AI-optional)
- `src/lib/hero/recommend.ts` — `recommendAnimations(config, ctx)` maps template
  category → a real per-element animation recipe, auto-lightening heavy/looping
  presets under reduced-motion / mobile. `recommendationRationale` (bilingual).
  Unit-tested. Exposed both via the API (`kind:'animations'`) and a one-click
  "Recommend animations" button in the builder.

### Performance Scoring Engine
- `src/lib/hero/performance.ts` `animationPerformance(config)` → 0–100 score,
  weight, estimated FPS class (60/45/30), heavy/looping counts and warnings from
  the animation registry + background kind. Unit-tested.

### Accessibility (WCAG) Engine
- `accessibilityReport(config)` → 0–100 score + `passesWCAG` + issues (missing H1,
  missing alt, low contrast, unguarded motion, tiny fonts). Reuses the rule
  engine's `contrastRatio`. Unit-tested.

### Real-time Visual Warnings (builder)
- An **Insights** card in `HeroBuilder` shows live Performance + Accessibility
  score bars, estimated FPS/weight, and the combined performance + a11y warning
  list — recomputed on every edit (`useMemo` over the pure engines).

## Verification (all green)

- TypeScript 0 · ESLint 0 · **266 unit tests** (+ new AI-assist / performance /
  a11y / recommendation tests) · all 7 governance audits pass · production build
  OK (96 pages).
- The AI content path reuses the already-verified `runCompletion` (provider +
  telemetry + audit); the recommend/performance/a11y engines are pure and covered
  by unit tests.

## Honest scope note

Delivered for real above. The following prompt items are **larger separate
builds** deliberately **not** faked this pass — they need dedicated schema/UI or
heavy deps the governance audits forbid, and would be their own phase:
a full keyframe **Timeline/Bezier Studio**, an **Animation Library CMS** with
per-animation versioning/import-export/usage analytics, session-replay/heatmap
capture, and a template **marketplace** with digital signatures. The engines
shipped here (registry, performance, a11y, recommendation, AI assist) are the
foundation those would build on.

## Preserved (zero regression)

✓ All 53 animation presets + legacy `Hero.tsx` · ✓ 50 templates · ✓ every
Phase-23/25 API/route/workflow/versioning/analytics · ✓ public homepage · ✓
PostgreSQL-native (AI usage recorded in `ai_usage`; no schema change needed).
