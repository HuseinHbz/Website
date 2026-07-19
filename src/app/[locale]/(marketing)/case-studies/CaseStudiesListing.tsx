'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { blurReveal, staggerFast, springUp } from '@/lib/motion'
import type { Project } from '@/lib/db/schema'

function parseJson<T>(raw: string | null | undefined): T[] {
  if (!raw) return []
  try { return JSON.parse(raw) as T[] } catch { return [] }
}

type ProjectRow = Project

const FILTER_CATEGORIES_EN = ['All', 'Networking', 'Security', 'Virtualization', 'Cloud', 'Monitoring', 'Automation', 'Infrastructure', 'Backup', 'VoIP']
const FILTER_CATEGORIES_FA = ['همه', 'شبکه', 'امنیت', 'مجازی‌سازی', 'ابر', 'پایش', 'خودکارسازی', 'زیرساخت', 'پشتیبان‌گیری', 'VoIP']

interface Props {
  locale: string
  projects: ProjectRow[]
}

function CaseStudyCard({ p, locale, index }: { p: ProjectRow; locale: string; index: number }) {
  const isRTL = locale === 'fa'
  const name = isRTL ? p.nameFa as string : p.nameEn as string
  const industry = isRTL ? p.industryFa as string : p.industryEn as string
  const client = isRTL ? p.clientFa as string : p.clientEn as string
  const summary = isRTL
    ? (p.executiveSummaryFa as string || p.challengeFa as string)
    : (p.executiveSummaryEn as string || p.challengeEn as string)
  const color = p.color as string || '#6366f1'
  const tags: string[] = parseJson(isRTL ? p.tagsFa as string : p.tagsEn as string)
  const results: string[] = parseJson(isRTL ? p.resultsFa as string : p.resultsEn as string)

  return (
    <motion.article
      variants={springUp}
      layout
      className="group relative overflow-hidden rounded-2xl transition-all duration-300"
      style={{ background: 'rgba(10,10,18,0.9)', border: '1px solid rgba(255,255,255,0.06)' }}
      whileHover={{ y: -4, borderColor: `${color}30` }}
    >
      {/* Top accent bar */}
      <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${color}, ${color}80, transparent)` }} />

      {/* Cover / color block */}
      {p.coverImage ? (
        <div className="h-48 overflow-hidden">
          <img
            src={p.coverImage as string}
            alt={name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
      ) : (
        <div className="h-36 flex items-center justify-center relative overflow-hidden"
          style={{ background: `${color}08` }}>
          <div className="text-5xl opacity-20 font-black tracking-tighter" style={{ color }}>
            {name.split(' ').map(w => w[0]).join('').slice(0, 3)}
          </div>
          <div className="absolute inset-0" style={{
            background: `radial-gradient(ellipse 80% 80% at 50% 100%, ${color}18, transparent)`
          }} />
        </div>
      )}

      <div className="p-6">
        {/* Meta row */}
        <div className="flex items-center gap-2 mb-3">
          {industry && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}>
              {industry}
            </span>
          )}
          {p.year && (
            <span className="text-xs text-text-muted">{p.year as string}</span>
          )}
          {p.isConfidential && (
            <span className="text-xs px-2 py-0.5 rounded-full ml-auto"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
              {isRTL ? 'محرمانه' : 'Confidential'}
            </span>
          )}
        </div>

        <h3 className="text-lg font-bold text-text-primary mb-2 leading-tight group-hover:text-accent transition-colors">
          {name}
        </h3>

        {!p.isConfidential && client && (
          <p className="text-sm text-text-muted mb-3">{client}</p>
        )}

        {summary && (
          <p className="text-sm text-text-secondary leading-relaxed mb-4 line-clamp-3">{summary}</p>
        )}

        {/* Key results */}
        {results.slice(0, 2).map((r, i) => (
          <div key={i} className="flex items-start gap-2 mb-1">
            <span className="text-emerald-400 text-xs mt-0.5 shrink-0">✓</span>
            <p className="text-xs text-text-muted leading-relaxed">{r}</p>
          </div>
        ))}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4 mb-5">
            {tags.slice(0, 4).map(tag => (
              <span key={tag} className="text-xs px-2 py-0.5 rounded-md text-text-muted"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                {tag}
              </span>
            ))}
          </div>
        )}

        <Link
          href={`/${locale}/case-studies/${p.slug as string}`}
          className="inline-flex items-center gap-2 text-sm font-semibold transition-all duration-200 group/link"
          style={{ color }}
        >
          {isRTL ? 'مشاهده مطالعه موردی' : 'View Case Study'}
          <span className="transition-transform duration-200 group-hover/link:translate-x-1">{isRTL ? '←' : '→'}</span>
        </Link>
      </div>
    </motion.article>
  )
}

export function CaseStudiesListing({ locale, projects }: Props) {
  const isRTL = locale === 'fa'
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('All')
  const [activeIndustry, setActiveIndustry] = useState('All')

  const categories = isRTL ? FILTER_CATEGORIES_FA : FILTER_CATEGORIES_EN
  const allLabel = isRTL ? 'همه' : 'All'

  // Collect unique industries
  const industries = useMemo(() => {
    const set = new Set<string>()
    projects.forEach(p => {
      const ind = isRTL ? p.industryFa as string : p.industryEn as string
      if (ind) set.add(ind)
    })
    return [allLabel, ...Array.from(set)]
  }, [projects, isRTL, allLabel])

  const filtered = useMemo(() => {
    return projects.filter(p => {
      const name = isRTL ? p.nameFa as string : p.nameEn as string
      const industry = isRTL ? p.industryFa as string : p.industryEn as string
      const client = isRTL ? p.clientFa as string : p.clientEn as string
      const tags: string[] = parseJson(isRTL ? p.tagsFa as string : p.tagsEn as string)
      const technologyFilters: string[] = parseJson(p.technologyFilters as string)

      // search
      if (search) {
        const q = search.toLowerCase()
        const haystack = [name, industry, client, ...tags].join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }

      // technology filter
      if (activeFilter !== allLabel && activeFilter !== 'All') {
        const techHaystack = [...tags, ...technologyFilters,
          isRTL ? p.industryFa as string : p.industryEn as string].join(' ').toLowerCase()
        if (!techHaystack.toLowerCase().includes(activeFilter.toLowerCase())) return false
      }

      // industry filter
      if (activeIndustry !== allLabel) {
        if (industry !== activeIndustry) return false
      }

      return true
    })
  }, [projects, search, activeFilter, activeIndustry, isRTL, allLabel])

  const stats = {
    total: projects.length,
    featured: projects.filter(p => p.featured).length,
    industries: new Set(projects.map(p => isRTL ? p.industryFa : p.industryEn)).size,
  }

  return (
    <section className="section-padding relative overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="absolute inset-0" style={{ background: '#07070d' }} />
      <div className="absolute inset-0 grid-bg opacity-50" />
      <div className="absolute top-0 inset-x-0 accent-divider" />

      <div className="container-site relative z-10">
        {/* Header */}
        <motion.div
          variants={staggerFast}
          initial="hidden"
          animate="visible"
          className="text-center mb-16"
        >
          <motion.p variants={blurReveal} className="section-label mb-4 justify-center">
            {isRTL ? 'مطالعات موردی سازمانی' : 'Enterprise Case Studies'}
          </motion.p>
          <motion.h1 variants={blurReveal} className="section-title mb-4">
            {isRTL ? 'تحولات واقعی. ' : 'Real Transformations. '}
            <span className="gradient-text">{isRTL ? 'نتایج قابل اندازه‌گیری.' : 'Measurable Results.'}</span>
          </motion.h1>
          <motion.p variants={blurReveal} className="section-subtitle max-w-2xl mx-auto">
            {isRTL
              ? 'هر مطالعه موردی یک تحول واقعی زیرساخت سازمانی را از چالش تا راه‌حل و اثرات کسب‌وکار روایت می‌کند.'
              : 'Each case study documents a real enterprise infrastructure transformation — from challenge through architecture to measured business impact.'}
          </motion.p>

          {/* Stats */}
          <motion.div variants={blurReveal} className="flex items-center justify-center gap-8 mt-8">
            {[
              { value: stats.total, label: isRTL ? 'پروژه' : 'Projects' },
              { value: stats.industries, label: isRTL ? 'صنعت' : 'Industries' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="text-2xl font-black text-accent">{s.value}+</div>
                <div className="text-xs text-text-muted">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="max-w-lg mx-auto mb-8"
        >
          <div className="relative">
            <span className="absolute top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" style={{ [isRTL ? 'right' : 'left']: '14px' }}>
              🔍
            </span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={isRTL ? 'جستجو در نام، فناوری، صنعت...' : 'Search by name, technology, industry...'}
              className="w-full py-3 rounded-xl text-sm text-text-primary placeholder-text-muted outline-none transition-all duration-200"
              style={{
                background: 'rgba(10,10,18,0.9)',
                border: '1px solid rgba(99,102,241,0.2)',
                padding: isRTL ? '12px 40px 12px 16px' : '12px 16px 12px 40px',
              }}
            />
          </div>
        </motion.div>

        {/* Tech filter pills */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="flex flex-wrap justify-center gap-2 mb-4"
        >
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveFilter(cat)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
              style={{
                background: (activeFilter === cat || (cat === allLabel && activeFilter === 'All'))
                  ? 'rgba(99,102,241,1)' : 'rgba(99,102,241,0.08)',
                color: (activeFilter === cat || (cat === allLabel && activeFilter === 'All'))
                  ? '#fff' : '#94a3b8',
                border: '1px solid rgba(99,102,241,0.2)',
              }}
            >
              {cat}
            </button>
          ))}
        </motion.div>

        {/* Industry filter */}
        {industries.length > 2 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-wrap justify-center gap-2 mb-10"
          >
            {industries.map((ind) => (
              <button
                key={ind}
                onClick={() => setActiveIndustry(ind)}
                className="px-3 py-1 rounded-lg text-xs transition-all duration-200"
                style={{
                  background: activeIndustry === ind ? 'rgba(6,182,212,0.15)' : 'transparent',
                  color: activeIndustry === ind ? '#06b6d4' : '#64748b',
                  border: `1px solid ${activeIndustry === ind ? 'rgba(6,182,212,0.35)' : 'rgba(255,255,255,0.06)'}`,
                }}
              >
                {ind}
              </button>
            ))}
          </motion.div>
        )}

        {/* Results count */}
        <div className="text-sm text-text-muted mb-6 text-center">
          {isRTL
            ? `${filtered.length} مطالعه موردی`
            : `${filtered.length} case stud${filtered.length === 1 ? 'y' : 'ies'}`}
        </div>

        {/* Grid */}
        <AnimatePresence mode="popLayout">
          <motion.div
            layout
            variants={staggerFast}
            initial="hidden"
            animate="visible"
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filtered.map((p, i) => (
              <CaseStudyCard key={p.slug as string} p={p} locale={locale} index={i} />
            ))}
          </motion.div>
        </AnimatePresence>

        {filtered.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-24 text-text-muted"
          >
            <div className="text-4xl mb-4">🔍</div>
            <p className="text-lg">{isRTL ? 'نتیجه‌ای یافت نشد.' : 'No case studies found.'}</p>
            <button
              onClick={() => { setSearch(''); setActiveFilter('All'); setActiveIndustry(allLabel) }}
              className="mt-4 text-sm text-accent hover:underline"
            >
              {isRTL ? 'پاک کردن فیلترها' : 'Clear filters'}
            </button>
          </motion.div>
        )}
      </div>
    </section>
  )
}
