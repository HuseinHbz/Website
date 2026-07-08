# Phase 25 — Enterprise Hero Experience Platform (Animation Engine)

Extends the Phase-23 Hero Platform into a complete enterprise edition **without a
rewrite** — every existing engine, API, template, route and the public renderer
are preserved. No regression.

## Pre-implementation audit (findings)

- **Legacy `Hero.tsx`** (20 variants, 196 framer-motion animation usages) is
  **fully intact** and remains the public fallback renderer — so **no animation
  was ever removed from the live site**. The homepage renders it today (no hero
  published), unchanged.
- The gap was the **config-driven `HeroExperience`** renderer (Phase 23), which
  had minimal animation. Phase 25 closes that gap with a dedicated Animation
  Engine, leaving the legacy path untouched.
- `globals.css` already carried 19 keyframes — reused as the base.

## What shipped

### Enterprise Animation Engine (`src/lib/hero/animations.ts`)

A pure, unit-tested registry of **53 production presets** (+`none`) across 6
categories (entrance / emphasis / text / background / scroll / interactive):
fade·fade-up/down/left/right·slide·zoom·scale·rotate·rotate-3d·flip(x/y)·bounce·
elastic·spring·reveal·mask-reveal·card-stack·particle·video-reveal·pulse·glow·
shimmer·floating·wave·spin·heartbeat·gradient-shift·typing·counter·split/letter/
word-reveal·gradient-text·background/canvas/blob-motion·morph·marquee·svg-path-
draw·lottie·image-sequence·parallax·scroll-reveal·stagger·timeline·mouse-follow·
spotlight. Each preset declares category, default trigger, easing, duration,
`heavy`/`looping` flags.

- `resolveAnimation(assignment, {reduceMotion, lowEnd})` → `{ className, style }`
  with `--hx-*` custom properties; **auto-suppresses** heavy/looping under
  reduced-motion and heavy under low-end. `EASING_CSS` maps named easings
  (incl. spring/elastic/bounce cubic-beziers).
- `animationConflicts()` flags too many simultaneous heavy/looping animations
  (wired into the rule engine).
- CSS: 27 `@keyframes hx*` + `.hx-*` classes appended to `globals.css`, guarded
  by `prefers-reduced-motion`. JS-only presets fall back to a safe fade so they
  never break layout.

### Wiring

- **Types** (`types.ts`): `HeroElementAnimation` + `HeroAnimations` (per-element,
  all optional → backward compatible) added to `HeroConfig`.
- **Public renderer** (`HeroExperience.tsx`): resolves + applies an animation per
  element (badge/headline/subheadline/ctas/stats/media); detects low-end devices
  client-side (`deviceMemory`/`hardwareConcurrency`) to drop heavy animations.
- **Builder** (`HeroBuilder.tsx`): an **Animations** section — assign a preset
  per element with duration/delay/easing controls and a live preview chip.
- **Rule engine** (`rules.ts`): validates unknown presets (error) + animation
  conflicts (warning); publishing stays gated.

### Templates — Classic + Premium

- **20 legacy** templates → the **Classic** library (preserved, editable,
  duplicatable). **30 premium** templates total (10 from Phase 23 + **20 new**
  verticals: DevOps, Networking, Infrastructure, Startup, Enterprise, Agency,
  Minimal, Dark/Light, Healthcare, Education, Industrial, Construction,
  Government, Finance, Insurance, Retail, Manufacturing, Energy, SaaS).
- Hero Center **Templates** tab now has a **Classic / Premium / All** switch.
- Registry total: **50 templates**, unique ids.

## Verification (all green)

- TypeScript 0 · ESLint 0 · **262 unit tests** (incl. 6 new animation-engine tests + updated template-count test)
- All 7 governance audits pass · production build OK (96 pages)
- Live PostgreSQL round-trip: publish a premium hero **with animations** → resolve for `/` → animation resolves to the correct `hx-*` class + timing. ✓

## Preserved (no regression)

✓ Legacy `Hero.tsx` + all 196 animations · ✓ all 20 classic templates · ✓ every
Phase-23 API/route/experiment/personalization/analytics · ✓ public homepage
(legacy fallback unchanged) · ✓ PostgreSQL-native (config JSON, no schema
change needed).
