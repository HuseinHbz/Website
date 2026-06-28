'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { slideUp, staggerContainer, fadeIn } from '@/lib/motion'

interface DbHero {
  badge?: string | null
  headline?: string | null
  headlineHighlight?: string | null
  subheadline?: string | null
  ctaPrimary?: string | null
  ctaPrimaryHref?: string | null
  ctaSecondary?: string | null
  ctaSecondaryHref?: string | null
  ctaTertiary?: string | null
  ctaTertiaryHref?: string | null
  stat1Label?: string | null; stat1Value?: string | null
  stat2Label?: string | null; stat2Value?: string | null
  stat3Label?: string | null; stat3Value?: string | null
  stat4Label?: string | null; stat4Value?: string | null
}

interface HeroProps {
  locale: string
  dbHero?: DbHero | null
}

function buildPath(locale: string, path: string) {
  return `/${locale}${path === '/' ? '' : path}`
}

function resolveHref(locale: string, href: string | null | undefined, fallback: string) {
  const h = href || fallback
  if (h.startsWith('http') || h.startsWith('/')) return h
  return buildPath(locale, '/' + h.replace(/^\//, ''))
}

/* ── Compact Network SVG for right panel ─────────────────────────── */
function MiniNetworkSVG() {
  const nodes = [
    { id: 'cisco',    x: 50,  y: 18,  label: 'Cisco',    color: '#1ba0d7', r: 14 },
    { id: 'mikro',    x: 18,  y: 42,  label: 'MikroTik', color: '#c03030', r: 12 },
    { id: 'linux',    x: 80,  y: 40,  label: 'Linux',    color: '#f59e0b', r: 12 },
    { id: 'vmware',   x: 38,  y: 62,  label: 'VMware',   color: '#60b6e0', r: 11 },
    { id: 'security', x: 10,  y: 66,  label: 'Security', color: '#10b981', r: 11 },
    { id: 'cloud',    x: 82,  y: 62,  label: 'Cloud',    color: '#6366f1', r: 12 },
    { id: 'monitor',  x: 58,  y: 78,  label: 'Monitor',  color: '#f59e0b', r: 10 },
    { id: 'auto',     x: 28,  y: 82,  label: 'Auto',     color: '#818cf8', r: 10 },
  ]
  const edges = [
    ['cisco','mikro',true], ['cisco','linux',true], ['cisco','cloud',false],
    ['mikro','security',true], ['mikro','vmware',false],
    ['linux','vmware',true], ['linux','monitor',false],
    ['vmware','monitor',true], ['vmware','auto',false],
    ['security','auto',false], ['cloud','monitor',true],
    ['monitor','auto',false],
  ] as [string, string, boolean][]

  function n(id: string) { return nodes.find(x => x.id === id)! }

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <filter id="ng">
          <feGaussianBlur stdDeviation="1.2" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <linearGradient id="eg1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.8"/>
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.3"/>
        </linearGradient>
        <linearGradient id="eg2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4"/>
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.1"/>
        </linearGradient>
      </defs>

      {/* Edges */}
      {edges.map(([a, b, active], i) => {
        const from = n(a), to = n(b)
        return (
          <line key={i}
            x1={from.x} y1={from.y} x2={to.x} y2={to.y}
            stroke={active ? 'url(#eg1)' : 'url(#eg2)'}
            strokeWidth={active ? 0.5 : 0.3}
            strokeDasharray={active ? '2 1.5' : undefined}
            opacity={active ? 0.9 : 0.4}
            style={active ? {
              animation: `dashFlow ${2 + i * 0.25}s linear infinite`,
            } : undefined}
          />
        )
      })}

      {/* Data packets on active edges */}
      {edges.filter(([,,a]) => a).map(([a, b], i) => {
        const from = n(a), to = n(b)
        const dx = to.x - from.x, dy = to.y - from.y
        const len = Math.sqrt(dx*dx + dy*dy)
        return (
          <circle key={`p${i}`} r="0.7" fill="#818cf8" opacity="0.9">
            <animateMotion dur={`${2.5 + i * 0.4}s`} repeatCount="indefinite" begin={`${i * 0.6}s`}
              path={`M${from.x},${from.y} L${to.x},${to.y}`}/>
          </circle>
        )
      })}

      {/* Nodes */}
      {nodes.map((node, i) => (
        <g key={node.id} filter="url(#ng)">
          {/* Pulse ring */}
          <circle cx={node.x} cy={node.y} r={node.r / 1.4} fill="none"
            stroke={node.color} strokeWidth="0.3" opacity="0.2">
            <animate attributeName="r" values={`${node.r/1.4};${node.r/1.1};${node.r/1.4}`}
              dur={`${3 + i * 0.3}s`} repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0.2;0.05;0.2"
              dur={`${3 + i * 0.3}s`} repeatCount="indefinite"/>
          </circle>
          {/* Node circle */}
          <circle cx={node.x} cy={node.y} r={node.r / 2.2}
            fill={node.color} fillOpacity="0.15"
            stroke={node.color} strokeWidth="0.6"/>
          {/* Label */}
          <text x={node.x} y={node.y + node.r / 1.5} textAnchor="middle"
            fill={node.color} fontSize="2.8" fontWeight="600" opacity="0.9">
            {node.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

export function Hero({ locale, dbHero }: HeroProps) {
  const isRTL = locale === 'fa'
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref })
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '20%'])
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0])

  const DEFAULTS = isRTL ? {
    badge: 'آماده همکاری با سازمان‌ها',
    headline: 'معمار زیرساخت',
    headlineHighlight: 'شبکه · امنیت · خودکارسازی',
    subheadline: 'طراحی، ایمن‌سازی و خودکارسازی زیرساخت سازمانی مدرن — از میکروتیک تا سیسکو، VMware تا Zabbix، Proxmox تا Ansible.',
    ctaPrimary: 'مشاهده پروژه‌ها',
    ctaPrimaryHref: `/${locale}/projects`,
    ctaSecondary: 'رزرو مشاوره',
    ctaSecondaryHref: `/${locale}/consultation`,
    ctaTertiary: 'دانلود رزومه',
    ctaTertiaryHref: '/resume.pdf',
    stats: [
      { value: '+۱۰', label: 'سال تجربه', color: '#6366f1' },
      { value: '+۵۰', label: 'پروژه زیرساختی', color: '#06b6d4' },
      { value: '+۱۰۰۰', label: 'تجهیزات مدیریتی', color: '#10b981' },
      { value: '+۲۰', label: 'استقرار سازمانی', color: '#f59e0b' },
    ],
  } : {
    badge: 'Available for enterprise projects',
    headline: 'Infrastructure Architect',
    headlineHighlight: 'Network · Security · Automation',
    subheadline: 'Designing, securing, and automating modern enterprise infrastructure — from MikroTik to Cisco, VMware to Zabbix, Proxmox to Ansible.',
    ctaPrimary: 'View Projects',
    ctaPrimaryHref: `/${locale}/projects`,
    ctaSecondary: 'Book Consultation',
    ctaSecondaryHref: `/${locale}/consultation`,
    ctaTertiary: 'Download Resume',
    ctaTertiaryHref: '/resume.pdf',
    stats: [
      { value: '10+', label: 'Years Experience', color: '#6366f1' },
      { value: '50+', label: 'Infrastructure Projects', color: '#06b6d4' },
      { value: '1000+', label: 'Managed Endpoints', color: '#10b981' },
      { value: '20+', label: 'Enterprise Deployments', color: '#f59e0b' },
    ],
  }

  const h = dbHero
  const badge        = h?.badge            || DEFAULTS.badge
  const headline     = h?.headline         || DEFAULTS.headline
  const headlineHi   = h?.headlineHighlight|| DEFAULTS.headlineHighlight
  const subheadline  = h?.subheadline      || DEFAULTS.subheadline
  const ctaPrimary   = h?.ctaPrimary       || DEFAULTS.ctaPrimary
  const ctaPrimaryHref   = resolveHref(locale, h?.ctaPrimaryHref,   DEFAULTS.ctaPrimaryHref)
  const ctaSecondary     = h?.ctaSecondary     || DEFAULTS.ctaSecondary
  const ctaSecondaryHref = resolveHref(locale, h?.ctaSecondaryHref, DEFAULTS.ctaSecondaryHref)
  const ctaTertiary      = h?.ctaTertiary      || DEFAULTS.ctaTertiary
  const ctaTertiaryHref  = resolveHref(locale, h?.ctaTertiaryHref,  DEFAULTS.ctaTertiaryHref)

  const METRICS = h?.stat1Value ? [
    { value: h.stat1Value, label: h.stat1Label || '', color: '#6366f1' },
    { value: h.stat2Value || '', label: h.stat2Label || '', color: '#06b6d4' },
    { value: h.stat3Value || '', label: h.stat3Label || '', color: '#10b981' },
    { value: h.stat4Value || '', label: h.stat4Label || '', color: '#f59e0b' },
  ] : DEFAULTS.stats

  return (
    <section
      ref={ref}
      className="relative min-h-screen flex items-center overflow-hidden bg-background"
      aria-label={isRTL ? 'بخش اصلی' : 'Hero section'}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Background grid */}
      <div className="absolute inset-0 grid-bg opacity-100 pointer-events-none" aria-hidden="true" />

      {/* Left glow */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true"
        style={{ background: 'radial-gradient(ellipse 55% 60% at 25% 50%, rgba(99,102,241,0.09) 0%, transparent 70%)' }}
      />
      {/* Top fade */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-background to-transparent pointer-events-none" />
      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" />

      <motion.div style={{ y, opacity }} className="relative z-10 w-full">
        <div className="container-site py-24 lg:py-32">
          <div className={`flex flex-col lg:flex-row items-center gap-12 lg:gap-16 ${isRTL ? 'lg:flex-row-reverse' : ''}`}>

            {/* ── LEFT: Content ────────────────────────────────── */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="flex-1 flex flex-col gap-6 lg:gap-7 text-center lg:text-left"
              style={isRTL ? { textAlign: 'right' } : {}}
            >
              {/* Badge */}
              <motion.div variants={fadeIn} className={`flex ${isRTL ? 'justify-center lg:justify-end' : 'justify-center lg:justify-start'}`}>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border"
                  style={{ background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.3)', color: '#10b981' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {badge}
                </div>
              </motion.div>

              {/* Name + Logo */}
              <motion.div variants={slideUp} className={`flex flex-col gap-1 ${isRTL ? 'items-center lg:items-end' : 'items-center lg:items-start'}`}>
                <span className="text-xs font-semibold tracking-[0.25em] uppercase text-text-muted">
                  {isRTL ? 'حسین حبیب‌آذر' : 'Husein Habibazar'}
                </span>
                <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-black tracking-tight leading-none"
                  style={{
                    background: 'linear-gradient(135deg, #f1f5f9 0%, #94a3b8 35%, #6366f1 65%, #818cf8 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}>
                  HBZ
                </h1>
              </motion.div>

              {/* Role */}
              <motion.div variants={slideUp} className="flex flex-col gap-1.5">
                <p className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight"
                  style={{
                    background: 'linear-gradient(135deg, #e2e8f0, #6366f1)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}>
                  {headline}
                </p>
                <p className="text-sm sm:text-base font-medium tracking-wider text-text-muted uppercase">
                  {headlineHi}
                </p>
              </motion.div>

              {/* Description */}
              <motion.div variants={slideUp}>
                <p className="text-sm sm:text-base text-text-secondary leading-relaxed max-w-lg"
                  style={isRTL ? { marginRight: 0 } : {}}>
                  {subheadline}
                </p>
              </motion.div>

              {/* CTAs */}
              <motion.div variants={slideUp}
                className={`flex flex-wrap gap-3 ${isRTL ? 'justify-center lg:justify-end' : 'justify-center lg:justify-start'}`}>
                <button
                  onClick={() => { window.location.href = ctaPrimaryHref }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg,#6366f1,#818cf8)', boxShadow: '0 0 20px rgba(99,102,241,0.35)' }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0l-4-4m4 4l-4 4" />
                  </svg>
                  {ctaPrimary}
                </button>
                <button
                  onClick={() => { window.location.href = ctaSecondaryHref }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-text-primary border border-border hover:border-accent/40 hover:bg-surface/60 transition-all duration-200"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {ctaSecondary}
                </button>
                <button
                  onClick={() => { window.open(ctaTertiaryHref, '_blank') }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-text-muted hover:text-text-primary transition-all duration-200"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {ctaTertiary}
                </button>
              </motion.div>

              {/* Stats */}
              <motion.div variants={fadeIn}
                className="grid grid-cols-4 gap-0 border border-border rounded-xl overflow-hidden bg-surface/30 backdrop-blur-sm mt-2">
                {METRICS.map((m, i) => m.value && (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9 + i * 0.1, duration: 0.5 }}
                    className={`flex flex-col items-center py-4 px-2 text-center ${i < METRICS.length - 1 ? 'border-r border-border' : ''}`}
                  >
                    <span className="text-lg sm:text-xl lg:text-2xl font-bold tabular-nums" style={{ color: m.color }}>
                      {m.value}
                    </span>
                    <span className="text-[10px] text-text-muted mt-0.5 leading-tight">{m.label}</span>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>

            {/* ── RIGHT: Mini Network Topology ─────────────────── */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, duration: 0.8, ease: 'easeOut' }}
              className="hidden lg:flex flex-shrink-0 w-[380px] xl:w-[440px] aspect-square items-center justify-center relative"
            >
              {/* Glow behind the network */}
              <div className="absolute inset-0 rounded-full"
                style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, rgba(6,182,212,0.05) 40%, transparent 70%)' }}
              />
              {/* Outer ring */}
              <div className="absolute inset-4 rounded-full border border-border/30"
                style={{ boxShadow: 'inset 0 0 40px rgba(99,102,241,0.04)' }}
              />
              {/* Network SVG */}
              <div className="absolute inset-8">
                <MiniNetworkSVG />
              </div>

              {/* Floating tech badges — corners */}
              {[
                { label: 'Cisco', color: '#1ba0d7', pos: 'top-6 left-6' },
                { label: 'MikroTik', color: '#c03030', pos: 'top-10 right-4' },
                { label: 'VMware', color: '#60b6e0', pos: 'bottom-10 left-4' },
                { label: 'Fortinet', color: '#ee3124', pos: 'bottom-6 right-6' },
              ].map((badge, i) => (
                <motion.div
                  key={badge.label}
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.8 + i * 0.15, duration: 0.5 }}
                  className={`absolute ${badge.pos} flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold`}
                  style={{
                    background: 'rgba(10,10,20,0.85)',
                    border: `1px solid ${badge.color}33`,
                    color: badge.color,
                    backdropFilter: 'blur(8px)',
                    boxShadow: `0 0 12px ${badge.color}18`,
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: badge.color }} />
                  {badge.label}
                </motion.div>
              ))}
            </motion.div>

          </div>
        </div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-text-muted pointer-events-none"
        aria-hidden="true"
      >
        <span className="text-[10px] tracking-widest uppercase font-medium">{isRTL ? 'اسکرول' : 'Scroll'}</span>
        <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
          </svg>
        </motion.div>
      </motion.div>
    </section>
  )
}
