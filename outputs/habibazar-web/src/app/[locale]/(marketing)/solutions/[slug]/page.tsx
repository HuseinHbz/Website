import { getDb } from '@/lib/db'
import { solutions, projects, testimonials } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { SITE } from '@/lib/site'
import Link from 'next/link'
import type { Metadata } from 'next'

interface Props { params: Promise<{ locale: string; slug: string }> }

export async function generateStaticParams() {
  try {
    const db = getDb()
    const rows = db.select({ slug: solutions.slug }).from(solutions).all()
    const locales = ['en', 'fa']
    return locales.flatMap(locale => rows.map(r => ({ locale, slug: r.slug })))
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  const db = getDb()
  const solution = db.select().from(solutions).where(eq(solutions.slug, slug)).get()
  if (!solution) return {}
  const fa = locale === 'fa'
  const title = fa ? (solution.nameFa || solution.nameEn) : solution.nameEn
  const description = fa ? (solution.taglineFa || solution.taglineEn || '') : (solution.taglineEn || '')
  return {
    title: `${title} | HBZ Technology`,
    description,
    keywords: solution.seoKeywords || undefined,
    openGraph: {
      title: solution.seoTitle || title,
      description: solution.seoDescription || description,
      url: `${SITE.url}/${locale}/solutions/${slug}`,
      images: solution.ogImage ? [solution.ogImage] : undefined,
    },
  }
}

type Challenge = { icon: string; title: string; titleFa?: string; description: string; descriptionFa?: string }
type Step = { step: number; title: string; titleFa?: string; description: string; descriptionFa?: string }
type Benefit = { icon: string; metric: string; label: string; labelFa?: string; description: string; descriptionFa?: string }
type TechItem = { name: string; icon: string; category: string }
type RoadmapPhase = { phase: number; title: string; titleFa?: string; duration: string; items: string[] }
type FaqItem = { q: string; qFa?: string; a: string; aFa?: string }
type Metric = { value: string; label: string; labelFa?: string }

function safeJson<T>(v: string | null | undefined, fallback: T): T {
  try { return v ? JSON.parse(v) : fallback } catch { return fallback }
}

export default async function SolutionPage({ params }: Props) {
  const { locale, slug } = await params
  const fa = locale === 'fa'
  const db = getDb()
  const solution = db.select().from(solutions).where(eq(solutions.slug, slug)).get()
  if (!solution) notFound()

  const challenges = safeJson<Challenge[]>(solution.challengesJson, [])
  const approach = safeJson<Step[]>(solution.approachJson, [])
  const benefits = safeJson<Benefit[]>(solution.benefitsJson, [])
  const techStack = safeJson<TechItem[]>(solution.techStackJson, [])
  const roadmap = safeJson<RoadmapPhase[]>(solution.roadmapJson, [])
  const faq = safeJson<FaqItem[]>(solution.faqJson, [])
  const metrics = safeJson<Metric[]>(solution.metricsJson, [])

  // Related case studies
  const slugs = (solution.relatedCaseStudySlugs || '').split(',').map(s => s.trim()).filter(Boolean)
  const relatedProjects = slugs.length
    ? db.select({ slug: projects.slug, nameEn: projects.nameEn, nameFa: projects.nameFa, industryEn: projects.industryEn })
        .from(projects).all().filter(p => slugs.includes(p.slug))
    : []

  // Testimonials for this solution
  const solutionTestimonials = db.select().from(testimonials)
    .where(eq(testimonials.solutionSlug, slug)).all()
    .filter(t => t.active)

  const name = fa ? (solution.nameFa || solution.nameEn) : solution.nameEn
  const tagline = fa ? (solution.taglineFa || solution.taglineEn || '') : (solution.taglineEn || '')
  const description = fa ? (solution.descriptionFa || solution.descriptionEn || '') : (solution.descriptionEn || '')
  const color = solution.color || '#6366f1'

  return (
    <div className="min-h-screen bg-background" dir={fa ? 'rtl' : 'ltr'}>
      {/* Hero */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${color}15 0%, transparent 60%)` }} />
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl opacity-10"
          style={{ background: color }} />
        <div className="relative max-w-6xl mx-auto px-6">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-slate-500 mb-8">
            <Link href={`/${locale}/solutions`} className="hover:text-slate-300 transition-colors">
              {fa ? 'راهکارها' : 'Solutions'}
            </Link>
            <span>/</span>
            <span className="text-slate-400">{name}</span>
          </nav>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-6"
                style={{ background: `${color}20`, border: `1px solid ${color}40` }}>
                {solution.icon}
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">{name}</h1>
              <p className="text-xl text-slate-300 mb-6 font-medium">{tagline}</p>
              {description && <p className="text-slate-400 leading-relaxed mb-8">{description}</p>}
              <div className="flex flex-wrap gap-3">
                <Link href={`/${locale}/consultation`}
                  className="px-8 py-3.5 rounded-xl font-semibold text-white transition-colors"
                  style={{ background: color }}>
                  {fa ? 'مشاوره رایگان' : 'Free Consultation'}
                </Link>
                <Link href={`/${locale}/case-studies`}
                  className="px-8 py-3.5 rounded-xl font-semibold text-slate-300 hover:text-white transition-colors"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {fa ? 'مطالعات موردی' : 'Case Studies'}
                </Link>
              </div>
            </div>

            {/* Metrics */}
            {metrics.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                {metrics.map((m, i) => (
                  <div key={i} className="rounded-xl p-5 text-center"
                    style={{ background: `${color}10`, border: `1px solid ${color}20` }}>
                    <div className="text-3xl font-black text-white mb-1">{m.value}</div>
                    <div className="text-sm text-slate-400">{fa ? (m.labelFa || m.label) : m.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Business Challenges */}
      {challenges.length > 0 && (
        <section className="py-20 border-t border-slate-800/50">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-white mb-3">
                {fa ? 'چالش‌های کسب‌وکار' : 'Business Challenges'}
              </h2>
              <p className="text-slate-400">
                {fa ? 'مشکلاتی که این راهکار حل می‌کند' : 'Problems this solution addresses'}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {challenges.map((c, i) => (
                <div key={i} className="rounded-xl p-6"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="text-2xl mb-3">{c.icon}</div>
                  <h3 className="font-bold text-white mb-2">{fa ? (c.titleFa || c.title) : c.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{fa ? (c.descriptionFa || c.description) : c.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Our Approach */}
      {approach.length > 0 && (
        <section className="py-20 border-t border-slate-800/50">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-white mb-3">{fa ? 'رویکرد ما' : 'Our Approach'}</h2>
              <p className="text-slate-400">{fa ? 'چگونه این راهکار را پیاده‌سازی می‌کنیم' : 'How we implement this solution'}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {approach.map((step, i) => (
                <div key={i} className="flex gap-4 rounded-xl p-6"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0 text-white"
                    style={{ background: color }}>
                    {step.step}
                  </div>
                  <div>
                    <h3 className="font-bold text-white mb-1">{fa ? (step.titleFa || step.title) : step.title}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">{fa ? (step.descriptionFa || step.description) : step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Technology Stack */}
      {techStack.length > 0 && (
        <section className="py-20 border-t border-slate-800/50">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-white mb-3">{fa ? 'پشته فناوری' : 'Technology Stack'}</h2>
              <p className="text-slate-400">{fa ? 'فناوری‌های که استفاده می‌کنیم' : 'Technologies we leverage'}</p>
            </div>
            <div className="flex flex-wrap gap-3 justify-center">
              {techStack.map((t, i) => (
                <div key={i} className="flex items-center gap-2 px-4 py-2 rounded-full text-sm"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1' }}>
                  <span>{t.icon}</span>
                  <span>{t.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Business Benefits */}
      {benefits.length > 0 && (
        <section className="py-20 border-t border-slate-800/50">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-white mb-3">{fa ? 'مزایای کسب‌وکاری' : 'Business Benefits'}</h2>
              <p className="text-slate-400">{fa ? 'نتایج قابل اندازه‌گیری برای سازمان شما' : 'Measurable outcomes for your organization'}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {benefits.map((b, i) => (
                <div key={i} className="rounded-2xl p-6 text-center"
                  style={{ background: `${color}08`, border: `1px solid ${color}20` }}>
                  <div className="text-3xl mb-3">{b.icon}</div>
                  <div className="text-3xl font-black mb-2" style={{ color }}>{b.metric}</div>
                  <div className="font-semibold text-white mb-2">{fa ? (b.labelFa || b.label) : b.label}</div>
                  <p className="text-sm text-slate-500">{fa ? (b.descriptionFa || b.description) : b.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Implementation Roadmap */}
      {roadmap.length > 0 && (
        <section className="py-20 border-t border-slate-800/50">
          <div className="max-w-4xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-white mb-3">{fa ? 'نقشه راه پیاده‌سازی' : 'Implementation Roadmap'}</h2>
            </div>
            <div className="space-y-4">
              {roadmap.map((phase, i) => (
                <div key={i} className="flex gap-4 rounded-xl p-6"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: `${color}40`, border: `1px solid ${color}` }}>
                      P{phase.phase}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-white">{fa ? (phase.titleFa || phase.title) : phase.title}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full text-slate-400"
                        style={{ background: 'rgba(255,255,255,0.05)' }}>
                        {phase.duration}
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {phase.items.map((item, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm text-slate-400">
                          <span className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0" style={{ background: color }} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Related Case Studies */}
      {relatedProjects.length > 0 && (
        <section className="py-20 border-t border-slate-800/50">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-white mb-3">{fa ? 'مطالعات موردی مرتبط' : 'Related Case Studies'}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {relatedProjects.map(p => (
                <Link key={p.slug} href={`/${locale}/case-studies/${p.slug}`}
                  className="rounded-xl p-5 hover:bg-white/5 transition-colors"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="text-xs text-slate-500 mb-2">{p.industryEn}</div>
                  <div className="font-semibold text-white">{fa ? (p.nameFa || p.nameEn) : p.nameEn}</div>
                  <div className="text-xs text-indigo-400 mt-2">{fa ? 'مشاهده جزئیات ←' : 'View details →'}</div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Testimonials */}
      {solutionTestimonials.length > 0 && (
        <section className="py-20 border-t border-slate-800/50">
          <div className="max-w-4xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-white mb-3">{fa ? 'نظرات مشتریان' : 'Client Success Stories'}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {solutionTestimonials.map(t => (
                <div key={t.id} className="rounded-2xl p-6"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex mb-3">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <span key={i} className="text-yellow-400">★</span>
                    ))}
                  </div>
                  <p className="text-slate-300 italic mb-4">&quot;{fa ? (t.quoteFa || t.quoteEn) : t.quoteEn}&quot;</p>
                  <div>
                    <div className="font-semibold text-white text-sm">{t.clientName}</div>
                    <div className="text-xs text-slate-500">{t.clientTitle} · {t.clientCompany}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {faq.length > 0 && (
        <section className="py-20 border-t border-slate-800/50">
          <div className="max-w-3xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-white mb-3">{fa ? 'سوالات متداول' : 'Frequently Asked Questions'}</h2>
            </div>
            <div className="space-y-4">
              {faq.map((item, i) => (
                <details key={i} className="group rounded-xl overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <summary className="flex items-center justify-between p-5 cursor-pointer list-none">
                    <span className="font-medium text-white">{fa ? (item.qFa || item.q) : item.q}</span>
                    <span className="text-slate-500 text-sm ml-4 shrink-0">+</span>
                  </summary>
                  <div className="px-5 pb-5 text-slate-400 text-sm leading-relaxed">
                    {fa ? (item.aFa || item.a) : item.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-24 border-t border-slate-800/50">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="text-5xl mb-6">{solution.icon}</div>
          <h2 className="text-3xl font-bold text-white mb-4">
            {fa ? `آماده پیاده‌سازی ${name}؟` : `Ready to implement ${name}?`}
          </h2>
          <p className="text-slate-400 mb-8">
            {fa ? 'با تیم ما صحبت کنید تا راهکار مناسب برای سازمان شما طراحی کنیم.' : "Talk to our team to design the right solution for your organization."}
          </p>
          <div className="flex justify-center gap-4">
            <Link href={`/${locale}/consultation`}
              className="px-10 py-4 rounded-xl font-semibold text-white transition-colors"
              style={{ background: color }}>
              {fa ? 'شروع مشاوره' : 'Start Consultation'}
            </Link>
            <Link href={`/${locale}/solutions`}
              className="px-10 py-4 rounded-xl font-semibold text-slate-300 hover:text-white transition-colors"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              {fa ? 'همه راهکارها' : 'All Solutions'}
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
