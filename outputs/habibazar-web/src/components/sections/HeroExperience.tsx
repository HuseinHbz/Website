'use client'

/**
 * Public Hero renderer (Phase 23) — config-driven, template-aware.
 *
 * Renders a published HeroConfig for the given locale. The visual layout adapts
 * to the template's category (centered / split / showcase) and its background
 * kind (gradient / animation / canvas / video / image / solid) while honouring
 * every style token the builder exposes. Emits real analytics beacons
 * (view / scroll / click / conversion) to /api/hero/track. Fully
 * dependency-free and respects reduced-motion.
 */
import { useEffect, useRef, useState } from 'react'
import type { HeroConfig, HeroElementAnimation, Locale } from '@/lib/hero/types'
import { getTemplate } from '@/lib/hero/templates'
import { resolveAnimation, type HeroAnimation } from '@/lib/hero/animations'

type Layout = 'centered' | 'split' | 'showcase'
const LAYOUT_BY_CATEGORY: Record<string, Layout> = {
  corporate: 'split', technology: 'split', security: 'centered', cloud: 'split',
  ai: 'centered', consulting: 'split', portfolio: 'centered', media: 'centered',
  product: 'showcase', classic: 'centered',
}

interface Props {
  heroId: number
  config: HeroConfig
  locale: Locale
  experimentKey?: string
  variantId?: string
}

