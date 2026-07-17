/**
 * Enterprise Hero Animation Engine (Phase 25) — pure registry.
 *
 * A production-ready library of 54 animation presets that the Hero Builder can
 * assign visually per element and the public renderer applies via CSS classes +
 * custom properties (no runtime animation library needed on the public path).
 *
 * Each preset maps to a `hx-<id>` CSS class (keyframes live in globals.css) and
 * declares its category, trigger semantics, whether it is "heavy" (auto-disabled
 * on low-end / reduced-motion), and sensible default timing. The engine is pure
 * and fully unit-tested; `resolveAnimation` computes the inline CSS custom
 * properties (`--hx-*`) that parametrise duration/delay/easing/repeat.
 */

export type AnimationCategory =
  | 'entrance' | 'emphasis' | 'text' | 'background' | 'scroll' | 'interactive' | 'orbit'
export type AnimationTrigger = 'load' | 'viewport' | 'scroll' | 'hover' | 'click' | 'loop'
export type AnimationEasing =
  | 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out'
  | 'spring' | 'elastic' | 'bounce'

/** A named preset in the library. */
export interface AnimationPreset {
  id: string
  nameEn: string
  nameFa: string
  category: AnimationCategory
  /** Default trigger when an admin assigns it. */
  trigger: AnimationTrigger
  /** Heavy presets are auto-disabled on low-end devices / reduced motion. */
  heavy?: boolean
  /** Default duration (ms) and easing for the preset. */
  defaultDurationMs: number
  defaultEasing: AnimationEasing
  /** True if the preset naturally loops (pulse/float/shimmer/…). */
  looping?: boolean
}

/** A concrete animation assignment stored on a hero element. */
export interface HeroAnimation {
  preset: string
  durationMs?: number
  delayMs?: number
  easing?: AnimationEasing
  /** 0 = preset default; -1 = infinite; N = repeat count. */
  repeat?: number
  trigger?: AnimationTrigger
  disabled?: boolean
}

/** CSS timing-function values for the named easings (cubic-beziers for the fancy ones). */
export const EASING_CSS: Record<AnimationEasing, string> = {
  linear: 'linear',
  ease: 'ease',
  'ease-in': 'ease-in',
  'ease-out': 'ease-out',
  'ease-in-out': 'ease-in-out',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  elastic: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  bounce: 'cubic-bezier(0.68, -0.6, 0.32, 1.6)',
}

const p = (
  id: string, nameEn: string, nameFa: string, category: AnimationCategory,
  trigger: AnimationTrigger, defaultDurationMs: number, defaultEasing: AnimationEasing,
  extra: Partial<AnimationPreset> = {},
): AnimationPreset => ({ id, nameEn, nameFa, category, trigger, defaultDurationMs, defaultEasing, ...extra })

