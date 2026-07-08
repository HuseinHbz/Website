import { describe, it, expect } from 'vitest'
import { HERO_TEMPLATES, LEGACY_TEMPLATES, PREMIUM_TEMPLATES, PREMIUM_TEMPLATES_V2, getTemplate, defaultConfig, templatesByCategory } from '../templates'
import { validateHero, canPublish, contrastRatio, parseHex } from '../rules'
import { bucketOf, pickVariant, experimentResult, type Experiment } from '../experiment'
import { resolveHero, ruleMatches, type RequestContext } from '../personalize'
import { summarizeHeroEvents } from '../analytics'
import type { HeroConfig } from '../types'

describe('template registry', () => {
  it('registers 50 templates (20 legacy + 30 premium), unique ids', () => {
    expect(LEGACY_TEMPLATES).toHaveLength(20)
    expect(PREMIUM_TEMPLATES.length + PREMIUM_TEMPLATES_V2.length).toBe(30)
    expect(HERO_TEMPLATES).toHaveLength(50)
    expect(new Set(HERO_TEMPLATES.map(t => t.id)).size).toBe(50)
  })
  it('keeps the legacy split/cyber ids for compatibility', () => {
    expect(getTemplate('split')).toBeTruthy()
    expect(getTemplate('cyber')?.category).toBe('security')
  })
  it('defaultConfig returns a valid-shaped config', () => {
    const c = defaultConfig('executive')
    expect(c.template).toBe('executive')
    expect(c.content.en).toBeTruthy(); expect(c.content.fa).toBeTruthy()
  })
  it('templatesByCategory filters', () => {
    expect(templatesByCategory('security').some(t => t.id === 'cyber-security')).toBe(true)
  })
})

const baseConfig = (over: Partial<HeroConfig> = {}): HeroConfig => ({
  template: 'executive',
  content: {
    en: { headline: 'Enterprise Infrastructure', subheadline: 'We build.', ctas: [{ label: 'Get started', href: '/contact' }], stats: [] },
    fa: { headline: 'زیرساخت سازمانی', subheadline: 'می‌سازیم.', ctas: [], stats: [] },
  },
  style: { titleSize: 56, subtitleSize: 20 },
  ...over,
})

describe('rules / validation', () => {
  it('passes a well-formed hero', () => {
    const r = validateHero(baseConfig())
    expect(r.ok).toBe(true); expect(r.errors).toHaveLength(0)
  })
  it('requires an H1 headline in the primary locale', () => {
    const r = validateHero(baseConfig({ content: { en: { headline: '', ctas: [] }, fa: { headline: 'x', ctas: [] } } }))
    expect(r.ok).toBe(false)
    expect(r.errors.some(e => e.code === 'title.required')).toBe(true)
  })
  it('enforces title length + button count from template constraints', () => {
    const long = 'x'.repeat(100)
    const r = validateHero(baseConfig({ content: { en: { headline: long, ctas: [{ label: 'a', href: '/' }, { label: 'b', href: '/' }, { label: 'c', href: '/' }] }, fa: { headline: 'y', ctas: [] } } }))
    expect(r.errors.some(e => e.code === 'title.tooLong')).toBe(true)
    expect(r.errors.some(e => e.code === 'cta.tooMany')).toBe(true)  // executive maxButtons=2
  })
  it('flags low contrast on a solid background (WCAG AA)', () => {
    const r = validateHero(baseConfig({ style: { titleSize: 56, textColor: '#777777', background: { kind: 'solid', color: '#888888' } } }))
    expect(r.errors.some(e => e.code === 'contrast.low')).toBe(true)
  })
  it('canPublish gates on zero errors', () => {
    expect(canPublish(baseConfig())).toBe(true)
    expect(canPublish(baseConfig({ template: 'nope' }))).toBe(false)
  })
  it('contrast helper: black on white ≈ 21, parseHex', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeGreaterThan(20)
    expect(parseHex('#fff')).toEqual([255, 255, 255])
    expect(parseHex('xyz')).toBeNull()
  })
})