export function HeroExperience({ heroId, config, locale, experimentKey, variantId }: Props) {
  const ref = useRef<HTMLElement | null>(null)
  const maxScroll = useRef(0)
  const start = useRef(Date.now())

  const track = (type: 'view' | 'click' | 'conversion' | 'scroll' | 'time', value?: number) => {
    try {
      const body = JSON.stringify({ heroId, type, value, experimentKey, variantId })
      if (navigator.sendBeacon) navigator.sendBeacon('/api/hero/track', new Blob([body], { type: 'application/json' }))
      else fetch('/api/hero/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {})
    } catch { /* never break the page over a beacon */ }
  }

  useEffect(() => {
    track('view')
    const onScroll = () => {
      const el = ref.current; if (!el) return
      const rect = el.getBoundingClientRect()
      const pct = Math.max(0, Math.min(100, Math.round(((-rect.top) / Math.max(1, rect.height)) * 100)))
      if (pct > maxScroll.current) maxScroll.current = pct
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    const onLeave = () => {
      if (maxScroll.current > 0) track('scroll', maxScroll.current)
      track('time', Math.round((Date.now() - start.current) / 1000))
    }
    window.addEventListener('pagehide', onLeave)
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('pagehide', onLeave); onLeave() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroId])

  // Detect low-end devices client-side to auto-disable heavy animations.
  const [lowEnd, setLowEnd] = useState(false)
  useEffect(() => {
    const nav = navigator as Navigator & { deviceMemory?: number; hardwareConcurrency?: number }
    setLowEnd((nav.deviceMemory != null && nav.deviceMemory <= 4) || (nav.hardwareConcurrency != null && nav.hardwareConcurrency <= 4))
  }, [])

  const c = config.content[locale] ?? config.content.en
  const s = config.style
  const rtl = locale === 'fa'
  const tmpl = getTemplate(config.template)
  const layout = LAYOUT_BY_CATEGORY[tmpl?.category ?? 'classic'] ?? 'centered'
  const reduce = !!config.reduceMotion

  // Resolve a per-element animation assignment → { className, style } to merge.
  const anims = config.animations
  const anim = (key: keyof NonNullable<HeroConfig['animations']>): { className: string; style: React.CSSProperties } => {
    const a = anims?.[key] as HeroElementAnimation | undefined
    const r = resolveAnimation(a as HeroAnimation | undefined, { reduceMotion: reduce, lowEnd })
    return r ? { className: ` ${r.className}`, style: r.style as React.CSSProperties } : { className: '', style: {} }
  }
  const bg = s.background?.kind ?? 'gradient'
  const fg = s.textColor
  const hasMedia = !!c.mediaUrl

  const bgStyle: React.CSSProperties =
    bg === 'solid' ? { background: s.background?.color ?? '#0a0a0a' }
      : bg === 'image' && s.background?.value ? { backgroundImage: `url(${s.background.value})`, backgroundSize: 'cover', backgroundPosition: 'center' }
        : {}

  const onCtaClick = (isPrimary: boolean) => { track('click'); if (isPrimary) track('conversion') }

  const Copy = (
    <div className="relative z-10 max-w-2xl" style={{ maxWidth: s.containerWidth ? `${s.containerWidth}px` : undefined }}>
      {c.badge && <span className={`inline-block mb-5 px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide border border-white/20 bg-white/5${anim('badge').className}`} style={anim('badge').style}>{c.badge}</span>}
      <h1 className={`font-black tracking-tight${anim('headline').className}`} style={{ fontSize: `clamp(2.25rem, 6vw, ${s.titleSize ?? 56}px)`, fontWeight: s.fontWeight ?? 800, lineHeight: s.lineHeight ?? 1.08, letterSpacing: s.letterSpacing ? `${s.letterSpacing}px` : undefined, ...anim('headline').style }}>
        {c.headline}
        {c.headlineHighlight && <span className="text-brand"> {c.headlineHighlight}</span>}
      </h1>
      {c.subheadline && <p className={`mt-5 opacity-80 leading-relaxed${anim('subheadline').className}`} style={{ fontSize: `${s.subtitleSize ?? 20}px`, ...anim('subheadline').style }}>{c.subheadline}</p>}
      {(c.ctas ?? []).length > 0 && (
        <div className={`mt-8 flex flex-wrap gap-4${anim('ctas').className}`} style={anim('ctas').style}>
          {(c.ctas ?? []).map((cta, i) => {
            const primary = (cta.variant ?? 'primary') === 'primary'
            return (
              <a key={i} href={cta.href || '#'} onClick={() => onCtaClick(primary)} style={{ borderRadius: `${s.buttonRadius ?? 12}px` }}
                className={`px-7 py-3.5 text-sm font-semibold transition-transform hover:-translate-y-0.5 ${primary ? 'bg-brand text-white shadow-lg shadow-brand/25' : cta.variant === 'secondary' ? 'border border-current' : 'underline underline-offset-4'}`}>
                {cta.icon ? `${cta.icon} ` : ''}{cta.label}
              </a>
            )
          })}
        </div>
      )}
      {(c.stats ?? []).length > 0 && (
        <div className={`mt-12 flex flex-wrap gap-10${anim('stats').className}`} style={anim('stats').style}>
          {(c.stats ?? []).map((st, i) => (
            <div key={i}><div className="text-3xl font-bold text-brand">{st.value}</div><div className="text-sm opacity-70 mt-1">{st.label}</div></div>
          ))}
        </div>
      )}
    </div>
  )

  const Media = hasMedia ? (
    <div className={`relative z-10 flex-1 flex items-center justify-center${anim('media').className}`} style={anim('media').style}>
      {/\.(mp4|webm)$/i.test(c.mediaUrl!)
        ? <video src={c.mediaUrl} autoPlay={!reduce} muted loop playsInline aria-label={c.mediaAlt} className="w-full max-w-lg rounded-2xl shadow-2xl" style={{ opacity: s.imageOpacity ?? 1 }} />
        // eslint-disable-next-line @next/next/no-img-element
        : <img src={c.mediaUrl} alt={c.mediaAlt ?? ''} className="w-full max-w-lg rounded-2xl shadow-2xl" style={{ opacity: s.imageOpacity ?? 1, filter: s.blur ? `blur(${s.blur}px) brightness(${s.brightness ?? 1})` : undefined }} />}
    </div>
  ) : null

  return (
    <section ref={ref} dir={rtl ? 'rtl' : 'ltr'} aria-label={c.headline}
      className="relative overflow-hidden isolate"
      style={{ ...bgStyle, minHeight: `${s.minHeightVh ?? 100}svh`, paddingTop: s.paddingY ? `${s.paddingY}px` : undefined, paddingBottom: s.paddingY ? `${s.paddingY}px` : undefined, color: fg }}>
      {/* Animated / canvas / gradient background layer */}
      {(bg === 'gradient' || bg === 'animation' || bg === 'canvas') && (
        <div aria-hidden className="absolute inset-0 -z-10" style={{ background: 'linear-gradient(135deg,#0b1120 0%,#111c31 45%,#1e293b 100%)' }}>
          {!reduce && (bg === 'animation' || bg === 'canvas') && (
            <>
              <div className="absolute -top-40 -start-40 w-[36rem] h-[36rem] rounded-full bg-brand/20 blur-3xl animate-pulse" />
              <div className="absolute -bottom-40 -end-40 w-[32rem] h-[32rem] rounded-full bg-accent/20 blur-3xl animate-pulse" style={{ animationDelay: '1.2s' }} />
            </>
          )}
        </div>
      )}
      {/* Video background */}
      {bg === 'video' && s.background?.value && (
        <video aria-hidden src={s.background.value} autoPlay={!reduce} muted loop playsInline className="absolute inset-0 w-full h-full object-cover -z-10" />
      )}
      {/* Overlay */}
      {s.overlay ? <div aria-hidden className="absolute inset-0 -z-10 bg-black" style={{ opacity: s.overlay }} /> : null}

      <div className={`relative mx-auto w-full max-w-7xl px-6 md:px-10 flex items-center gap-12 ${layout === 'centered' ? 'flex-col text-center justify-center' : layout === 'showcase' ? 'flex-col lg:flex-row' : 'flex-col lg:flex-row'}`}
        style={{ minHeight: `${s.minHeightVh ?? 100}svh` }}>
        {layout === 'centered' ? Copy : <>{Copy}{Media}</>}
        {layout === 'centered' && Media}
      </div>
    </section>
  )
}