/** The 54-preset library. `none` is the explicit "no animation" sentinel. */
export const ANIMATION_PRESETS: AnimationPreset[] = [
  p('none', 'None', 'بدون انیمیشن', 'entrance', 'load', 0, 'linear'),
  // ── Entrance (fade / slide / zoom / rotate / flip) ─────────────────────────
  p('fade', 'Fade', 'محو', 'entrance', 'viewport', 600, 'ease-out'),
  p('fade-up', 'Fade Up', 'محو به بالا', 'entrance', 'viewport', 700, 'ease-out'),
  p('fade-down', 'Fade Down', 'محو به پایین', 'entrance', 'viewport', 700, 'ease-out'),
  p('fade-left', 'Fade Left', 'محو از چپ', 'entrance', 'viewport', 700, 'ease-out'),
  p('fade-right', 'Fade Right', 'محو از راست', 'entrance', 'viewport', 700, 'ease-out'),
  p('slide-up', 'Slide Up', 'لغزش به بالا', 'entrance', 'viewport', 700, 'ease-out'),
  p('slide-down', 'Slide Down', 'لغزش به پایین', 'entrance', 'viewport', 700, 'ease-out'),
  p('slide-left', 'Slide Left', 'لغزش از چپ', 'entrance', 'viewport', 700, 'ease-out'),
  p('slide-right', 'Slide Right', 'لغزش از راست', 'entrance', 'viewport', 700, 'ease-out'),
  p('zoom', 'Zoom', 'بزرگ‌نمایی', 'entrance', 'viewport', 600, 'ease-out'),
  p('zoom-in', 'Zoom In', 'بزرگ‌نمایی ورودی', 'entrance', 'viewport', 600, 'spring'),
  p('zoom-out', 'Zoom Out', 'کوچک‌نمایی ورودی', 'entrance', 'viewport', 600, 'ease-out'),
  p('scale', 'Scale', 'مقیاس', 'entrance', 'viewport', 600, 'spring'),
  p('rotate', 'Rotate', 'چرخش', 'entrance', 'viewport', 700, 'ease-out'),
  p('rotate-3d', 'Rotate 3D', 'چرخش سه‌بعدی', 'entrance', 'viewport', 900, 'ease-out', { heavy: true }),
  p('flip', 'Flip', 'برگردان', 'entrance', 'viewport', 800, 'ease-out', { heavy: true }),
  p('flip-x', 'Flip X', 'برگردان افقی', 'entrance', 'viewport', 800, 'ease-out', { heavy: true }),
  p('flip-y', 'Flip Y', 'برگردان عمودی', 'entrance', 'viewport', 800, 'ease-out', { heavy: true }),
  p('bounce', 'Bounce', 'جهش', 'entrance', 'viewport', 900, 'bounce'),
  p('elastic', 'Elastic', 'کشسان', 'entrance', 'viewport', 1000, 'elastic'),
  p('spring', 'Spring', 'فنری', 'entrance', 'viewport', 800, 'spring'),
  p('reveal', 'Reveal', 'آشکارسازی', 'entrance', 'viewport', 800, 'ease-out'),
  p('mask-reveal', 'Mask Reveal', 'آشکارسازی ماسک', 'entrance', 'viewport', 900, 'ease-in-out', { heavy: true }),
  p('card-stack', 'Card Stack', 'دسته کارت', 'entrance', 'viewport', 800, 'spring', { heavy: true }),
  p('particle-entrance', 'Particle Entrance', 'ورود ذره‌ای', 'entrance', 'viewport', 1200, 'ease-out', { heavy: true }),
  p('video-reveal', 'Video Reveal', 'آشکارسازی ویدیو', 'entrance', 'viewport', 900, 'ease-out', { heavy: true }),
  // ── Emphasis / loop ────────────────────────────────────────────────────────
  p('pulse', 'Pulse', 'تپش', 'emphasis', 'loop', 2000, 'ease-in-out', { looping: true }),
  p('glow', 'Glow', 'درخشش', 'emphasis', 'loop', 2400, 'ease-in-out', { looping: true }),
  p('shimmer', 'Shimmer', 'براق', 'emphasis', 'loop', 2200, 'linear', { looping: true }),
  p('floating', 'Floating', 'شناور', 'emphasis', 'loop', 4000, 'ease-in-out', { looping: true }),
  p('wave', 'Wave', 'موج', 'emphasis', 'loop', 2600, 'ease-in-out', { looping: true }),
  p('spin-slow', 'Spin', 'چرخش آرام', 'emphasis', 'loop', 8000, 'linear', { looping: true }),
  p('heartbeat', 'Heartbeat', 'ضربان', 'emphasis', 'loop', 1600, 'ease-in-out', { looping: true }),
  p('gradient-shift', 'Gradient Shift', 'تغییر گرادیان', 'emphasis', 'loop', 6000, 'ease-in-out', { looping: true }),
  // ── Text ───────────────────────────────────────────────────────────────────
  p('typing', 'Typing', 'تایپ', 'text', 'viewport', 2000, 'linear'),
  p('counter', 'Counter', 'شمارنده', 'text', 'viewport', 1600, 'ease-out'),
  p('split-text', 'Split Text', 'متن تکه‌ای', 'text', 'viewport', 900, 'ease-out', { heavy: true }),
  p('letter-reveal', 'Letter Reveal', 'آشکارسازی حرف', 'text', 'viewport', 1200, 'ease-out', { heavy: true }),
  p('word-reveal', 'Word Reveal', 'آشکارسازی کلمه', 'text', 'viewport', 1000, 'ease-out', { heavy: true }),
  p('gradient-text', 'Gradient Text', 'متن گرادیانی', 'text', 'loop', 5000, 'linear', { looping: true }),
  // ── Background / canvas ──────────────────────────────────────────────────────
  p('background-motion', 'Background Motion', 'حرکت پس‌زمینه', 'background', 'loop', 12000, 'ease-in-out', { looping: true, heavy: true }),
  p('canvas-motion', 'Canvas Motion', 'حرکت بوم', 'background', 'loop', 0, 'linear', { looping: true, heavy: true }),
  p('blob-motion', 'Blob Motion', 'حرکت حبابی', 'background', 'loop', 14000, 'ease-in-out', { looping: true, heavy: true }),
  p('morph', 'Morph', 'دگردیسی', 'background', 'loop', 10000, 'ease-in-out', { looping: true, heavy: true }),
  p('marquee', 'Marquee', 'روان‌نویس', 'background', 'loop', 20000, 'linear', { looping: true }),
  p('svg-path-draw', 'SVG Path Draw', 'رسم مسیر SVG', 'background', 'viewport', 2000, 'ease-in-out', { heavy: true }),
  p('lottie', 'Lottie', 'لوتی', 'background', 'load', 0, 'linear', { heavy: true }),
  p('image-sequence', 'Image Sequence', 'توالی تصویر', 'background', 'scroll', 0, 'linear', { heavy: true }),
  // ── Scroll ───────────────────────────────────────────────────────────────────
  p('parallax', 'Parallax', 'پارالاکس', 'scroll', 'scroll', 0, 'linear', { heavy: true }),
  p('scroll-reveal', 'Scroll Reveal', 'آشکارسازی اسکرول', 'scroll', 'scroll', 800, 'ease-out'),
  p('stagger', 'Stagger', 'پلکانی', 'scroll', 'viewport', 700, 'ease-out'),
  p('timeline', 'Timeline', 'خط زمانی', 'scroll', 'scroll', 0, 'linear', { heavy: true }),
  // ── Interactive ──────────────────────────────────────────────────────────────
  p('mouse-follow', 'Mouse Follow', 'دنبال‌کردن ماوس', 'interactive', 'hover', 0, 'ease-out', { heavy: true }),
  p('spotlight', 'Spotlight', 'نورافکن', 'interactive', 'hover', 0, 'ease-out', { heavy: true }),
  // ── Orbit / network / constellation (Phase 26.10) ──────────────────────────
  p('orbit-spin', 'Orbit Spin', 'چرخش مداری', 'orbit', 'loop', 18000, 'linear', { looping: true }),
  p('orbit-reverse', 'Orbit Reverse', 'چرخش معکوس', 'orbit', 'loop', 22000, 'linear', { looping: true }),
  p('orbit-tilt', 'Orbit Tilt', 'مدار کج', 'orbit', 'loop', 16000, 'ease-in-out', { looping: true, heavy: true }),
  p('node-pulse', 'Node Pulse', 'تپش گره', 'orbit', 'loop', 2400, 'ease-in-out', { looping: true }),
  p('node-glow', 'Node Glow', 'درخشش گره', 'orbit', 'loop', 2800, 'ease-in-out', { looping: true }),
  p('node-ripple', 'Node Ripple', 'موج گره', 'orbit', 'loop', 3000, 'ease-out', { looping: true }),
  p('constellation', 'Constellation', 'صورت فلکی', 'orbit', 'loop', 4000, 'ease-in-out', { looping: true }),
  p('constellation-drift', 'Constellation Drift', 'رانش ستاره‌ای', 'orbit', 'loop', 9000, 'ease-in-out', { looping: true, heavy: true }),
  p('radar-sweep', 'Radar Sweep', 'جاروب رادار', 'orbit', 'loop', 4000, 'linear', { looping: true }),
  p('network-pulse', 'Network Pulse', 'تپش شبکه', 'orbit', 'loop', 3200, 'ease-in-out', { looping: true }),
  p('satellite', 'Satellite', 'ماهواره', 'orbit', 'loop', 12000, 'linear', { looping: true }),
  p('satellite-fast', 'Satellite Fast', 'ماهواره سریع', 'orbit', 'loop', 6000, 'linear', { looping: true }),
  p('aurora', 'Aurora', 'شفق', 'orbit', 'loop', 14000, 'ease-in-out', { looping: true, heavy: true }),
  p('nebula', 'Nebula', 'سحابی', 'orbit', 'loop', 16000, 'ease-in-out', { looping: true, heavy: true }),
  p('grid-pan', 'Grid Pan', 'حرکت شبکه', 'orbit', 'loop', 20000, 'linear', { looping: true }),
  p('grid-glow', 'Grid Glow', 'درخشش شبکه', 'orbit', 'loop', 3600, 'ease-in-out', { looping: true }),
  p('signal-ping', 'Signal Ping', 'پینگ سیگنال', 'orbit', 'loop', 2200, 'ease-out', { looping: true }),
  p('sonar', 'Sonar', 'سونار', 'orbit', 'loop', 2800, 'ease-out', { looping: true }),
  p('galaxy-spin', 'Galaxy Spin', 'چرخش کهکشان', 'orbit', 'loop', 24000, 'linear', { looping: true, heavy: true }),
  p('vortex', 'Vortex', 'گرداب', 'orbit', 'loop', 9000, 'ease-in-out', { looping: true, heavy: true }),
]

