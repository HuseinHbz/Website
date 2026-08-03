import { getDb } from '@/lib/db'
import { industries } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { SITE } from '@/lib/site'
import Link from 'next/link'
import type { Metadata } from 'next'

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const fa = locale === 'fa'
  return {
    title: fa ? 'صنایع | HBZ Technology' : 'Industries | HBZ Technology',
    description: fa
      ? 'راهکارهای فناوری تخصصی برای ۱۰ صنعت: مالی، بهداشت، دولت، آموزش، خرده‌فروشی و بیشتر.'
      : 'Specialized technology solutions for 10 industries: finance, healthcare, government, education, retail, and more.',
    openGraph: { url: `${SITE.url}/${locale}/industries` },
  }
}

export default async function IndustriesPage({ params }: Props) {
  const { locale } = await params
  const fa = locale === 'fa'
  const db = getDb()
  // 26.30 بند۱ — the post-deploy health check caught this: with the database
  // briefly unreachable, every other public page degraded to its empty state
  // while this one threw and returned 500 for the whole route. A public page
  // must not take itself down because one query failed — render empty, log the
  // cause. (Same guard the events/docs/products pages already had.)
  const allIndustries = await db.select().from(industries).where(eq(industries.active, true)).orderBy(industries.sortOrder)
    .catch((e: unknown) => { console.error('[industries] query failed — rendering empty state', e); return [] as (typeof industries.$inferSelect)[] })

  return (
    <div className="min-h-screen bg-background" dir={fa ? 'rtl' : 'ltr'}>
      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/15 via-transparent to-indigo-900/15" />
        <div className="relative max-w-6xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium mb-6"
            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#6ee7b7' }}>
            {fa ? '۱۰ صنعت تخصصی' : '10 Industry Verticals'}
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight">
            {fa ? (
              <>راهکارهای <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">صنعت‌محور</span></>
            ) : (
              <><span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">Industry-Specific</span> Solutions</>
            )}
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            {fa
              ? 'راهکارهای فناوری تخصصی متناسب با چالش‌های منحصربه‌فرد هر صنعت'
              : 'Specialized technology solutions tailored to each industry\'s unique challenges'}
          </p>
        </div>
      </section>

      {/* Industry grid */}
      <section className="py-20 max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allIndustries.map(ind => {
            const name = fa ? (ind.nameFa || ind.nameEn) : ind.nameEn
            const tagline = fa ? (ind.taglineFa || ind.taglineEn || '') : (ind.taglineEn || '')
            const color = ind.color || '#6366f1'
            return (
              <div key={ind.slug} className="rounded-2xl p-7 group hover:scale-[1.02] transition-all"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl mb-5"
                  style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                  {ind.icon}
                </div>
                <h2 className="text-lg font-bold text-white mb-2">{name}</h2>
                {tagline && <p className="text-sm text-slate-400 leading-relaxed mb-4">{tagline}</p>}
                <Link href={`/${locale}/solutions`}
                  className="text-sm font-medium transition-colors"
                  style={{ color }}>
                  {fa ? 'مشاهده راهکارها ←' : 'View Solutions →'}
                </Link>
              </div>
            )
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-slate-800/50">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            {fa ? 'صنعت شما در لیست نیست؟' : "Your industry isn't listed?"}
          </h2>
          <p className="text-slate-400 mb-8">
            {fa ? 'ما برای تمام صنایع راهکار سفارشی ارائه می‌دهیم. با ما تماس بگیرید.' : 'We provide custom solutions for all industries. Get in touch.'}
          </p>
          <Link href={`/${locale}/consultation`}
            className="inline-flex px-10 py-4 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors">
            {fa ? 'مشاوره رایگان' : 'Free Consultation'}
          </Link>
        </div>
      </section>
    </div>
  )
}
