'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'

/* ── Types ────────────────────────────────────────────────────────── */
interface DbHero {
  badge?: string | null; headline?: string | null; headlineHighlight?: string | null
  subheadline?: string | null
  ctaPrimary?: string | null; ctaPrimaryHref?: string | null
  ctaSecondary?: string | null; ctaSecondaryHref?: string | null
  ctaTertiary?: string | null; ctaTertiaryHref?: string | null
  stat1Label?: string | null; stat1Value?: string | null
  stat2Label?: string | null; stat2Value?: string | null
  stat3Label?: string | null; stat3Value?: string | null
  stat4Label?: string | null; stat4Value?: string | null
}

export interface HeroProps {
  locale: string
  dbHero?: DbHero | null
  variant?: string
}

export interface HeroContent {
  badge: string; headline: string; headlineHi: string; subheadline: string
  ctaPrimary: string; ctaPrimaryHref: string
  ctaSecondary: string; ctaSecondaryHref: string
  ctaTertiary: string; ctaTertiaryHref: string
  stats: { value: string; label: string; color: string }[]
  isRTL: boolean
}

/* ── Helpers ──────────────────────────────────────────────────────── */
function buildPath(locale: string, path: string) {
  return `/${locale}${path === '/' ? '' : path}`
}
function resolveHref(locale: string, href: string | null | undefined, fallback: string) {
  const h = href || fallback
  if (h.startsWith('http') || h.startsWith('/')) return h
  return buildPath(locale, '/' + h.replace(/^\//, ''))
}

function buildContent(locale: string, dbHero?: DbHero | null): HeroContent {
  const isRTL = locale === 'fa'
  const D = isRTL ? {
    badge: 'آماده همکاری با سازمان‌ها',
    headline: 'معمار زیرساخت',
    headlineHi: 'شبکه · امنیت · خودکارسازی',
    subheadline: 'طراحی، ایمن‌سازی و خودکارسازی زیرساخت سازمانی مدرن — از میکروتیک تا سیسکو، VMware تا Zabbix، Proxmox تا Ansible.',
    ctaPrimary: 'مشاهده پروژه‌ها', ctaPrimaryHref: `/${locale}/projects`,
    ctaSecondary: 'رزرو مشاوره', ctaSecondaryHref: `/${locale}/consultation`,
    ctaTertiary: 'دانلود رزومه', ctaTertiaryHref: '/resume.pdf',
    stats: [
      { value: '+۱۰', label: 'سال تجربه', color: '#6366f1' },
      { value: '+۵۰', label: 'پروژه زیرساختی', color: '#06b6d4' },
      { value: '+۱۰۰۰', label: 'تجهیزات مدیریتی', color: '#10b981' },
      { value: '+۲۰', label: 'استقرار سازمانی', color: '#f59e0b' },
    ],
  } : {
    badge: 'Available for enterprise projects',
    headline: 'Infrastructure Architect',
    headlineHi: 'Network · Security · Automation',
    subheadline: 'Designing, securing, and automating modern enterprise infrastructure — from MikroTik to Cisco, VMware to Zabbix, Proxmox to Ansible.',
    ctaPrimary: 'View Projects', ctaPrimaryHref: `/${locale}/projects`,
    ctaSecondary: 'Book Consultation', ctaSecondaryHref: `/${locale}/consultation`,
    ctaTertiary: 'Download Resume', ctaTertiaryHref: '/resume.pdf',
    stats: [
      { value: '10+', label: 'Years Experience', color: '#6366f1' },
      { value: '50+', label: 'Infrastructure Projects', color: '#06b6d4' },
      { value: '1000+', label: 'Managed Endpoints', color: '#10b981' },
      { value: '20+', label: 'Enterprise Deployments', color: '#f59e0b' },
    ],
  }
  const h = dbHero
  return {
    isRTL,
    badge:        h?.badge            || D.badge,
    headline:     h?.headline         || D.headline,
    headlineHi:   h?.headlineHighlight|| D.headlineHi,
    subheadline:  h?.subheadline      || D.subheadline,
    ctaPrimary:   h?.ctaPrimary       || D.ctaPrimary,
    ctaPrimaryHref:   resolveHref(locale, h?.ctaPrimaryHref,   D.ctaPrimaryHref),
    ctaSecondary:     h?.ctaSecondary     || D.ctaSecondary,
    ctaSecondaryHref: resolveHref(locale, h?.ctaSecondaryHref, D.ctaSecondaryHref),
    ctaTertiary:      h?.ctaTertiary      || D.ctaTertiary,
    ctaTertiaryHref:  resolveHref(locale, h?.ctaTertiaryHref,  D.ctaTertiaryHref),
    stats: h?.stat1Value ? [
      { value: h.stat1Value, label: h.stat1Label || '', color: '#6366f1' },
      { value: h.stat2Value || '', label: h.stat2Label || '', color: '#06b6d4' },
      { value: h.stat3Value || '', label: h.stat3Label || '', color: '#10b981' },
      { value: h.stat4Value || '', label: h.stat4Label || '', color: '#f59e0b' },
    ] : D.stats,
  }
}

/* ── Shared micro-components ─────────────────────────────────────── */
function Badge({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border w-fit"
      style={{ background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.3)', color: '#10b981' }}>
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      {label}
    </div>
  )
}

function StatBar({ stats }: { stats: HeroContent['stats'] }) {
  return (
    <div className="grid grid-cols-4 border border-border rounded-xl overflow-hidden bg-surface/30 backdrop-blur-sm">
      {stats.map((s, i) => s.value && (
        <div key={i} className={`flex flex-col items-center py-4 px-2 text-center ${i < stats.length - 1 ? 'border-r border-border' : ''}`}>
          <span className="text-xl lg:text-2xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</span>
          <span className="text-[10px] text-text-muted mt-0.5 leading-tight">{s.label}</span>
        </div>
      ))}
    </div>
  )
}

function CtaButtons({ c, row = false }: { c: HeroContent; row?: boolean }) {
  return (
    <div className={`flex flex-wrap gap-3 ${row ? 'justify-center' : ''}`}>
      <button onClick={() => { window.location.href = c.ctaPrimaryHref }}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:scale-[1.03]"
        style={{ background: 'linear-gradient(135deg,#6366f1,#818cf8)', boxShadow: '0 0 20px rgba(99,102,241,0.35)' }}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0l-4-4m4 4l-4 4" />
        </svg>
        {c.ctaPrimary}
      </button>
      <button onClick={() => { window.location.href = c.ctaSecondaryHref }}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-text-primary border border-border hover:border-accent/40 hover:bg-surface/60 transition-all">
        {c.ctaSecondary}
      </button>
      <button onClick={() => { window.open(c.ctaTertiaryHref, '_blank') }}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm text-text-muted hover:text-text-primary transition-all">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        {c.ctaTertiary}
      </button>
    </div>
  )
}

function MiniNetworkSVG() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <filter id="ng2"><feGaussianBlur stdDeviation="1.2" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <linearGradient id="ea" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.9"/>
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.4"/>
        </linearGradient>
        <linearGradient id="eb" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.1"/>
        </linearGradient>
      </defs>
      {[['50,18','18,42',true],['50,18','80,40',true],['18,42','10,66',true],['80,40','38,62',true],
        ['38,62','58,78',true],['82,62','58,78',true],
        ['50,18','82,62',false],['18,42','38,62',false],['10,66','28,82',false],
        ['38,62','28,82',false],['58,78','28,82',false]
      ].map(([a,b,act],i) => {
        const [x1,y1]=String(a).split(','), [x2,y2]=String(b).split(',')
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={act ? 'url(#ea)' : 'url(#eb)'}
          strokeWidth={act ? 0.5 : 0.3}
          strokeDasharray={act ? '2 1.5' : undefined}
          opacity={act ? 0.9 : 0.4}
          style={act ? { animation: `dashFlow ${2+i*0.25}s linear infinite` } : undefined}/>
      })}
      {[['50','18','Cisco','#1ba0d7'],['18','42','Mikro','#c03030'],['80','40','Linux','#f59e0b'],
        ['38','62','VMware','#60b6e0'],['10','66','Sec','#10b981'],
        ['82','62','Cloud','#6366f1'],['58','78','Mon','#f59e0b'],['28','82','Auto','#818cf8']
      ].map(([cx,cy,lbl,col],i) => (
        <g key={i} filter="url(#ng2)">
          <circle cx={cx} cy={cy} r="4.5" fill={`${col}20`} stroke={col} strokeWidth="0.6"/>
          <text x={cx} y={Number(cy)+3} textAnchor="middle" fill={col} fontSize="2.6" fontWeight="700">{lbl}</text>
        </g>
      ))}
      {[['50,18','18,42','#818cf8',2.2],['50,18','80,40','#06b6d4',2.6],
        ['18,42','10,66','#10b981',2.0],['80,40','38,62','#6366f1',2.4]
      ].map(([path, ,col,dur],i) => {
        const pts=String(path).split(',')
        return <circle key={`p${i}`} r="0.9" fill={String(col)} opacity="0.9">
          <animateMotion dur={`${dur}s`} repeatCount="indefinite" begin={`${i*0.5}s`}
            path={`M${pts[0]},${pts[1]} L${pts[2]},${pts[3]}`}/>
        </circle>
      })}
    </svg>
  )
}

function ScrollIndicator({ label }: { label: string }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2, duration: 1 }}
      className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-text-muted pointer-events-none" aria-hidden="true">
      <span className="text-[10px] tracking-widest uppercase font-medium">{label}</span>
      <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
        </svg>
      </motion.div>
    </motion.div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   VARIANT 1 — SPLIT LAYOUT (left text, right network)