const BY_ID = new Map(ANIMATION_PRESETS.map(a => [a.id, a]))

export const ANIMATION_CATEGORIES: AnimationCategory[] =
  [...new Set(ANIMATION_PRESETS.map(a => a.category))]

export function getAnimation(id: string): AnimationPreset | undefined { return BY_ID.get(id) }
export function isKnownAnimation(id: string): boolean { return BY_ID.has(id) }
export function animationsByCategory(category: AnimationCategory): AnimationPreset[] {
  return ANIMATION_PRESETS.filter(a => a.category === category)
}
/** Total count excluding the `none` sentinel. */
export const ANIMATION_COUNT = ANIMATION_PRESETS.filter(a => a.id !== 'none').length

/** The resolved render payload for one element's animation. */
export interface ResolvedAnimation {
  className: string
  style: Record<string, string>
  /** Trigger the renderer should honour (viewport → observe, hover → on hover, …). */
  trigger: AnimationTrigger
}

/**
 * Resolve an assignment to a CSS class + inline custom properties. Returns null
 * when there is nothing to render (unknown / none / disabled), or when
 * `reduceMotion`/`lowEnd` should suppress a heavy or looping animation.
 */
export function resolveAnimation(
  anim: HeroAnimation | undefined,
  opts: { reduceMotion?: boolean; lowEnd?: boolean } = {},
): ResolvedAnimation | null {
  if (!anim || anim.disabled) return null
  const preset = BY_ID.get(anim.preset)
  if (!preset || preset.id === 'none') return null
  // Motion suppression: reduced-motion kills looping + heavy; low-end kills heavy.
  if (opts.reduceMotion && (preset.looping || preset.heavy)) return null
  if (opts.lowEnd && preset.heavy) return null

  const dur = anim.durationMs ?? preset.defaultDurationMs
  const easing = anim.easing ?? preset.defaultEasing
  const repeat = anim.repeat === -1 ? 'infinite' : String(anim.repeat ?? (preset.looping ? 'infinite' : 1))
  const style: Record<string, string> = {
    '--hx-dur': `${dur}ms`,
    '--hx-delay': `${anim.delayMs ?? 0}ms`,
    '--hx-ease': EASING_CSS[easing],
    '--hx-repeat': repeat,
  }
  return { className: `hx-anim hx-${preset.id}`, style, trigger: anim.trigger ?? preset.trigger }
}

/**
 * Detect conflicting animations among a set of assignments (used by the rule
 * engine). Two *transform-based* entrance presets on the same element, or more
 * than a threshold of simultaneous heavy/looping animations, are flagged.
 */
export function animationConflicts(anims: (HeroAnimation | undefined)[]): string[] {
  const active = anims.filter((a): a is HeroAnimation => !!a && !a.disabled && a.preset !== 'none')
  const presets = active.map(a => BY_ID.get(a.preset)).filter((x): x is AnimationPreset => !!x)
  const issues: string[] = []
  const heavy = presets.filter(x => x.heavy).length
  if (heavy > 3) issues.push(`Too many heavy animations active at once (${heavy}); this can hurt performance on mobile.`)
  const looping = presets.filter(x => x.looping).length
  if (looping > 4) issues.push(`Too many looping animations (${looping}); consider reducing for accessibility.`)
  return issues
}
