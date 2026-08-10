'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { blurReveal, staggerFast, springUp } from '@/lib/motion'

interface DbProject {
  id: number; slug: string; nameEn: string; nameFa: string; industryEn: string | null; industryFa: string | null
  clientEn: string | null; clientFa: string | null; challengeEn: string | null; challengeFa: string | null
  solutionEn: string | null; solutionFa: string | null; resultsEn: string | null; resultsFa: string | null
  tagsEn: string | null; tagsFa: string | null; coverImage: string | null; gallery: string | null
  color: string | null; year: string | null; featured: boolean
  executiveSummaryEn?: string | null; executiveSummaryFa?: string | null
  projectStatus?: string | null; isConfidential?: boolean | null
}

interface ProjectsSectionProps {
  locale?: string
  dbProjects?: DbProject[] | null
}

function parseJsonArray(v: string | null | undefined): string[] {
  if (!v) return []
  try { const p = JSON.parse(v); return Array.isArray(p) ? p : [] } catch { return [] }
}

const FALLBACK_PROJECTS: DbProject[] = [
  {
    id: 1, slug: 'kenzo-restaurant', nameEn: 'Kenzo Restaurant Group', nameFa: 'گروه رستوران کنزو',
    industryEn: 'Hospitality', industryFa: 'هتلداری',
    clientEn: 'Kenzo Group', clientFa: 'گروه کنزو',
    challengeEn: 'Multi-branch restaurant chain with outdated network causing POS outages and poor WiFi coverage across 5 locations.',
    challengeFa: 'زنجیره رستوران با زیرساخت قدیمی که باعث قطعی POS و پوشش ضعیف WiFi در ۵ شعبه می‌شد.',
    solutionEn: null, solutionFa: null,
    resultsEn: JSON.stringify(['99.9% uptime across all branches', 'Zero POS outages post-deployment', '60% reduction in IT tickets']),
    resultsFa: JSON.stringify(['آپتایم ۹۹.۹٪ در تمام شعب', 'صفر قطعی POS پس از استقرار', 'کاهش ۶۰٪ تیکت‌های IT']),
    tagsEn: JSON.stringify(['MikroTik', 'Zabbix', 'VPN', 'VLAN', 'WiFi']),
    tagsFa: JSON.stringify(['MikroTik', 'Zabbix', 'VPN', 'VLAN', 'WiFi']),
    coverImage: null, gallery: null, color: '#f59e0b', year: '2023', featured: true,
  },
  {
    id: 2, slug: 'popcorn-holding', nameEn: 'Popcorn Holding Co.', nameFa: 'هلدینگ پاپ‌کورن',
    industryEn: 'Holding Company', industryFa: 'هلدینگ',
    clientEn: 'Popcorn Holding', clientFa: 'هلدینگ پاپ‌کورن',
    challengeEn: 'Holding company managing 8 subsidiaries with isolated IT, no centralized security, and zero disaster recovery.',
    challengeFa: 'هلدینگ با ۸ زیرمجموعه دارای سیستم‌های مجزا، فاقد سیاست امنیتی متمرکز و DR.',
    solutionEn: null, solutionFa: null,
    resultsEn: JSON.stringify(['Unified identity across 8 subsidiaries', 'RTO from days → 4 hours', '80% reduction in security incidents']),
    resultsFa: JSON.stringify(['هویت یکپارچه در ۸ زیرمجموعه', 'RTO از چند روز به ۴ ساعت', 'کاهش ۸۰٪ حوادث امنیتی']),
    tagsEn: JSON.stringify(['Fortigate', 'VMware', 'Active Directory', 'Veeam', 'Cisco']),
    tagsFa: JSON.stringify(['Fortigate', 'VMware', 'Active Directory', 'Veeam', 'Cisco']),
    coverImage: null, gallery: null, color: '#10b981', year: '2024', featured: true,
  },
  {
    id: 3, slug: 'senso-restaurant', nameEn: 'Senso Restaurant Group', nameFa: 'گروه رستوران سنسو',
    industryEn: 'Food & Beverage', industryFa: 'غذا و نوشیدنی',
    clientEn: 'Senso Group', clientFa: 'گروه سنسو',
    challengeEn: 'Upscale restaurant requiring premium guest WiFi, CCTV integration, VoIP for reservations, and data privacy compliance.',
    challengeFa: 'رستوران لوکس نیازمند WiFi ممتاز، دوربین مداربسته، VoIP رزروگیری و رعایت حریم خصوصی.',
    solutionEn: null, solutionFa: null,
    resultsEn: JSON.stringify(['Guest WiFi score 4.8/5', '200+ daily VoIP calls', '30-day CCTV retention']),
    resultsFa: JSON.stringify(['امتیاز WiFi مهمان ۴.۸/۵', 'بیش از ۲۰۰ تماس VoIP روزانه', 'نگهداری CCTV ۳۰ روزه']),
    tagsEn: JSON.stringify(['Ubiquiti', 'Sophos', 'Asterisk', 'CCTV', 'TrueNAS']),
    tagsFa: JSON.stringify(['Ubiquiti', 'Sophos', 'Asterisk', 'CCTV', 'TrueNAS']),
    coverImage: null, gallery: null, color: '#9698ff', year: '2024', featured: false,
  },
  {
    id: 4, slug: 'industrial-enterprise', nameEn: 'Industrial Enterprise', nameFa: 'مجتمع صنعتی',
    industryEn: 'Industrial', industryFa: 'صنعتی',
    clientEn: 'Confidential Client', clientFa: 'مشتری محرمانه',
    challengeEn: 'Industrial facility requiring OT/IT convergence, 24/7 monitoring of production equipment, and sub-second failover.',
    challengeFa: 'مجتمع صنعتی نیازمند همگرایی OT/IT، پایش ۲۴/۷ تجهیزات تولیدی و Failover زیر یک ثانیه.',
    solutionEn: null, solutionFa: null,
    resultsEn: JSON.stringify(['Zero production downtime during migration', 'Sub-second network failover', '40% fewer network-related stoppages']),
    resultsFa: JSON.stringify(['صفر توقف تولید در حین مهاجرت', 'Failover زیر یک ثانیه', 'کاهش ۴۰٪ توقف‌های شبکه‌ای']),
    tagsEn: JSON.stringify(['Cisco', 'Grafana', 'SCADA', 'Industrial Switches', 'Prometheus']),
    tagsFa: JSON.stringify(['Cisco', 'Grafana', 'SCADA', 'سوئیچ صنعتی', 'Prometheus']),
    coverImage: null, gallery: null, color: '#22d3ee', year: '2023', featured: false,
    isConfidential: true,
  },
]