══════════════════════════════════════════════════════════════════ */
function VariantSplit({ c }: { c: HeroContent }) {
  return (
    <div className="container-site py-24 lg:py-32">
      <div className={`flex flex-col lg:flex-row items-center gap-12 lg:gap-16 ${c.isRTL ? 'lg:flex-row-reverse' : ''}`}>
        <motion.div initial="hidden" animate="visible"
          variants={{ hidden:{}, visible:{ transition:{ staggerChildren:0.1 } } }}
          className="flex-1 flex flex-col gap-6 lg:gap-7">
          <motion.div variants={{ hidden:{opacity:0}, visible:{opacity:1} }}>
            <Badge label={c.badge} />
          </motion.div>
          <motion.div variants={{ hidden:{opacity:0,y:20}, visible:{opacity:1,y:0} }} className="flex flex-col gap-1">
            <span className="text-xs font-semibold tracking-[0.25em] uppercase text-text-muted">
              {c.isRTL ? 'حسین حبیب‌آذر' : 'Husein Habibazar'}
            </span>
            <h1 className="text-6xl sm:text-7xl lg:text-8xl font-black tracking-tight leading-none"
              style={{ background:'linear-gradient(135deg,#f1f5f9 0%,#94a3b8 35%,#6366f1 65%,#818cf8 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
              HBZ
            </h1>
          </motion.div>
          <motion.div variants={{ hidden:{opacity:0,y:20}, visible:{opacity:1,y:0} }}>
            <p className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight"
              style={{ background:'linear-gradient(135deg,#e2e8f0,#6366f1)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
              {c.headline}
            </p>
            <p className="text-sm font-medium tracking-wider text-text-muted uppercase mt-1">{c.headlineHi}</p>
          </motion.div>
          <motion.div variants={{ hidden:{opacity:0,y:20}, visible:{opacity:1,y:0} }}>
            <p className="text-sm sm:text-base text-text-secondary leading-relaxed max-w-lg">{c.subheadline}</p>
          </motion.div>
          <motion.div variants={{ hidden:{opacity:0,y:20}, visible:{opacity:1,y:0} }}>
            <CtaButtons c={c} />
          </motion.div>
          <motion.div variants={{ hidden:{opacity:0}, visible:{opacity:1} }} className="mt-2">
            <StatBar stats={c.stats} />
          </motion.div>
        </motion.div>

        <motion.div initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }}
          transition={{ delay:0.4, duration:0.8 }}
          className="hidden lg:flex flex-shrink-0 w-[380px] xl:w-[440px] aspect-square items-center justify-center relative">
          <div className="absolute inset-0 rounded-full"
            style={{ background:'radial-gradient(circle, rgba(99,102,241,0.1) 0%, rgba(6,182,212,0.05) 40%, transparent 70%)' }}/>
          <div className="absolute inset-4 rounded-full border border-border/30"/>
          <div className="absolute inset-8"><MiniNetworkSVG /></div>
          {[
            { label:'Cisco', color:'#1ba0d7', cls:'top-6 left-6' },
            { label:'MikroTik', color:'#c03030', cls:'top-10 right-4' },
            { label:'VMware', color:'#60b6e0', cls:'bottom-10 left-4' },
            { label:'Fortinet', color:'#ee3124', cls:'bottom-6 right-6' },
          ].map((b,i) => (
            <motion.div key={b.label} initial={{ opacity:0, scale:0.7 }} animate={{ opacity:1, scale:1 }}
              transition={{ delay:0.8+i*0.15, duration:0.5 }}
              className={`absolute ${b.cls} flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold`}
              style={{ background:'rgba(10,10,20,0.85)', border:`1px solid ${b.color}33`, color:b.color, backdropFilter:'blur(8px)' }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background:b.color }}/>
              {b.label}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   VARIANT 2 — MINIMAL BOLD (center, huge typography)
══════════════════════════════════════════════════════════════════ */
function VariantMinimal({ c }: { c: HeroContent }) {
  return (
    <div className="container-site py-24 flex flex-col items-center text-center gap-6 max-w-4xl mx-auto">
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.1 }}>
        <Badge label={c.badge} />
      </motion.div>
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.15 }}>
        <span className="text-xs font-semibold tracking-[0.3em] uppercase text-text-muted">
          {c.isRTL ? 'حسین حبیب‌آذر' : 'Husein Habibazar'}
        </span>
      </motion.div>
      <motion.h1 initial={{ opacity:0, y:30 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2, duration:0.7 }}
        className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-tight leading-none">
        <span className="block" style={{ background:'linear-gradient(90deg,#e2e8f0,#94a3b8)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
          {c.isRTL ? 'معمار' : 'INFRA'}
        </span>
        <span className="block" style={{ background:'linear-gradient(90deg,#6366f1,#818cf8)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
          {c.isRTL ? 'زیرساخت' : 'ARCHITECT'}
        </span>
      </motion.h1>
      <motion.div initial={{ scaleX:0 }} animate={{ scaleX:1 }} transition={{ delay:0.5, duration:0.5 }}
        className="w-16 h-0.5 bg-accent rounded-full"/>
      <motion.p initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.55 }}
        className="text-sm text-text-muted tracking-widest uppercase">{c.headlineHi}</motion.p>
      <motion.p initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.6 }}
        className="text-base text-text-secondary leading-relaxed max-w-xl">{c.subheadline}</motion.p>
      <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.7 }}>
        <CtaButtons c={c} row />
      </motion.div>
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.85 }} className="w-full max-w-2xl">
        <StatBar stats={c.stats} />
      </motion.div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   VARIANT 3 — GLASSMORPHISM CARD (center glass card)
