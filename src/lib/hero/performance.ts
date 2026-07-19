/**
 * Hero Performance & Accessibility scoring engines (Phase 25.1) — pure.
 *
 * Given a hero config, estimate an animation performance cost + an accessibility
 * (WCAG) posture. Both are deterministic, dependency-free and unit-tested; the
 * Hero Builder surfaces the resulting scores + warnings in real time, and the
 * rule engine can gate on them.
 */
import type { HeroConfig, HeroElementAnimation } from './types'
import { getAnimation } from './animations'
import { contrastRatio } from './rules'

export interface PerfWarning { code: string; message: string; severity: 'warning' | 'info' }
export interface PerformanceReport {
  /** 0..100 — higher is better (lighter). */
  score: number
  /** Sum of per-animation weight units. */
  weight: number
  /** Rough estimated worst-case FPS class. */
  estFps: 60 | 45 | 30
  heavyCount: number
  loopingCount: number
  warnings: PerfWarning[]
}

const activeAnims = (config: HeroConfig): HeroElementAnimation[] =>
  Object.values(config.animations ?? {}).filter(
    (a): a is HeroElementAnimation => !!a && !a.disabled && a.preset !== 'none',
  )

/** Estimate the rendering cost of a hero's animations. */
export function animationPerformance(config: HeroConfig): PerformanceReport {
  const anims = activeAnims(config)
  const presets = anims.map(a => getAnimation(a.preset)).filter((x): x is NonNullable<typeof x> => !!x)
  const heavyCount = presets.filter(p => p.heavy).length
  const loopingCount = presets.filter(p => p.looping).length

  // Weight model: base 1 per animation, +3 heavy, +2 looping, +1 for a
  // video/canvas/animation background.
  let weight = presets.length
  weight += heavyCount * 3 + loopingCount * 2
  const bgKind = config.style.background?.kind
  if (bgKind === 'video') weight += 4
  else if (bgKind === 'canvas' || bgKind === 'animation') weight += 2

  const warnings: PerfWarning[] = []
  if (heavyCount > 2) warnings.push({ code: 'perf.heavy', severity: 'warning', message: `${heavyCount} heavy animations may drop frames on mobile.` })
  if (loopingCount > 3) warnings.push({ code: 'perf.loop', severity: 'warning', message: `${loopingCount} looping animations run continuously and consume battery.` })
  if (bgKind === 'video') warnings.push({ code: 'perf.video', severity: 'info', message: 'Video backgrounds are heavy; provide a poster and lazy-load.' })

  const score = Math.max(0, Math.min(100, 100 - weight * 5))
  const estFps: 60 | 45 | 30 = weight <= 4 ? 60 : weight <= 9 ? 45 : 30
  return { score, weight, estFps, heavyCount, loopingCount, warnings }
}

export interface A11yIssue { code: string; message: string; severity: 'error' | 'warning' | 'info' }
export interface AccessibilityReport {
  score: number            // 0..100
  passesWCAG: boolean      // no error-level issues
  issues: A11yIssue[]
}

/** WCAG-oriented accessibility posture for a hero config. */
export function accessibilityReport(config: HeroConfig, primaryLocale: 'en' | 'fa' = 'en'): AccessibilityReport {
  const issues: A11yIssue[] = []
  const s = config.style
  const primary = config.content[primaryLocale]

  // H1 presence
  if (!primary.headline?.trim())
    issues.push({ code: 'a11y.h1', severity: 'error', message: 'Missing H1 headline — screen readers and SEO need it.' })
  // Alt text on media
  for (const loc of ['en', 'fa'] as const) {
    const c = config.content[loc]
    if (c.mediaUrl && !c.mediaAlt?.trim())
      issues.push({ code: 'a11y.alt', severity: 'warning', message: `Media in ${loc.toUpperCase()} is missing alt text.` })
  }
  // Contrast (solid background only — matches the rule engine)
  if (s.textColor && s.background?.kind === 'solid' && s.background.color) {
    const ratio = contrastRatio(s.textColor, s.background.color)
    if (ratio && ratio < 4.5) issues.push({ code: 'a11y.contrast', severity: 'error', message: `Text/background contrast ${ratio}:1 is below WCAG AA (4.5:1).` })
  }
  // Motion: looping/heavy animations without a reduce-motion opt-out
  const anims = activeAnims(config)
  const hasMotion = anims.some(a => { const p = getAnimation(a.preset); return p?.looping || p?.heavy }) || s.background?.kind === 'video'
  if (hasMotion && !config.reduceMotion)
    issues.push({ code: 'a11y.motion', severity: 'warning', message: 'Continuous/heavy motion present — enable reduce-motion support.' })
  // Tiny subtitle
  if (s.subtitleSize != null && s.subtitleSize < 12)
    issues.push({ code: 'a11y.fontSize', severity: 'warning', message: 'Subtitle font below 12px harms low-vision readability.' })

  const penalty = issues.reduce((n, i) => n + (i.severity === 'error' ? 25 : i.severity === 'warning' ? 10 : 3), 0)
  const score = Math.max(0, 100 - penalty)
  return { score, passesWCAG: !issues.some(i => i.severity === 'error'), issues }
}
