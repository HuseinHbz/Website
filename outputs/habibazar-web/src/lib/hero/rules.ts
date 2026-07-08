/**
 * Hero Rule / Validation Engine (Phase 23).
 *
 * Pure, deterministic validation of a hero config against its template's
 * constraints + universal a11y/SEO/responsive rules. `errors` block publishing;
 * `warnings` are advisory. No I/O → fully unit-tested.
 */
import type { HeroConfig, HeroContentL, Locale } from './types'
import { getTemplate } from './templates'

export type Severity = 'error' | 'warning'
export interface HeroIssue {
  code: string
  severity: Severity
  message: string
  locale?: Locale
  field?: string
}
export interface ValidationResult { ok: boolean; errors: HeroIssue[]; warnings: HeroIssue[]; issues: HeroIssue[] }

// ── WCAG contrast ─────────────────────────────────────────────────────────────
/** Parse #rgb / #rrggbb → [r,g,b] 0..255, or null. */
export function parseHex(hex: string): [number, number, number] | null {
  const m = hex.trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(m)) return [parseInt(m[0] + m[0], 16), parseInt(m[1] + m[1], 16), parseInt(m[2] + m[2], 16)]
  if (/^[0-9a-f]{6}$/i.test(m)) return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)]
  return null
}
function relLuminance([r, g, b]: [number, number, number]): number {
  const f = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
/** WCAG contrast ratio between two hex colors (1..21). Returns 0 if unparseable. */
export function contrastRatio(fg: string, bg: string): number {
  const a = parseHex(fg), b = parseHex(bg)
  if (!a || !b) return 0
  const la = relLuminance(a), lb = relLuminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100
}

// ── Rules ─────────────────────────────────────────────────────────────────────
function validateContent(c: HeroContentL, locale: Locale, con: NonNullable<ReturnType<typeof getTemplate>>['constraints'], issues: HeroIssue[], primary: boolean) {
  const title = (c.headline ?? '').trim() + (c.headlineHighlight ? ` ${c.headlineHighlight.trim()}` : '')
  if (primary && !c.headline?.trim())
    issues.push({ code: 'title.required', severity: 'error', locale, field: 'headline', message: 'Headline (H1) is required for SEO and accessibility.' })
  if (title.length > con.maxTitle)
    issues.push({ code: 'title.tooLong', severity: 'error', locale, field: 'headline', message: `Title exceeds ${con.maxTitle} characters (${title.length}).` })
  if ((c.subheadline ?? '').length > con.maxSubtitle)
    issues.push({ code: 'subtitle.tooLong', severity: 'error', locale, field: 'subheadline', message: `Subtitle exceeds ${con.maxSubtitle} characters.` })
  const ctas = c.ctas ?? []
  if (ctas.length > con.maxButtons)
    issues.push({ code: 'cta.tooMany', severity: 'error', locale, field: 'ctas', message: `Too many buttons (${ctas.length} > ${con.maxButtons}).` })
  ctas.forEach((cta, i) => {
    if (!cta.label?.trim()) issues.push({ code: 'cta.empty', severity: 'error', locale, field: `ctas[${i}]`, message: 'CTA label is empty.' })
    else if (cta.label.length > con.maxCtaLen) issues.push({ code: 'cta.tooLong', severity: 'error', locale, field: `ctas[${i}]`, message: `CTA label exceeds ${con.maxCtaLen} characters.` })
    if (!cta.href?.trim()) issues.push({ code: 'cta.noHref', severity: 'warning', locale, field: `ctas[${i}]`, message: 'CTA has no link target.' })
  })
  if (c.mediaUrl && !c.mediaAlt?.trim())
    issues.push({ code: 'media.noAlt', severity: 'warning', locale, field: 'mediaAlt', message: 'Media is missing alt text (accessibility).' })
}

/**
 * Validate a hero config. `primaryLocale` (default 'en') is the one required to
 * have an H1; the other locale is validated for bounds only.
 */
export function validateHero(config: HeroConfig, primaryLocale: Locale = 'en'): ValidationResult {
  const issues: HeroIssue[] = []
  const t = getTemplate(config.template)
  if (!t) {
    issues.push({ code: 'template.unknown', severity: 'error', message: `Unknown template "${config.template}".` })
    return finalize(issues)
  }
  const con = t.constraints

  // Content (both languages)
  validateContent(config.content.en, 'en', con, issues, primaryLocale === 'en')
  validateContent(config.content.fa, 'fa', con, issues, primaryLocale === 'fa')

  // Typography bounds
  const s = config.style
  if (s.titleSize != null && (s.titleSize < con.minFontSize || s.titleSize > con.maxFontSize))
    issues.push({ code: 'font.titleOutOfRange', severity: 'error', field: 'titleSize', message: `Title font size must be ${con.minFontSize}–${con.maxFontSize}px.` })
  if (s.subtitleSize != null && s.subtitleSize < 12)
    issues.push({ code: 'font.subtitleTooSmall', severity: 'warning', field: 'subtitleSize', message: 'Subtitle font size below 12px hurts readability.' })

  // Contrast (only meaningful for a solid background)
  if (s.textColor && s.background?.kind === 'solid' && s.background.color) {
    const ratio = contrastRatio(s.textColor, s.background.color)
    if (ratio && ratio < 4.5)
      issues.push({ code: 'contrast.low', severity: 'error', field: 'textColor', message: `Text/background contrast ${ratio}:1 is below WCAG AA (4.5:1).` })
  }

  // Background support
  if (s.background && !t.backgrounds.includes(s.background.kind))
    issues.push({ code: 'background.unsupported', severity: 'warning', field: 'background', message: `Template "${t.id}" does not support a ${s.background.kind} background.` })

  // Responsive / overflow heuristics: very long title + very large font risks overflow on mobile
  const enTitleLen = (config.content.en.headline ?? '').length
  if (s.titleSize && s.titleSize > 72 && enTitleLen > 40)
    issues.push({ code: 'responsive.overflowRisk', severity: 'warning', message: 'Large title font with a long headline may overflow on mobile.' })

  // Reduced motion advisory
  if (!config.reduceMotion && s.background?.kind === 'video')
    issues.push({ code: 'a11y.motion', severity: 'warning', message: 'Consider offering reduced motion for video backgrounds.' })

  return finalize(issues)
}

function finalize(issues: HeroIssue[]): ValidationResult {
  const errors = issues.filter(i => i.severity === 'error')
  const warnings = issues.filter(i => i.severity === 'warning')
  return { ok: errors.length === 0, errors, warnings, issues }
}

/** Publishing gate: a hero may only be published when it has zero errors. */
export function canPublish(config: HeroConfig, primaryLocale: Locale = 'en'): boolean {
  return validateHero(config, primaryLocale).ok
}