══════════════════════════════════════════════════════════════════ */
function VariantGlass({ c }: { c: HeroContent }) {
  return (
    <div className="container-site py-24 flex flex-col items-center gap-6 max-w-2xl mx-auto text-center">
      {/* Tech pills row */}
      <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1 }}
        className="flex flex-wrap justify-center gap-2">
        {['🔷 Cisco','🐧 Linux','☁️ Cloud','🖥️ VMware','🛡️ Fortinet'].map(t => (
          <span key={t} className="text-xs text-text-muted border border-border/60 rounded-lg px-3 py-1.5 bg-surface/30 backdrop-blur-sm">{t}</span>
        ))}
      </motion.div>
      {/* Main glass card */}
      <motion.div initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }} transition={{ delay:0.2, duration:0.6 }}
        className="w-full rounded-2xl p-8 flex flex-col gap-5"
        style={{ background:'rgba(13,13,23,0.8)', border:'1px solid rgba(99,102,241,0.2)', backdropFilter:'blur(20px)', boxShadow:'0 0 60px rgba(99,102,241,0.08)' }}>
        <Badge label={c.badge} />
        <div>
          <span className="text-xs text-text-muted tracking-widest uppercase">{c.isRTL ? 'حسین حبیب‌آذر' : 'Husein Habibazar'}</span>
          <h1 className="text-4xl sm:text-5xl font-black mt-1"
            style={{ background:'linear-gradient(135deg,#f1f5f9,#6366f1)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
            {c.headline}
          </h1>
          <p className="text-text-muted text-sm mt-1">{c.headlineHi}</p>
        </div>
        <p className="text-sm text-text-secondary leading-relaxed">{c.subheadline}</p>
        <CtaButtons c={c} row />
      </motion.div>
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.5 }} className="w-full">
        <StatBar stats={c.stats} />
      </motion.div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   VARIANT 4 — TERMINAL (code terminal window)
