/**
 * Hero Smart Recommendation Engine (Phase 25.1) — pure, deterministic.
 *
 * Suggests animations (and a few layout hints) for a hero based on its template
 * category, content and the delivery context (device / reduced-motion). The Hero
 * Builder offers these as one-click "apply" suggestions; the AI assistant can
 * additionally refine them via the existing AI Platform. Fully unit-tested.
 */
import type { HeroAnimations, HeroConfig } from './types'
import { getTemplate } from './templates'
import { getAnimation } from './animations'

export interface RecommendContext {
  device?: 'mobile' | 'tablet' | 'desktop'
  reduceMotion?: boolean
}

/** Per-category animation recipes (element → preset). Values are real preset ids. */
const CATEGORY_RECIPES: Record<string, HeroAnimations> = {
  security: { badge: { preset: 'fade' }, headline: { preset: 'fade-up' }, subheadline: { preset: 'fade-up', delayMs: 120 }, ctas: { preset: 'zoom-in', delayMs: 240 }, media: { preset: 'glow' } },
  technology: { headline: { preset: 'reveal' }, subheadline: { preset: 'fade-up', delayMs: 120 }, ctas: { preset: 'slide-left', delayMs: 200 }, media: { preset: 'gradient-shift' } },
  ai: { headline: { preset: 'letter-reveal' }, subheadline: { preset: 'fade-up', delayMs: 150 }, ctas: { preset: 'spring', delayMs: 260 }, media: { preset: 'floating' } },
  cloud: { headline: { preset: 'fade-up' }, subheadline: { preset: 'fade-up', delayMs: 120 }, ctas: { preset: 'fade-up', delayMs: 220 }, media: { preset: 'floating' } },
  corporate: { headline: { preset: 'fade-up' }, subheadline: { preset: 'fade-up', delayMs: 120 }, ctas: { preset: 'fade-up', delayMs: 220 } },
  consulting: { headline: { preset: 'fade-right' }, subheadline: { preset: 'fade-right', delayMs: 120 }, ctas: { preset: 'fade-up', delayMs: 220 } },
  portfolio: { headline: { preset: 'zoom' }, subheadline: { preset: 'fade', delayMs: 150 }, ctas: { preset: 'fade-up', delayMs: 240 } },
  media: { headline: { preset: 'mask-reveal' }, subheadline: { preset: 'fade-up', delayMs: 150 }, ctas: { preset: 'fade-up', delayMs: 250 }, media: { preset: 'video-reveal' } },
  product: { headline: { preset: 'slide-up' }, subheadline: { preset: 'fade-up', delayMs: 120 }, ctas: { preset: 'bounce', delayMs: 240 }, media: { preset: 'card-stack' } },
  classic: { headline: { preset: 'fade' }, subheadline: { preset: 'fade', delayMs: 120 }, ctas: { preset: 'fade', delayMs: 220 } },
}

const LIGHT_FALLBACK: HeroAnimations = {
  headline: { preset: 'fade-up' }, subheadline: { preset: 'fade-up', delayMs: 120 }, ctas: { preset: 'fade-up', delayMs: 220 },
}

/**
 * Recommend a full set of per-element animations for a hero config. Under
 * reduced-motion (or a mobile context) heavy/looping presets are swapped for
 * light equivalents so the suggestion is always safe to apply.
 */
export function recommendAnimations(config: HeroConfig, ctx: RecommendContext = {}): HeroAnimations {
  const cat = getTemplate(config.template)?.category ?? 'classic'
  const base = CATEGORY_RECIPES[cat] ?? LIGHT_FALLBACK
  const lighten = ctx.reduceMotion || ctx.device === 'mobile'
  if (!lighten) return structuredCloneSafe(base)

  const out: HeroAnimations = {}
  for (const [key, anim] of Object.entries(base) as [keyof HeroAnimations, HeroAnimations[keyof HeroAnimations]][]) {
    if (!anim) continue
    const p = getAnimation(anim.preset)
    out[key] = (p?.heavy || p?.looping) ? { ...anim, preset: 'fade-up' } : { ...anim }
  }
  return out
}

/** A human-readable rationale for the recommendation (shown in the builder). */
export function recommendationRationale(config: HeroConfig, locale: 'en' | 'fa' = 'en'): string {
  const cat = getTemplate(config.template)?.category ?? 'classic'
  const en = `Tuned for a "${cat}" hero — entrance emphasis on the headline, staggered CTA, motion suppressed on mobile / reduced-motion.`
  const fa = `متناسب با هیرو «${cat}» — تأکید ورودی روی عنوان، CTA پلکانی، و کاهش حرکت روی موبایل/حالت کم‌حرکت.`
  return locale === 'fa' ? fa : en
}

// structuredClone exists in Node 18+, but keep a tiny guard for older test envs.
function structuredCloneSafe<T>(v: T): T {
  return typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v))
}