describe('A/B experiment', () => {
  const exp: Experiment = { id: 1, key: 'home', status: 'running', variants: [{ id: 'A', heroId: 1, weight: 50 }, { id: 'B', heroId: 2, weight: 50 }] }
  it('bucketing is deterministic + stable per subject', () => {
    expect(bucketOf('user-1', 'home')).toBe(bucketOf('user-1', 'home'))
    expect(pickVariant(exp, 'user-1')?.id).toBe(pickVariant(exp, 'user-1')?.id)
  })
  it('splits roughly by weight over many subjects', () => {
    let a = 0
    for (let i = 0; i < 2000; i++) if (pickVariant(exp, `u${i}`)?.id === 'A') a++
    expect(a).toBeGreaterThan(800); expect(a).toBeLessThan(1200)
  })
  it('winner needs min sample + lift', () => {
    const r = experimentResult([{ variantId: 'A', views: 500, clicks: 50, conversions: 50 }, { variantId: 'B', views: 500, clicks: 20, conversions: 10 }])
    expect(r.winner).toBe('A'); expect(r.significant).toBe(true)
    const small = experimentResult([{ variantId: 'A', views: 10, clicks: 5, conversions: 5 }])
    expect(small.winner).toBeNull()
  })
})

describe('personalization', () => {
  const ctx: RequestContext = { device: 'mobile', locale: 'fa', country: 'IR', returning: true, hour: 10, weekday: 3, campaign: 'launch' }
  it('matches device/locale/country/returning/campaign/schedule', () => {
    expect(ruleMatches({ device: 'mobile' }, ctx)).toBe(true)
    expect(ruleMatches({ device: 'desktop' }, ctx)).toBe(false)
    expect(ruleMatches({ country: 'ir' }, ctx)).toBe(true)
    expect(ruleMatches({ campaign: 'LAUNCH' }, ctx)).toBe(true)
    expect(ruleMatches({ schedule: { fromHour: 9, toHour: 17 } }, ctx)).toBe(true)
    expect(ruleMatches({ schedule: { fromHour: 22, toHour: 6 } }, ctx)).toBe(false)
  })
  it('highest-priority matching rule wins, else default', () => {
    const rules = [
      { heroId: 10, priority: 1, match: { device: 'mobile' as const } },
      { heroId: 20, priority: 5, match: { campaign: 'launch' } },
      { heroId: 30, priority: 9, match: { device: 'desktop' as const } },
    ]
    expect(resolveHero(rules, ctx, 99)).toBe(20)
    expect(resolveHero([], ctx, 99)).toBe(99)
  })
})

describe('analytics summarize', () => {
  it('rolls events into KPIs + best/worst', () => {
    const s = summarizeHeroEvents([
      { heroId: 1, type: 'view' }, { heroId: 1, type: 'view' }, { heroId: 1, type: 'click' }, { heroId: 1, type: 'conversion' }, { heroId: 1, type: 'scroll', value: 80 },
      { heroId: 2, type: 'view' }, { heroId: 2, type: 'view' }, { heroId: 2, type: 'time', value: 5 },
    ])
    const h1 = s.perHero.find(h => h.heroId === 1)!
    expect(h1.views).toBe(2); expect(h1.ctr).toBe(50); expect(h1.conversionRate).toBe(50); expect(h1.avgScrollDepth).toBe(80)
    expect(s.totals.views).toBe(4)
    expect(s.topHero).toBe(1); expect(s.worstHero).toBe(2)
  })
})

import { ANIMATION_PRESETS, ANIMATION_COUNT, ANIMATION_CATEGORIES, getAnimation, animationsByCategory, resolveAnimation, animationConflicts } from '../animations'