export function ProjectsSection({ locale = 'en', dbProjects }: ProjectsSectionProps) {
  const isRTL = locale === 'fa'
  // 26.29 BUG-114: null = never configured → demo; [] = all deactivated → show nothing
  const projects = dbProjects !== null && dbProjects !== undefined ? dbProjects : FALLBACK_PROJECTS
  const featured = projects.filter(p => p.featured)
  const rest = projects.filter(p => !p.featured)
  const display = [...featured, ...rest].slice(0, 4)

  return (
    <section className="section-padding relative overflow-hidden" id="case-studies">
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #07070d 0%, #0a0a14 50%, #07070d 100%)' }} />
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div className="absolute top-0 inset-x-0 accent-divider" />

      <div className="container-site relative z-10" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Header */}
        <motion.div
          variants={staggerFast}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <motion.p variants={blurReveal} className="section-label mb-4 justify-center">
            {isRTL ? 'مطالعات موردی سازمانی' : 'Enterprise Case Studies'}
          </motion.p>
          <motion.h2 variants={blurReveal} className="section-title mb-4">
            {isRTL ? 'تحولات واقعی. ' : 'Real Transformations. '}
            <span className="gradient-text">{isRTL ? 'نتایج قابل اندازه‌گیری.' : 'Measurable Results.'}</span>
          </motion.h2>
          <motion.p variants={blurReveal} className="section-subtitle max-w-2xl mx-auto">
            {isRTL
              ? 'هر پروژه نقطه‌ای از تحول کسب‌وکار است — با معماری مستند، اثرات واقعی و درس‌های آموخته.'
              : 'Every engagement is a documented business transformation — with full architecture, measured outcomes, and lessons learned.'}
          </motion.p>
        </motion.div>

        {/* Projects grid */}
        <motion.div
          variants={staggerFast}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="case-bento-grid grid md:grid-cols-2 lg:grid-cols-3 lg:grid-rows-2 gap-5 mb-12"
        >
          {display.map((p, index) => {
            const name = isRTL ? p.nameFa : p.nameEn
            const industry = isRTL ? p.industryFa : p.industryEn
            const client = (isRTL ? p.clientFa : p.clientEn) || ''
            const summary = isRTL
              ? (p.executiveSummaryFa || p.challengeFa || '')
              : (p.executiveSummaryEn || p.challengeEn || '')
            const tags = parseJsonArray(p.tagsEn)
            const results = parseJsonArray(isRTL ? p.resultsFa : p.resultsEn)
            const color = p.color || '#7477ff'

            return (
              <motion.article
                key={p.slug}
                variants={springUp}
                className={`case-bento-card case-bento-card-${index} group relative overflow-hidden rounded-2xl transition-all duration-300 ${index < 2 ? 'lg:row-span-2' : ''}`}
                style={{ background: 'rgba(10,10,18,0.9)', border: '1px solid rgba(255,255,255,0.06)' }}
                whileHover={{ y: -4 }}
              >
                {/* Accent bar */}
                <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${color}, ${color}60, transparent)` }} />

                {/* Visual header */}
                <div className="h-32 relative overflow-hidden flex items-center justify-center" style={{ background: `${color}08` }}>
                  {p.coverImage ? (
                    <img src={p.coverImage} alt={name} className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <div className="text-4xl font-black opacity-15 tracking-tighter" style={{ color }}>
                        {name.split(' ').map((w: string) => w[0]).join('').slice(0, 3)}
                      </div>
                      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 80% 80% at 50% 100%, ${color}20, transparent)` }} />
                    </>
                  )}
                  {p.isConfidential && (
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs"
                      style={{ background: 'rgba(0,0,0,0.6)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
                      {isRTL ? 'محرمانه' : 'Confidential'}
                    </div>
                  )}
                </div>

                <div className="p-5">
                  {/* Meta */}
                  <div className="flex items-center gap-2 mb-3">
                    {industry && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}>
                        {industry}
                      </span>
                    )}
                    {p.year && <span className="text-xs text-text-muted ml-auto">{p.year}</span>}
                  </div>

                  <h3 className="font-bold text-text-primary mb-2 leading-tight group-hover:text-accent transition-colors">
                    {name}
                  </h3>

                  {!p.isConfidential && client && (
                    <p className="text-xs text-text-muted mb-3">{client}</p>
                  )}

                  {summary && (
                    <p className="text-sm text-text-secondary leading-relaxed mb-3 line-clamp-2">{summary}</p>
                  )}

                  {/* Top result */}
                  {results[0] && (
                    <div className="flex items-start gap-1.5 mb-4">
                      <span className="text-emerald-400 text-xs mt-0.5 shrink-0">✓</span>
                      <p className="text-xs text-text-muted">{results[0]}</p>
                    </div>
                  )}

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1 mb-4">
                    {tags.slice(0, 3).map(t => (
                      <span key={t} className="text-xs px-1.5 py-0.5 rounded text-text-muted"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        {t}
                      </span>
                    ))}
                  </div>

                  <Link
                    href={`/${locale}/case-studies/${p.slug}`}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold transition-all"
                    style={{ color }}
                  >
                    {isRTL ? 'مشاهده مطالعه موردی' : 'View Case Study'}
                    <span className="transition-transform group-hover:translate-x-1">{isRTL ? '←' : '→'}</span>
                  </Link>
                </div>
              </motion.article>
            )
          })}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="text-center"
        >
          <Link
            href={`/${locale}/case-studies`}
            className="btn-enterprise"
          >
            {isRTL ? 'مشاهده همه مطالعات موردی' : 'View All Case Studies'}
            <span>{isRTL ? '←' : '→'}</span>
          </Link>
          <p className="text-sm text-text-muted mt-4">
            {isRTL
              ? `${projects.length}+ مطالعه موردی سازمانی مستند`
              : `${projects.length}+ documented enterprise case studies`}
          </p>
        </motion.div>
      </div>
    </section>
  )
}
