import { getDb } from '@/lib/db'
import { technologies } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { SITE } from '@/lib/site'
import Link from 'next/link'
import type { Metadata } from 'next'

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const fa = locale === 'fa'
  return {
    title: fa ? 'اکوسیستم فناوری | HBZ Technology' : 'Technology Ecosystem | HBZ Technology',
    description: fa
      ? 'بیش از ۲۰ فناوری سازمانی: شبکه، مجازی‌سازی، ابر، امنیت، پایش، اتوماسیون و کانتینرها.'
      : '20+ enterprise technologies: networking, virtualization, cloud, security, monitoring, automation, and containers.',
    openGraph: { url: `${SITE.url}/${locale}/technologies` },
  }
}

const CATEGORY_META: Record<string, { en: string; fa: string; icon: string }> = {
  networking: { en: 'Networking', fa: 'شبکه', icon: '🌐' },
  virtualization: { en: 'Virtualization', fa: 'مجازی‌سازی', icon: '🖥️' },
  cloud: { en: 'Cloud', fa: 'ابر', icon: '☁️' },
  os: { en: 'Operating Systems', fa: 'سیستم‌عامل', icon: '💻' },
  monitoring: { en: 'Monitoring', fa: 'پایش', icon: '📊' },
  security: { en: 'Security', fa: 'امنیت', icon: '🔒' },
  identity: { en: 'Identity & Access', fa: 'هویت و دسترسی', icon: '🏢' },
  automation: { en: 'Automation & IaC', fa: 'اتوماسیون', icon: '⚙️' },
  containers: { en: 'Containers & K8s', fa: 'کانتینر', icon: '🐋' },
  backup: { en: 'Backup & DR', fa: 'پشتیبان‌گیری', icon: '💾' },
}

const TIER_LABELS: Record<string, { en: string; fa: string; color: string }> = {
  core: { en: 'Core', fa: 'اصلی', color: '#22c55e' },
  advanced: { en: 'Advanced', fa: 'پیشرفته', color: '#3b82f6' },
  specialized: { en: 'Specialized', fa: 'تخصصی', color: '#8b5cf6' },
}

export default async function TechnologiesPage({ params }: Props) {
  const { locale } = await params
  const fa = locale === 'fa'
  const db = getDb()
  const allTech = await db.select().from(technologies).where(eq(technologies.active, true)).orderBy(technologies.sortOrder)

  const grouped = allTech.reduce<Record<string, typeof allTech>>((acc, t) => {
    const cat = t.category
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(t)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-background" dir={fa ? 'rtl' : 'ltr'}>
      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/15 via-transparent to-indigo-900/15" />
        <div className="relative max-w-6xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium mb-6"
            style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.3)', color: '#67e8f9' }}>
            {fa ? 'اکوسیستم فناوری HBZ' : 'HBZ Technology Ecosystem'}
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight">
            {fa ? (
              <>اکوسیستم <span className="bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">فناوری</span></>
            ) : (
              <>Technology <span className="bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">Ecosystem</span></>
            )}
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-8">
            {fa
              ? 'فناوری‌های اثبات‌شده‌ای که برای پیاده‌سازی راهکارهای سازمانی به کار می‌گیریم'
              : 'Proven technologies we leverage to deliver enterprise-grade solutions'}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {Object.entries(TIER_LABELS).map(([tier, meta]) => (
              <div key={tier} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs"
                style={{ background: `${meta.color}15`, border: `1px solid ${meta.color}40`, color: meta.color }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
                {fa ? meta.fa : meta.en}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech grid by category */}
      <section className="py-20 max-w-6xl mx-auto px-6">
        {Object.entries(grouped).map(([cat, items]) => {
          const meta = CATEGORY_META[cat] || { en: cat, fa: cat, icon: '⚙️' }
          return (
            <div key={cat} className="mb-16">
              <div className="flex items-center gap-3 mb-8">
                <span className="text-2xl">{meta.icon}</span>
                <h2 className="text-xl font-bold text-white">{fa ? meta.fa : meta.en}</h2>
                <div className="flex-1 h-px bg-slate-800" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {items.map(t => {
                  const tierMeta = TIER_LABELS[t.tier]
                  return (
                    <div key={t.slug}
                      className="relative rounded-xl p-5 group hover:scale-[1.03] transition-all cursor-default"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                          style={{ background: `${t.color}15`, border: `1px solid ${t.color}30` }}>
                          {t.icon}
                        </div>
                        {tierMeta && (
                          <span className="text-3xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: `${tierMeta.color}15`, color: tierMeta.color, border: `1px solid ${tierMeta.color}30` }}>
                            {fa ? tierMeta.fa : tierMeta.en}
                          </span>
                        )}
                      </div>
                      <div className="font-semibold text-white text-sm">{fa ? (t.nameFa || t.nameEn) : t.nameEn}</div>
                      {t.vendor && <div className="text-2xs text-slate-500 mt-0.5">{t.vendor}</div>}
                      {(fa ? t.descriptionFa : t.descriptionEn) && (
                        <p className="text-2xs text-slate-500 mt-2 leading-relaxed">
                          {fa ? t.descriptionFa : t.descriptionEn}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-slate-800/50">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            {fa ? 'به مشاوره فناوری نیاز دارید؟' : 'Need technology consultation?'}
          </h2>
          <p className="text-slate-400 mb-8">
            {fa ? 'بهترین فناوری‌ها را برای نیازهای خاص سازمان شما پیشنهاد می‌دهیم.' : 'We recommend the best technologies for your specific organizational needs.'}
          </p>
          <Link href={`/${locale}/consultation`}
            className="inline-flex px-10 py-4 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors">
            {fa ? 'مشاوره رایگان' : 'Free Consultation'}
          </Link>
        </div>
      </section>
    </div>
  )
}
