'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { useState } from 'react'
import { blurReveal, staggerFast, springUp } from '@/lib/motion'
import { TechStackGrid } from '@/components/case-studies/TechStackGrid'
import { BusinessImpactStats } from '@/components/case-studies/BusinessImpactStats'
import { ImplementationTimeline } from '@/components/case-studies/ImplementationTimeline'
import { BeforeAfterComparison } from '@/components/case-studies/BeforeAfterComparison'
import type { Project } from '@/lib/db/schema'

function parseJson<T>(raw: string | null | undefined): T[] {
  if (!raw) return []
  try { return JSON.parse(raw) as T[] } catch { return [] }
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="mb-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, rgba(99,102,241,0.5), transparent)' }} />
          <h2 className="text-xl md:text-2xl font-bold text-text-primary whitespace-nowrap">{title}</h2>
          <div className="h-px flex-1" style={{ background: 'linear-gradient(270deg, rgba(99,102,241,0.5), transparent)' }} />
        </div>
        {children}
      </motion.div>
    </section>
  )
}

const TOC_ITEMS_EN = [
  { id: 'challenge', label: 'Business Challenge' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'tech-stack', label: 'Technology Stack' },
  { id: 'implementation', label: 'Implementation' },
  { id: 'security', label: 'Security & HA' },
  { id: 'results', label: 'Business Results' },
  { id: 'lessons', label: 'Lessons Learned' },
  { id: 'downloads', label: 'Downloads' },
]

const TOC_ITEMS_FA = [
  { id: 'challenge', label: 'چالش کسب‌وکار' },
  { id: 'architecture', label: 'معماری' },
  { id: 'tech-stack', label: 'استک فناوری' },
  { id: 'implementation', label: 'پیاده‌سازی' },
  { id: 'security', label: 'امنیت و HA' },
  { id: 'results', label: 'نتایج کسب‌وکار' },
  { id: 'lessons', label: 'درس‌های آموخته' },
  { id: 'downloads', label: 'دانلودها' },
]

type ProjectRow = Project

interface Props {
  locale: string
  project: ProjectRow
  relatedProjects: ProjectRow[]
}