══════════════════════════════════════════════════════════════════ */
function VariantTerminal({ c }: { c: HeroContent }) {
  return (
    <div className="container-site py-24 flex flex-col items-center gap-8 max-w-2xl mx-auto">
      <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1, duration:0.6 }}
        className="w-full rounded-xl overflow-hidden"
        style={{ background:'rgba(4,8,4,0.97)', border:'1px solid rgba(0,255,100,0.18)', boxShadow:'0 0 40px rgba(0,255,100,0.05)' }}>
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor:'rgba(0,255,100,0.1)', background:'rgba(6,12,6,0.9)' }}>
          {['#ff5f57','#febc2e','#28c840'].map(c => <div key={c} className="w-3 h-3 rounded-full" style={{ background:c }}/>)}
          <span className="ml-2 text-xs font-mono" style={{ color:'#3a5a3a' }}>
            husein@habibazar:~ — {c.isRTL ? 'معمار زیرساخت' : 'Infrastructure Architect'}
          </span>
        </div>
        {/* Body */}
        <div className="p-6 font-mono text-xs sm:text-sm leading-loose">
          <div><span style={{ color:'#4ade80' }}>husein@hbz</span><span style={{ color:'#3a5a3a' }}>:~$ </span>
            <span className="text-slate-300">whoami --verbose</span></div>
          <div style={{ color:'#4a6a4a', paddingLeft:'1rem' }}>▸ <span style={{ color:'#818cf8' }}>{c.isRTL ? 'حسین حبیب‌آذر' : 'Husein Habibazar'}</span> · {c.headline}</div>
          <br/>
          <div><span style={{ color:'#4ade80' }}>husein@hbz</span><span style={{ color:'#3a5a3a' }}>:~$ </span>
            <span className="text-slate-300">skills --top 5</span></div>
          <div style={{ color:'#4a6a4a', paddingLeft:'1rem' }}>▸ <span style={{ color:'#06b6d4' }}>Cisco</span> · <span style={{ color:'#06b6d4' }}>MikroTik</span> · <span style={{ color:'#06b6d4' }}>VMware</span> · <span style={{ color:'#06b6d4' }}>Fortinet</span> · <span style={{ color:'#06b6d4' }}>Zabbix</span></div>
          <br/>
          <div><span style={{ color:'#4ade80' }}>husein@hbz</span><span style={{ color:'#3a5a3a' }}>:~$ </span>
            <span className="text-slate-300">stats</span></div>
          <div style={{ color:'#4a6a4a', paddingLeft:'1rem' }}>▸ {c.stats.filter(s=>s.value).map(s => `${s.label.split(' ')[0]}=`+s.value).join('  ')}</div>
          <br/>
          <div className="flex flex-wrap gap-2 mt-1">
            <button onClick={() => { window.location.href = c.ctaPrimaryHref }}
              className="px-4 py-1.5 rounded text-xs font-mono font-medium transition-colors"
              style={{ background:'rgba(21,48,30,0.8)', border:'1px solid #4ade80', color:'#4ade80' }}>
              ./{c.isRTL ? 'پروژه‌ها' : 'view-projects'}
            </button>
            <button onClick={() => { window.location.href = c.ctaSecondaryHref }}
              className="px-4 py-1.5 rounded text-xs font-mono transition-colors"
              style={{ border:'1px solid rgba(74,106,74,0.5)', color:'#4a6a4a' }}>
              ./{c.isRTL ? 'مشاوره' : 'book-consultation'}
            </button>
            <button onClick={() => { window.open(c.ctaTertiaryHref, '_blank') }}
              className="px-4 py-1.5 rounded text-xs font-mono transition-colors"
              style={{ border:'1px solid rgba(74,106,74,0.5)', color:'#4a6a4a' }}>
              ./{c.isRTL ? 'رزومه' : 'download-cv'}
            </button>
          </div>
        </div>
      </motion.div>
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.5 }} className="w-full">
        <StatBar stats={c.stats} />
      </motion.div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   VARIANT 5 — BENTO GRID