describe('animation engine', () => {
  it('ships a 50+ preset library with unique ids', () => {
    expect(ANIMATION_COUNT).toBeGreaterThanOrEqual(50)
    expect(new Set(ANIMATION_PRESETS.map(a => a.id)).size).toBe(ANIMATION_PRESETS.length)
    expect(getAnimation('fade-up')?.category).toBe('entrance')
  })
  it('groups presets by category', () => {
    expect(ANIMATION_CATEGORIES).toContain('entrance')
    expect(animationsByCategory('emphasis').some(a => a.id === 'pulse')).toBe(true)
  })
  it('resolves an assignment to a class + custom properties', () => {
    const r = resolveAnimation({ preset: 'fade-up', durationMs: 900, delayMs: 100, easing: 'spring' })
    expect(r?.className).toContain('hx-fade-up')
    expect(r?.style['--hx-dur']).toBe('900ms')
    expect(r?.style['--hx-delay']).toBe('100ms')
  })
  it('returns null for none / unknown / disabled', () => {
    expect(resolveAnimation({ preset: 'none' })).toBeNull()
    expect(resolveAnimation({ preset: 'nope' })).toBeNull()
    expect(resolveAnimation({ preset: 'fade', disabled: true })).toBeNull()
    expect(resolveAnimation(undefined)).toBeNull()
  })
  it('suppresses heavy/looping under reduced-motion and heavy under low-end', () => {
    expect(resolveAnimation({ preset: 'pulse' }, { reduceMotion: true })).toBeNull() // looping
    expect(resolveAnimation({ preset: 'flip' }, { reduceMotion: true })).toBeNull() // heavy
    expect(resolveAnimation({ preset: 'flip' }, { lowEnd: true })).toBeNull()       // heavy
    expect(resolveAnimation({ preset: 'fade-up' }, { lowEnd: true })).not.toBeNull() // light survives
  })
  it('flags conflicts among too many heavy/looping animations', () => {
    const heavy = animationConflicts([{ preset: 'flip' }, { preset: 'rotate-3d' }, { preset: 'mask-reveal' }, { preset: 'card-stack' }])
    expect(heavy.length).toBeGreaterThan(0)
  })
})

import { animationPerformance, accessibilityReport } from '../performance'
import { recommendAnimations, recommendationRationale } from '../recommend'
import { buildAssistPrompt } from '../aiAssist'

describe('performance + a11y engines', () => {
  it('scores a light hero high and a heavy hero lower', () => {
    const light = animationPerformance(baseConfig({ animations: { headline: { preset: 'fade-up' } } }))
    const heavy = animationPerformance(baseConfig({ animations: { headline: { preset: 'flip' }, media: { preset: 'rotate-3d' }, ctas: { preset: 'mask-reveal' }, badge: { preset: 'card-stack' } }, style: { background: { kind: 'video', value: 'x.mp4' } } }))
    expect(light.score).toBeGreaterThan(heavy.score)
    expect(heavy.warnings.length).toBeGreaterThan(0)
    expect(heavy.estFps).toBeLessThanOrEqual(45)
  })
  it('flags missing H1 and low contrast as WCAG errors', () => {
    const bad = accessibilityReport(baseConfig({ content: { en: { headline: '' }, fa: { headline: '' } }, style: { textColor: '#888888', background: { kind: 'solid', color: '#999999' } } }))
    expect(bad.passesWCAG).toBe(false)
    expect(bad.issues.some(i => i.code === 'a11y.h1')).toBe(true)
  })
})

describe('recommendation engine', () => {
  it('recommends category-appropriate animations and lightens on mobile', () => {
    const sec = recommendAnimations(baseConfig({ template: 'cyber-security' }))
    expect(sec.headline?.preset).toBeTruthy()
    const mobile = recommendAnimations(baseConfig({ template: 'video-fullscreen' }), { device: 'mobile' })
    // media recipe uses heavy mask-reveal/video-reveal → lightened to fade-up on mobile
    expect(mobile.headline?.preset).toBe('fade-up')
    expect(recommendationRationale(baseConfig(), 'fa')).toContain('هیرو')
  })
})

describe('AI assist prompt builder', () => {
  it('builds a localized, action-specific prompt', () => {
    const en = buildAssistPrompt({ action: 'title', locale: 'en', tone: 'executive', category: 'security' })
    expect(en.systemPrompt).toContain('English')
    expect(en.userMessage.toLowerCase()).toContain('headline')
    const tr = buildAssistPrompt({ action: 'translate', locale: 'en', targetLocale: 'fa', selection: 'Hello' })
    expect(tr.systemPrompt).toContain('Persian')
  })
})