export function CaseStudyDetail({ locale, project: p, relatedProjects }: Props) {
  const isRTL = locale === 'fa'
  const [activeSection, setActiveSection] = useState('challenge')
  const tocItems = isRTL ? TOC_ITEMS_FA : TOC_ITEMS_EN

  const name = isRTL ? p.nameFa as string : p.nameEn as string
  const industry = isRTL ? p.industryFa as string : p.industryEn as string
  const client = isRTL ? p.clientFa as string : p.clientEn as string
  const executiveSummary = isRTL ? p.executiveSummaryFa as string : p.executiveSummaryEn as string
  const challenge = isRTL ? p.challengeFa as string : p.challengeEn as string
  const existingInfra = isRTL ? p.existingInfraFa as string : p.existingInfraEn as string
  const proposedArch = isRTL ? p.proposedArchFa as string : p.proposedArchEn as string
  const solution = isRTL ? p.solutionFa as string : p.solutionEn as string
  const security = isRTL ? p.securityConsiderationsFa as string : p.securityConsiderationsEn as string
  const ha = isRTL ? p.haAvailabilityFa as string : p.haAvailabilityEn as string
  const backup = isRTL ? p.backupStrategyFa as string : p.backupStrategyEn as string
  const dr = isRTL ? p.disasterRecoveryFa as string : p.disasterRecoveryFa as string
  const monitoring = isRTL ? p.monitoringStrategyFa as string : p.monitoringStrategyEn as string
  const deployment = isRTL ? p.deploymentProcessFa as string : p.deploymentProcessEn as string
  const lessons = isRTL ? p.lessonsLearnedFa as string : p.lessonsLearnedEn as string
  const future = isRTL ? p.futureImprovementsFa as string : p.futureImprovementsEn as string
  const businessScope = isRTL ? p.businessScopeFa as string : p.businessScopeEn as string
  const color = p.color as string || '#6366f1'
  const technologies: string[] = parseJson(p.tagsEn as string)

  const hasDownloads = p.downloadPdfUrl || p.downloadArchUrl || p.downloadTechSummaryUrl

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Hero */}
      <div className="relative overflow-hidden pt-20 pb-16" style={{ background: '#060610' }}>
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse 70% 60% at 50% 0%, ${color}18, transparent)` }}
        />
        <div className="absolute bottom-0 inset-x-0 accent-divider" />

        <div className="container-site relative z-10 pt-8">
          {/* Breadcrumb */}
          <motion.nav
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-sm text-text-muted mb-8"
          >
            <Link href={`/${locale}`} className="hover:text-text-primary transition-colors">
              {isRTL ? 'خانه' : 'Home'}
            </Link>
            <span>/</span>
            <Link href={`/${locale}/case-studies`} className="hover:text-text-primary transition-colors">
              {isRTL ? 'مطالعات موردی' : 'Case Studies'}
            </Link>
            <span>/</span>
            <span className="text-text-primary truncate max-w-xs">{name}</span>
          </motion.nav>

          {/* Hero Content */}
          <motion.div
            variants={staggerFast}
            initial="hidden"
            animate="visible"
            className="max-w-4xl"
          >
            {/* Meta pills */}
            <motion.div variants={blurReveal} className="flex flex-wrap gap-2 mb-6">
              {industry && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold"
                  style={{ background: `${color}18`, border: `1px solid ${color}30`, color }}>
                  {industry}
                </span>
              )}
              {p.year && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold text-text-muted"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {p.year as string}
                </span>
              )}
              {p.duration && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold text-text-muted"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {p.duration as string}
                </span>
              )}
              {p.projectStatus && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold"
                  style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }}>
                  {p.projectStatus as string === 'completed' ? (isRTL ? 'تکمیل شده' : 'Completed') :
                   p.projectStatus as string === 'ongoing' ? (isRTL ? 'در حال اجرا' : 'Ongoing') : p.projectStatus as string}
                </span>
              )}
              {p.isConfidential && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                  {isRTL ? 'محرمانه' : 'Confidential'}
                </span>
              )}
            </motion.div>

            <motion.h1 variants={blurReveal} className="text-3xl md:text-5xl font-black text-text-primary mb-4 leading-tight" style={{ letterSpacing: '-0.02em' }}>
              {name}
            </motion.h1>

            {client && !p.isConfidential && (
              <motion.p variants={blurReveal} className="text-lg text-text-secondary mb-4">
                {isRTL ? 'مشتری: ' : 'Client: '}<span className="text-text-primary font-semibold">{client}</span>
              </motion.p>
            )}

            {executiveSummary && (
              <motion.p variants={blurReveal} className="text-lg text-text-secondary leading-relaxed max-w-3xl">
                {executiveSummary}
              </motion.p>
            )}

            {businessScope && (
              <motion.p variants={blurReveal} className="text-sm text-text-muted mt-3 max-w-2xl">
                {businessScope}
              </motion.p>
            )}
          </motion.div>
        </div>
      </div>

      {/* Body */}
      <div className="container-site py-16">
        <div className="flex gap-10 items-start">
          {/* Sticky TOC */}
          <aside className="hidden lg:block w-56 shrink-0 sticky top-28">
            <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-4">
              {isRTL ? 'فهرست مطالب' : 'Contents'}
            </p>
            <nav className="space-y-1">
              {tocItems.map(item => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={() => setActiveSection(item.id)}
                  className="block text-sm py-1.5 px-3 rounded-lg transition-all duration-200"
                  style={{
                    color: activeSection === item.id ? color : 'rgba(148,163,184,0.7)',
                    background: activeSection === item.id ? `${color}12` : 'transparent',
                    borderLeft: !isRTL ? `2px solid ${activeSection === item.id ? color : 'transparent'}` : undefined,
                    borderRight: isRTL ? `2px solid ${activeSection === item.id ? color : 'transparent'}` : undefined,
                  }}
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-16">

            {/* Business Challenge */}
            {challenge && (
              <Section id="challenge" title={isRTL ? 'چالش کسب‌وکار' : 'Business Challenge'}>
                {existingInfra && (
                  <div className="mb-6 p-4 rounded-xl" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                    <p className="text-xs font-bold uppercase tracking-widest text-red-400 mb-2">{isRTL ? 'زیرساخت موجود' : 'Existing Infrastructure'}</p>
                    <p className="text-sm text-text-secondary leading-relaxed">{existingInfra}</p>
                  </div>
                )}
                <p className="text-text-secondary leading-relaxed">{challenge}</p>
              </Section>
            )}

            {/* Architecture */}
            {(proposedArch || solution) && (
              <Section id="architecture" title={isRTL ? 'معماری پیشنهادی' : 'Proposed Architecture'}>
                {proposedArch && (
                  <div className="mb-6 p-4 rounded-xl" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
                    <p className="text-sm text-text-secondary leading-relaxed">{proposedArch}</p>
                  </div>
                )}
                {solution && <p className="text-text-secondary leading-relaxed">{solution}</p>}

                {/* Diagrams */}
                {(p.networkDiagramUrl || p.infraDiagramUrl) && (
                  <div className="mt-6 grid md:grid-cols-2 gap-4">
                    {p.networkDiagramUrl && (
                      <a href={p.networkDiagramUrl as string} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 p-4 rounded-xl transition-all hover:-translate-y-1"
                        style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)', color: '#06b6d4' }}>
                        <span className="text-2xl">🗺️</span>
                        <span className="text-sm font-semibold">{isRTL ? 'دیاگرام شبکه' : 'Network Diagram'}</span>
                      </a>
                    )}
                    {p.infraDiagramUrl && (
                      <a href={p.infraDiagramUrl as string} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 p-4 rounded-xl transition-all hover:-translate-y-1"
                        style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: '#818cf8' }}>
                        <span className="text-2xl">🏗️</span>
                        <span className="text-sm font-semibold">{isRTL ? 'دیاگرام زیرساخت' : 'Infrastructure Diagram'}</span>
                      </a>
                    )}
                  </div>
                )}
              </Section>
            )}

            {/* Technology Stack */}
            <Section id="tech-stack" title={isRTL ? 'استک فناوری' : 'Technology Stack'}>
              <TechStackGrid
                techStackJson={p.techStackJson as string}
                technologies={parseJson<string>(p.tagsEn as string)}
                isRTL={isRTL}
              />
            </Section>

            {/* Implementation */}
            {(p.implementationTimelineJson || deployment) && (
              <Section id="implementation" title={isRTL ? 'فرآیند پیاده‌سازی' : 'Implementation Process'}>
                {deployment && (
                  <div className="mb-8 p-4 rounded-xl" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                    <p className="text-sm text-text-secondary leading-relaxed">{deployment}</p>
                  </div>
                )}
                <ImplementationTimeline
                  implementationTimelineJson={p.implementationTimelineJson as string}
                  isRTL={isRTL}
                />
              </Section>
            )}

            {/* Security & HA */}
            {(security || ha || backup || monitoring) && (
              <Section id="security" title={isRTL ? 'امنیت، دسترس‌پذیری و پایش' : 'Security, HA & Monitoring'}>
                <div className="grid md:grid-cols-2 gap-4">
                  {security && (
                    <div className="p-4 rounded-xl" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                      <p className="text-xs font-bold uppercase tracking-widest text-red-400 mb-2">{isRTL ? 'ملاحظات امنیتی' : 'Security Considerations'}</p>
                      <p className="text-sm text-text-secondary leading-relaxed">{security}</p>
                    </div>
                  )}
                  {ha && (
                    <div className="p-4 rounded-xl" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
                      <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-2">{isRTL ? 'دسترس‌پذیری بالا' : 'High Availability'}</p>
                      <p className="text-sm text-text-secondary leading-relaxed">{ha}</p>
                    </div>
                  )}
                  {backup && (
                    <div className="p-4 rounded-xl" style={{ background: 'rgba(20,184,166,0.06)', border: '1px solid rgba(20,184,166,0.15)' }}>
                      <p className="text-xs font-bold uppercase tracking-widest text-teal-400 mb-2">{isRTL ? 'استراتژی پشتیبان‌گیری' : 'Backup Strategy'}</p>
                      <p className="text-sm text-text-secondary leading-relaxed">{backup}</p>
                    </div>
                  )}
                  {monitoring && (
                    <div className="p-4 rounded-xl" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                      <p className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-2">{isRTL ? 'استراتژی پایش' : 'Monitoring Strategy'}</p>
                      <p className="text-sm text-text-secondary leading-relaxed">{monitoring}</p>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Before / After */}
            {p.beforeAfterJson && (
              <Section id="before-after" title={isRTL ? 'مقایسه قبل و بعد' : 'Before & After'}>
                <BeforeAfterComparison beforeAfterJson={p.beforeAfterJson as string} isRTL={isRTL} />
              </Section>
            )}

            {/* Business Results */}
            <Section id="results" title={isRTL ? 'نتایج کسب‌وکار' : 'Business Results'}>
              <BusinessImpactStats
                businessImpactJson={p.businessImpactJson as string}
                resultsEn={parseJson<string>(p.resultsEn as string)}
                resultsFa={parseJson<string>(p.resultsFa as string)}
                isRTL={isRTL}
              />
            </Section>

            {/* Lessons Learned */}
            {(lessons || future) && (
              <Section id="lessons" title={isRTL ? 'درس‌های آموخته' : 'Lessons Learned'}>
                {lessons && (
                  <div className="mb-6">
                    <p className="text-text-secondary leading-relaxed">{lessons}</p>
                  </div>
                )}
                {future && (
                  <div className="p-4 rounded-xl" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
                    <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-2">{isRTL ? 'بهبودهای آینده' : 'Future Improvements'}</p>
                    <p className="text-sm text-text-secondary leading-relaxed">{future}</p>
                  </div>
                )}
              </Section>
            )}

            {/* Downloads */}
            {hasDownloads && (
              <Section id="downloads" title={isRTL ? 'دانلود اسناد' : 'Download Center'}>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {p.downloadPdfUrl && (
                    <a href={p.downloadPdfUrl as string} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 p-4 rounded-xl transition-all hover:-translate-y-1"
                      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                      <span className="text-2xl">📄</span>
                      <div>
                        <p className="text-sm font-semibold">{isRTL ? 'نسخه PDF' : 'PDF Version'}</p>
                        <p className="text-xs text-text-muted">{isRTL ? 'دانلود' : 'Download'}</p>
                      </div>
                    </a>
                  )}
                  {p.downloadArchUrl && (
                    <a href={p.downloadArchUrl as string} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 p-4 rounded-xl transition-all hover:-translate-y-1"
                      style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)', color: '#06b6d4' }}>
                      <span className="text-2xl">🏗️</span>
                      <div>
                        <p className="text-sm font-semibold">{isRTL ? 'سند معماری' : 'Architecture Doc'}</p>
                        <p className="text-xs text-text-muted">{isRTL ? 'دانلود' : 'Download'}</p>
                      </div>
                    </a>
                  )}
                  {p.downloadTechSummaryUrl && (
                    <a href={p.downloadTechSummaryUrl as string} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 p-4 rounded-xl transition-all hover:-translate-y-1"
                      style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: '#818cf8' }}>
                      <span className="text-2xl">📊</span>
                      <div>
                        <p className="text-sm font-semibold">{isRTL ? 'خلاصه فنی' : 'Technical Summary'}</p>
                        <p className="text-xs text-text-muted">{isRTL ? 'دانلود' : 'Download'}</p>
                      </div>
                    </a>
                  )}
                </div>
              </Section>
            )}

            {/* Related Case Studies */}
            {relatedProjects.length > 0 && (
              <Section id="related" title={isRTL ? 'مطالعات موردی مرتبط' : 'Related Case Studies'}>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {relatedProjects.map((rel) => (
                    <Link
                      key={rel.slug as string}
                      href={`/${locale}/case-studies/${rel.slug as string}`}
                      className="group block p-4 rounded-xl transition-all duration-300 hover:-translate-y-1"
                      style={{ background: 'rgba(10,10,18,0.9)', border: '1px solid rgba(99,102,241,0.12)' }}
                    >
                      <div
                        className="w-8 h-8 rounded-lg mb-3"
                        style={{ background: `${rel.color as string || '#6366f1'}20`, border: `1px solid ${rel.color as string || '#6366f1'}30` }}
                      />
                      <p className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors">
                        {isRTL ? rel.nameFa as string : rel.nameEn as string}
                      </p>
                      <p className="text-xs text-text-muted mt-1">{isRTL ? rel.industryFa as string : rel.industryEn as string}</p>
                    </Link>
                  ))}
                </div>
              </Section>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