══════════════════════════════════════════════════════════════════ */
function VariantBento({ c }: { c: HeroContent }) {
  return (
    <div className="container-site py-24 max-w-5xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-auto">
        {/* Main card — spans 2 cols */}
        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1 }}
          className="md:col-span-2 rounded-2xl p-8 flex flex-col gap-5 relative overflow-hidden"
          style={{ background:'rgba(13,13,23,0.9)', border:'1px solid rgba(99,102,241,0.22)', boxShadow:'0 0 40px rgba(99,102,241,0.06)' }}>
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full pointer-events-none"
            style={{ background:'radial-gradient(circle,rgba(99,102,241,0.12) 0%,transparent 70%)', transform:'translate(30%,-30%)' }}/>
          <Badge label={c.badge} />
          <span className="text-xs text-text-muted tracking-widest uppercase">{c.isRTL ? 'حسین حبیب‌آذر' : 'Husein Habibazar'}</span>
          <h1 className="text-4xl sm:text-5xl font-black leading-tight"
            style={{ background:'linear-gradient(135deg,#f1f5f9 0%,#6366f1 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
            {c.headline}
          </h1>
          <p className="text-sm text-text-secondary leading-relaxed max-w-md">{c.subheadline}</p>
          <CtaButtons c={c} />
        </motion.div>

        {/* Stats card */}
        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2 }}
          className="rounded-2xl p-6 flex flex-col justify-center gap-4"
          style={{ background:'rgba(13,13,23,0.9)', border:'1px solid rgba(99,102,241,0.15)' }}>
          {c.stats.filter(s=>s.value).map((s,i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-2xl font-black tabular-nums" style={{ color:s.color }}>{s.value}</span>
              <span className="text-xs text-text-muted leading-tight">{s.label}</span>
            </div>
          ))}
        </motion.div>

        {/* Tech tags card */}
        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.3 }}
          className="md:col-span-3 rounded-2xl p-5 flex flex-wrap gap-2 items-center"
          style={{ background:'rgba(13,13,23,0.7)', border:'1px solid #1e1e2e' }}>
          <span className="text-xs text-text-muted mr-2">{c.isRTL ? 'تکنولوژی‌ها:' : 'Tech Stack:'}</span>
          {['🔷 Cisco','🌐 MikroTik','🐧 Linux','🖥️ VMware','🛡️ Fortinet','☁️ Cloud','📊 Zabbix','⚙️ Ansible','🔴 Proxmox','📡 VoIP'].map(t => (
            <span key={t} className="text-xs text-text-secondary border border-border/60 rounded-lg px-2.5 py-1 bg-surface/40">{t}</span>
          ))}
        </motion.div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   VARIANT 6 — DARK LUXURY (cinematic centered with avatar)
══════════════════════════════════════════════════════════════════ */
function VariantLuxury({ c }: { c: HeroContent }) {
  return (
    <div className="container-site py-24 flex flex-col items-center text-center gap-5 max-w-3xl mx-auto">
      <motion.p initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.1 }}
        className="text-[10px] tracking-[0.4em] uppercase text-text-muted">
        {c.headlineHi}
      </motion.p>
      <motion.div initial={{ opacity:0, scale:0.8 }} animate={{ opacity:1, scale:1 }} transition={{ delay:0.2 }}
        className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-black"
        style={{ background:'linear-gradient(135deg,#1e1e3f,#2d2d5f)', border:'1px solid rgba(99,102,241,0.35)', color:'#818cf8', boxShadow:'0 0 30px rgba(99,102,241,0.18)' }}>
        HBZ
      </motion.div>
      <motion.h1 initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.3, duration:0.7 }}
        className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tighter leading-none">
        <span className="block text-text-primary">{c.isRTL ? 'حسین' : 'HUSEIN'}</span>
        <span className="block" style={{ color:'#6366f1' }}>{c.isRTL ? 'حبیب‌آذر' : 'HABIBAZAR'}</span>
      </motion.h1>
      {/* Divider */}
      <motion.div initial={{ scaleX:0 }} animate={{ scaleX:1 }} transition={{ delay:0.55, duration:0.5 }}
        className="flex items-center gap-4 w-72">
        <div className="flex-1 h-px" style={{ background:'linear-gradient(90deg,transparent,#2a2a3e)' }}/>
        <span className="text-[10px] tracking-[0.3em] uppercase text-text-muted whitespace-nowrap">{c.isRTL ? 'معمار زیرساخت' : 'Infrastructure Architect'}</span>
        <div className="flex-1 h-px" style={{ background:'linear-gradient(90deg,#2a2a3e,transparent)' }}/>
      </motion.div>
      <motion.p initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.6 }}
        className="text-sm text-text-secondary leading-relaxed max-w-xl">{c.subheadline}</motion.p>
      <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.7 }}>
        <CtaButtons c={c} row />
      </motion.div>
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.85 }}
        className="flex gap-8 border-t border-border pt-6 mt-2">
        {c.stats.filter(s=>s.value).map((s,i) => (
          <div key={i} className="text-center">
            <div className="text-2xl font-black" style={{ color:s.color }}>{s.value}</div>
            <div className="text-[10px] text-text-muted uppercase tracking-wider mt-0.5">{s.label}</div>
          </div>
        ))}
      </motion.div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   VARIANT 7 — NEON CIRCUIT (dual cyan/purple)
