import { getDb } from '@/lib/db'
import { solutions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { SITE } from '@/lib/site'
import Link from 'next/link'
import type { Metadata } from 'next'

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const fa = locale === 'fa'
  return {
    title: fa ? 'راهکارهای فناوری سازمانی | HBZ Technology' : 'Enterprise Technology Solutions | HBZ Technology',
    description: fa
      ? '۱۴ راهکار فناوری سازمانی: شبکه، مجازی‌سازی، ابر، امنیت، پایش، اتوماسیون و خدمات مدیریت‌شده.'
      : '14 enterprise technology solutions: networking, virtualization, cloud, security, monitoring, automation, and managed services.',
    openGraph: { url: `${SITE.url}/${locale}/solutions` },
  }
}

const CATEGORY_LABELS: Record<string, { en: string; fa: string }> = {
  infrastructure: { en: 'Infrastructure', fa: 'زیرساخت' },
  cloud: { en: 'Cloud & Modern', fa: 'ابر و مدرن' },
  security: { en: 'Security', fa: 'امنیت' },
  operations: { en: 'Operations', fa: 'عملیات' },
  consulting: { en: 'Consulting & Services', fa: 'مشاوره و خدمات' },
}

const SOLUTION_CATEGORIES: Record<string, string> = {
  'enterprise-networking': 'infrastructure',
  'microsoft-infrastructure': 'infrastructure',
  'linux-infrastructure': 'infrastructure',
  'virtualization': 'infrastructure',
  'cloud-solutions': 'cloud',
  'cybersecurity': 'security',
  'infrastructure-monitoring': 'operations',
  'automation': 'operations',
  'backup-disaster-recovery': 'operations',
  'business-continuity': 'operations',
  'high-availability': 'infrastructure',
  'technical-consulting': 'consulting',
  'professional-services': 'consulting',
  'managed-services': 'consulting',
}

export default async function SolutionsPage({ params }: Props) {
  const { locale } = await params
  const fa = locale === 'fa'
  const db = getDb()
  const allSolutions = await db.select().from(solutions).where(eq(solutions.active, true)).orderBy(solutions.sortOrder)

  const grouped = allSolutions.reduce<Record<string, typeof allSolutions>>((acc, s) => {
    const cat = SOLUTION_CATEGORIES[s.slug] || 'consulting'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(s)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-background" dir={fa ? 'rtl' : 'ltr'}>
      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-transparent to-cyan-900/10" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-500/5 rounded-full blur-3xl" />
        <div className="relative max-w-6xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium mb-6"
            style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc' }}>
            {fa ? '۱۴ راهکار تخصصی سازمانی' : '14 Specialized Enterprise Solutions'}
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight">
            {fa ? (
              <>راهکارهای <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">فناوری سازمانی</span></>
            ) : (
              <>Enterprise <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">Technology Solutions</span></>
            )}
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10">
            {fa
              ? 'از زیرساخت تا ابر، از امنیت تا اتوماسیون — راهکارهای جامع برای تحول دیجیتال سازمان شما'
              : 'From infrastructure to cloud, from security to automation — comprehensive solutions for your digital transformation'}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href={`/${locale}/consultation`}
              className="px-8 py-3.5 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors">
              {fa ? 'مشاوره رایگان' : 'Free Consultation'}
            </Link>
            <Link href={`/${locale}/case-studies`}
              className="px-8 py-3.5 rounded-xl font-semibold text-slate-300 hover:text-white transition-colors"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              {fa ? 'مطالعات موردی' : 'Case Studies'}
            </Link>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-slate-800/50 py-6">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { num: '14+', label: fa ? 'راهکار تخصصی' : 'Solutions' },
              { num: '50+', label: fa ? 'پروژه موفق' : 'Projects Delivered' },
              { num: '99.9%', label: fa ? 'آپتایم تضمینی' : 'Uptime Guaranteed' },
              { num: '24/7', label: fa ? 'پشتیبانی' : 'Support' },
            ].map(s => (
              <div key={s.label}>
                <div className="text-3xl font-black text-white">{s.num}</div>
                <div className="text-sm text-slate-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solution categories */}
      <section className="py-20 max-w-6xl mx-auto px-6">
        {Object.entries(grouped).map(([cat, items]) => {
          const catLabel = CATEGORY_LABELS[cat]
          return (
            <div key={cat} className="mb-16">
              <div className="flex items-center gap-3 mb-8">
                <h2 className="text-xl font-bold text-white">{fa ? catLabel?.fa : catLabel?.en}</h2>
                <div className="flex-1 h-px bg-slate-800" />
                <span className="text-xs text-slate-600">{items.length} {fa ? 'راهکار' : 'solutions'}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map(s => (
                  <Link key={s.slug} href={`/${locale}/solutions/${s.slug}`}
                    className="group relative rounded-2xl p-6 transition-all hover:scale-[1.02]"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: `linear-gradient(135deg, ${s.color}10, transparent)`, border: `1px solid ${s.color}30` }} />
                    <div className="relative">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                          style={{ background: `${s.color}15`, border: `1px solid ${s.color}30` }}>
                          {s.icon}
                        </div>
                        <span className="text-slate-600 group-hover:text-slate-400 transition-colors text-lg">→</span>
                      </div>
                      <h3 className="text-base font-bold text-white mb-2">{fa ? (s.nameFa || s.nameEn) : s.nameEn}</h3>
                      <p className="text-sm text-slate-500 leading-relaxed">
                        {fa ? (s.taglineFa || s.taglineEn || '') : (s.taglineEn || '')}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-slate-800/50">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            {fa ? 'راهکار مناسب خود را نمی‌یابید؟' : "Can't find the right solution?"}
          </h2>
          <p className="text-slate-400 mb-8">
            {fa ? 'با تیم ما صحبت کنید تا راهکار سفارشی برای نیاز شما طراحی کنیم.' : 'Talk to our team to design a custom solution tailored to your needs.'}
          </p>
          <Link href={`/${locale}/consultation`}
            className="inline-flex px-10 py-4 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors">
            {fa ? 'مشاوره رایگان دریافت کنید' : 'Get Free Consultation'}
          </Link>
        </div>
      </section>
    </div>
  )
}