══════════════════════════════════════════════════════════════════ */
function VariantNeon({ c }: { c: HeroContent }) {
  return (
    <div className="container-site py-24 flex flex-col items-center text-center gap-6 max-w-4xl mx-auto">
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.1 }}
        className="flex items-center gap-3">
        <div className="h-px w-8 bg-cyan-400"/>
        <span className="text-[10px] tracking-[0.4em] uppercase text-cyan-400">
          {c.isRTL ? 'حسین حبیب‌آذر · HBZ' : 'Husein Habibazar · HBZ'}
        </span>
        <div className="h-px w-8 bg-indigo-400"/>
      </motion.div>
      <motion.h1 initial={{ opacity:0, y:30 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2, duration:0.7 }}
        className="text-6xl sm:text-7xl md:text-8xl font-black tracking-tighter leading-none">
        <span className="block text-text-primary">{c.isRTL ? 'معمار' : 'Infrastructure'}</span>
        <span className="block" style={{ background:'linear-gradient(90deg,#06b6d4,#6366f1,#818cf8)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
          {c.isRTL ? 'زیرساخت' : 'Architect'}
        </span>
      </motion.h1>
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.4 }}
        className="flex flex-wrap justify-center gap-2">
        {(c.isRTL
          ? ['طراحی شبکه','امنیت','مجازی‌سازی','خودکارسازی']
          : ['Network Design','Security','Virtualization','Automation']
        ).map((t,i) => (
          <span key={t} className="text-xs px-3 py-1.5 rounded-md border"
            style={ i < 2
              ? { color:'#06b6d4', borderColor:'rgba(6,182,212,0.35)', background:'rgba(6,182,212,0.06)' }
              : { color:'#818cf8', borderColor:'rgba(129,140,248,0.35)', background:'rgba(129,140,248,0.06)' } }>
            {t}
          </span>
        ))}
      </motion.div>
      <motion.p initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.5 }}
        className="text-sm text-text-secondary leading-relaxed max-w-xl">{c.subheadline}</motion.p>
      <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.6 }}
        className="flex flex-wrap justify-center gap-3">
        <button onClick={() => { window.location.href = c.ctaPrimaryHref }}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
          style={{ background:'rgba(6,182,212,0.1)', border:'1px solid rgba(6,182,212,0.4)', color:'#06b6d4' }}>
          → {c.ctaPrimary}
        </button>
        <button onClick={() => { window.location.href = c.ctaSecondaryHref }}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
          style={{ background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.4)', color:'#818cf8' }}>
          {c.ctaSecondary}
        </button>
        <button onClick={() => { window.open(c.ctaTertiaryHref,'_blank') }}
          className="px-5 py-2.5 rounded-lg text-sm text-text-muted border border-border/40 transition-all hover:text-text-primary">
          ↓ {c.ctaTertiary}
        </button>
      </motion.div>
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.75 }} className="w-full max-w-lg">
        <div className="flex border border-border/40 rounded-xl overflow-hidden">
          {c.stats.filter(s=>s.value).map((s,i) => (
            <div key={i} className={`flex-1 py-4 text-center ${i<c.stats.length-1?'border-r border-border/40':''}`}>
              <div className="text-xl font-black" style={{ background:'linear-gradient(90deg,#06b6d4,#6366f1)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>{s.value}</div>
              <div className="text-[10px] text-text-muted mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   VARIANT 8 — MAGAZINE / EDITORIAL (two columns)
══════════════════════════════════════════════════════════════════ */
function VariantMagazine({ c }: { c: HeroContent }) {
  const skills = ['Cisco','MikroTik','VMware','Fortinet','Proxmox','Zabbix','Ansible','Linux']
  const bars = [
    { label: c.isRTL?'شبکه':'Network', w:95, color:'#6366f1' },
    { label: c.isRTL?'امنیت':'Security', w:90, color:'#ef4444' },
    { label: c.isRTL?'مجازی‌سازی':'Virtual', w:85, color:'#06b6d4' },
    { label: c.isRTL?'خودکارسازی':'Automation', w:78, color:'#10b981' },
  ]
  return (
    <div className="container-site py-24 max-w-5xl mx-auto">
      {/* Top accent stripe */}
      <div className="w-full h-0.5 mb-12 rounded-full"
        style={{ background:'linear-gradient(90deg,#6366f1,#06b6d4,#10b981,#f59e0b)' }}/>
      <div className={`flex flex-col lg:flex-row gap-12 ${c.isRTL?'lg:flex-row-reverse':''}`}>
        {/* Left */}
        <motion.div initial={{ opacity:0, x:c.isRTL?20:-20 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.1 }}
          className="flex-1 flex flex-col gap-5 border-r border-border/40 pr-12">
          <span className="text-[10px] tracking-[0.4em] uppercase text-text-muted">{c.headlineHi}</span>
          <h1 className="text-5xl sm:text-6xl font-black tracking-tighter leading-none">
            <span className="block text-text-primary">{c.isRTL?'حسین':'HUSEIN'}</span>
            <span className="block" style={{ color:'#6366f1' }}>{c.isRTL?'حبیب‌آذر':'HABIBAZAR'}</span>
            <span className="block text-2xl font-semibold text-accent mt-1">HBZ</span>
          </h1>
          <p className="text-xs text-text-muted">
            {c.isRTL?'مهندس ارشد شبکه و امنیت':'Senior Network & Security Engineer'}
            {' · '}
            <span className="text-accent">{c.stats[0]?.value}</span>
          </p>
          <div className="border-l-2 border-accent pl-3">
            <p className="text-sm text-text-secondary leading-relaxed">{c.subheadline}</p>
          </div>
          <CtaButtons c={c} />
        </motion.div>
        {/* Right */}
        <motion.div initial={{ opacity:0, x:c.isRTL?-20:20 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.2 }}
          className="lg:w-64 flex flex-col gap-6">
          <div>
            <span className="text-[9px] tracking-[0.3em] uppercase text-text-muted mb-3 block">
              {c.isRTL?'مهارت‌های فنی':'Technical Proficiency'}
            </span>
            <div className="flex flex-col gap-2.5">
              {bars.map(b => (
                <div key={b.label} className="flex items-center gap-2">
                  <span className="text-[11px] text-text-muted w-16 shrink-0">{b.label}</span>
                  <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
                    <motion.div initial={{ width:0 }} animate={{ width:`${b.w}%` }}
                      transition={{ delay:0.5, duration:0.8 }}
                      className="h-full rounded-full" style={{ background:b.color }}/>
                  </div>
                  <span className="text-[10px] font-mono text-text-muted w-6">{b.w}%</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <span className="text-[9px] tracking-[0.3em] uppercase text-text-muted mb-2 block">Tech Stack</span>
            <div className="flex flex-wrap gap-1.5">
              {skills.map(s => (
                <span key={s} className="text-[10px] text-accent border border-accent/25 rounded px-2 py-0.5" style={{ background:'rgba(99,102,241,0.06)' }}>{s}</span>
              ))}
            </div>
          </div>
          <div className="flex gap-4 pt-3 border-t border-border">
            {c.stats.slice(0,3).filter(s=>s.value).map((s,i) => (
              <div key={i} className="text-center">
                <div className="text-base font-black" style={{ color:s.color }}>{s.value}</div>
                <div className="text-[9px] text-text-muted">{s.label.split(' ')[0]}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   VARIANT 9 — CENTERED FULL (original polished)
══════════════════════════════════════════════════════════════════ */
function VariantCentered({ c }: { c: HeroContent }) {
  return (
    <div className="container-site py-24 flex flex-col items-center text-center gap-6 max-w-5xl mx-auto">
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.1 }}>
        <Badge label={c.badge} />
      </motion.div>
      <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2 }} className="flex flex-col items-center gap-1">
        <span className="text-xs font-semibold tracking-[0.25em] uppercase text-text-muted">{c.isRTL?'حسین حبیب‌آذر':'Husein Habibazar'}</span>
        <h1 className="text-6xl sm:text-7xl md:text-8xl font-black tracking-tight leading-none"
          style={{ background:'linear-gradient(135deg,#f1f5f9 0%,#94a3b8 35%,#6366f1 65%,#818cf8 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
          HBZ
        </h1>
      </motion.div>
      <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.3 }}>
        <p className="text-2xl sm:text-3xl font-bold gradient-text">{c.headline}</p>
        <p className="text-base text-text-secondary mt-1">{c.headlineHi}</p>
      </motion.div>
      <motion.p initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.4 }}
        className="text-base text-text-secondary leading-relaxed max-w-2xl">{c.subheadline}</motion.p>
      <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.5 }}>
        <CtaButtons c={c} row />
      </motion.div>
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.7 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mt-4 w-full max-w-3xl">
        {c.stats.map((s,i) => s.value && (
          <motion.div key={i} initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.8+i*0.1 }}
            className="metric-card text-center hover:border-accent/40 transition-all">
            <div className="text-2xl md:text-3xl font-bold tabular-nums" style={{ color:s.color }}>{s.value}</div>
            <div className="text-xs text-text-muted mt-1 leading-tight">{s.label}</div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   VARIANT 10 — GRADIENT MESH (modern colorful)
══════════════════════════════════════════════════════════════════ */
function VariantGradient({ c }: { c: HeroContent }) {
  return (
    <div className="container-site py-24 max-w-4xl mx-auto flex flex-col items-center text-center gap-6">
      <motion.div initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }} transition={{ delay:0.1 }}>
        <Badge label={c.badge} />
      </motion.div>
      <motion.div initial={{ opacity:0, y:30 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2, duration:0.7 }}>
        <span className="text-[10px] tracking-[0.4em] uppercase block mb-3" style={{ color:'rgba(99,102,241,0.7)' }}>
          {c.isRTL?'حسین حبیب‌آذر':'Husein Habibazar'}
        </span>
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-tight">
          <span className="block" style={{ background:'linear-gradient(135deg,#f1f5f9 0%,#c7d2fe 50%,#818cf8 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
            {c.headline}
          </span>
        </h1>
      </motion.div>
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.4 }}
        className="flex flex-wrap justify-center gap-2">
        {c.headlineHi.split('·').map(t => (
          <span key={t} className="px-3 py-1 rounded-full text-xs font-medium"
            style={{ background:'rgba(99,102,241,0.12)', border:'1px solid rgba(99,102,241,0.25)', color:'#818cf8' }}>
            {t.trim()}
          </span>
        ))}
      </motion.div>
      <motion.p initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.5 }}
        className="text-sm text-text-secondary leading-relaxed max-w-xl">{c.subheadline}</motion.p>
      <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.6 }}>
        <CtaButtons c={c} row />
      </motion.div>
      {/* Gradient stat pills */}
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.75 }}
        className="flex flex-wrap justify-center gap-3">
        {c.stats.filter(s=>s.value).map((s,i) => (
          <div key={i} className="flex items-center gap-2 px-4 py-2 rounded-xl border"
            style={{ background:`${s.color}0d`, borderColor:`${s.color}30` }}>
            <span className="text-xl font-black tabular-nums" style={{ color:s.color }}>{s.value}</span>
            <span className="text-xs text-text-muted">{s.label}</span>
          </div>
        ))}
      </motion.div>
    </div>
  )
}

/* ── Background layers per variant ──────────────────────────────── */
function HeroBg({ variant }: { variant: string }) {
  const isTerminal = variant === 'terminal'
  return (
    <>
      <div className="absolute inset-0 grid-bg opacity-100 pointer-events-none" aria-hidden="true"/>
      {isTerminal
        ? <div className="absolute inset-0 pointer-events-none" style={{ background:'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,255,100,0.008) 2px,rgba(0,255,100,0.008) 4px)' }}/>
        : null
      }
      {variant === 'neon'
        ? <>
            <div className="absolute inset-0 pointer-events-none" style={{ background:'radial-gradient(ellipse 50% 60% at 15% 50%, rgba(6,182,212,0.07) 0%, transparent 70%)' }}/>
            <div className="absolute inset-0 pointer-events-none" style={{ background:'radial-gradient(ellipse 50% 60% at 85% 50%, rgba(99,102,241,0.07) 0%, transparent 70%)' }}/>
          </>
        : <div className="absolute inset-0 pointer-events-none" style={{ background:'radial-gradient(ellipse 60% 55% at 30% 50%, rgba(99,102,241,0.08) 0%, transparent 70%)' }}/>
      }
      {variant === 'gradient'
        ? <div className="absolute inset-0 pointer-events-none" style={{ background:'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(99,102,241,0.1) 0%, rgba(6,182,212,0.05) 40%, transparent 70%)' }}/>
        : null
      }
      <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-background to-transparent pointer-events-none"/>
      <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-background to-transparent pointer-events-none"/>
    </>
  )
}

/* ── Main export ─────────────────────────────────────────────────── */
export function Hero({ locale, dbHero, variant = 'split' }: HeroProps) {
  const isRTL = locale === 'fa'
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '20%'])
  const opacity = useTransform(scrollYProgress, [0, 0.7], [1, 0])

  const c = buildContent(locale, dbHero)

  const VARIANTS: Record<string, React.FC<{ c: HeroContent }>> = {
    split:    VariantSplit,
    minimal:  VariantMinimal,
    glass:    VariantGlass,
    terminal: VariantTerminal,
    bento:    VariantBento,
    luxury:   VariantLuxury,
    neon:     VariantNeon,
    magazine: VariantMagazine,
    centered: VariantCentered,
    gradient: VariantGradient,
  }
  const VariantComponent = VARIANTS[variant] || VariantSplit

  return (
    <section ref={ref}
      className="relative min-h-screen flex items-center overflow-hidden bg-background"
      aria-label={isRTL ? 'بخش اصلی' : 'Hero section'}
      dir={isRTL ? 'rtl' : 'ltr'}>
      <HeroBg variant={variant} />
      <motion.div style={{ y, opacity }} className="relative z-10 w-full">
        <VariantComponent c={c} />
      </motion.div>
      <ScrollIndicator label={isRTL ? 'اسکرول' : 'Scroll'} />
    </section>
  )
}
