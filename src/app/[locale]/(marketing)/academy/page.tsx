/**
 * 26.33 بند ۱.۱ — zero locale awareness. Also priced everything in `$` while
 * the platform's base currency is the Rial (26.7), and hardcoded `/en/` links.
 */
import { Metadata } from 'next'
import Link from 'next/link'
import { getDb } from '@/lib/db'
import { courses } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { SITE } from '@/lib/site'
import { localized, labelOf, tr, LEVEL_LABELS } from '@/lib/localizedContent'

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const fa = locale === 'fa'
  return {
    title: fa ? 'آموزشگاه HBZ | آموزش فناوری سازمانی' : 'HBZ Academy | Enterprise Technology Training',
    description: fa
      ? 'دوره‌ها، مسیرهای یادگیری، بوت‌کمپ و گواهی‌نامه برای متخصصان فناوری اطلاعات سازمانی.'
      : 'Courses, learning paths, bootcamps and certifications for enterprise IT professionals.',
    openGraph: { url: `${SITE.url}/${locale}/academy` },
  }
}

const LEVEL_COLORS: Record<string, string> = { beginner: '#22c55e', intermediate: '#6366f1', advanced: '#f59e0b', expert: '#ef4444' }

const TYPE_LABELS: Record<string, { en: string; fa: string }> = {
  course: { en: 'Course', fa: 'دوره' },
  path: { en: 'Learning path', fa: 'مسیر یادگیری' },
  bootcamp: { en: 'Bootcamp', fa: 'بوت‌کمپ' },
  certification: { en: 'Certification', fa: 'گواهی‌نامه' },
  workshop: { en: 'Workshop', fa: 'کارگاه' },
}

interface CourseRow {
  id: number; slug: string; titleEn: string; titleFa: string | null
  level: string; type: string; durationHours: number | null; lessonsCount: number
  enrollmentsCount: number; isFree: boolean; price: number; rating: number
}

export default async function AcademyPage({ params }: Props) {
  const { locale } = await params
  const fa = locale === 'fa'
  const L = (en: string, faText: string) => tr(fa, en, faText)
  const num = (n: number) => n.toLocaleString(fa ? 'fa-IR' : 'en-US')

  let courseList: CourseRow[] = []
  try {
    const db = getDb()
    courseList = await db.select({
      id: courses.id, slug: courses.slug, titleEn: courses.titleEn, titleFa: courses.titleFa,
      level: courses.level, type: courses.type,
      durationHours: courses.durationHours, lessonsCount: courses.lessonsCount,
      enrollmentsCount: courses.enrollmentsCount,
      isFree: courses.isFree, price: courses.price, rating: courses.rating,
    }).from(courses).where(eq(courses.status, 'published')).orderBy(desc(courses.enrollmentsCount))
  } catch { /* no courses yet → empty state, never a crash */ }

  const featured = courseList.filter(c => c.enrollmentsCount > 100).slice(0, 3)
  const stats = [
    { label: L('Courses', 'دوره'), value: num(courseList.length) },
    { label: L('Free courses', 'دورهٔ رایگان'), value: num(courseList.filter(c => c.isFree).length) },
    { label: L('Enrollments', 'ثبت‌نام'), value: num(courseList.reduce((s, c) => s + c.enrollmentsCount, 0)) },
  ]

  // 26.7: the Rial is the base currency — a hardcoded `$` misstated every price.
  const priceOf = (p: number) => (fa ? `${num(p)} ریال` : `${num(p)} IRR`)
  const hours = (h: number) => L(`${num(h)}h`, `${num(h)} ساعت`)

  const CourseMeta = ({ c, muted }: { c: CourseRow; muted?: boolean }) => (
    <div className={`flex items-center gap-3 text-xs ${muted ? 'text-slate-600' : 'text-slate-500'}`}>
      {c.durationHours != null && <span>{hours(c.durationHours)}</span>}
      <span>{L(`${num(c.lessonsCount)} lessons`, `${num(c.lessonsCount)} درس`)}</span>
      {muted
        ? (c.isFree ? <span className="text-green-500">{L('Free', 'رایگان')}</span> : <span>{priceOf(c.price)}</span>)
        : <span>{L(`${num(c.enrollmentsCount)} enrolled`, `${num(c.enrollmentsCount)} ثبت‌نام`)}</span>}
    </div>
  )

  return (
    <main className="min-h-screen bg-background text-white" dir={fa ? 'rtl' : 'ltr'}>
      <section className="pt-32 pb-16 px-6 text-center">
        <div className="inline-block px-4 py-1.5 rounded-full text-xs font-bold border border-indigo-500/30 text-indigo-400 mb-6 uppercase tracking-widest">
          {L('HBZ Academy', 'آموزشگاه HBZ')}
        </div>
        <h1 className="text-5xl md:text-6xl font-black mb-4">{L('Learn enterprise technology', 'فناوری سازمانی را بیاموزید')}</h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-8">
          {L('Courses, certifications, and learning paths designed for IT professionals and enterprise teams.',
             'دوره‌ها، گواهی‌نامه‌ها و مسیرهای یادگیری، طراحی‌شده برای متخصصان فناوری اطلاعات و تیم‌های سازمانی.')}
        </p>
        <div className="flex justify-center gap-8 text-center">
          {stats.map(s => (
            <div key={s.label}>
              <div className="text-3xl font-black text-white">{s.value}</div>
              <div className="text-sm text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {featured.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 pb-16">
          <h2 className="text-xl font-bold mb-6">{L('Featured courses', 'دوره‌های منتخب')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featured.map(c => (
              <Link key={c.id} href={`/${locale}/academy/${c.slug}`}
                className="block p-6 rounded-2xl border border-slate-800 hover:border-indigo-500/50 transition-all group" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: LEVEL_COLORS[c.level] + '20', color: LEVEL_COLORS[c.level] }}>
                    {labelOf(LEVEL_LABELS, c.level, fa)}
                  </span>
                  {c.isFree && <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-500/10 text-green-400">{L('Free', 'رایگان')}</span>}
                </div>
                <h3 className="font-bold text-white group-hover:text-indigo-300 transition-colors mb-2">{localized(c, 'title', fa)}</h3>
                <CourseMeta c={c} />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="max-w-6xl mx-auto px-6 pb-24">
        <h2 className="text-xl font-bold mb-6">{L('All courses', 'همهٔ دوره‌ها')}</h2>
        {courseList.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">🎓</div>
            <h3 className="text-xl font-bold mb-2">{L('Courses launching soon', 'دوره‌ها به‌زودی')}</h3>
            <p className="text-slate-500">{L('Enterprise technology training is coming. Stay tuned.', 'آموزش‌های فناوری سازمانی در راه است؛ همراه ما باشید.')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courseList.map(c => (
              <Link key={c.id} href={`/${locale}/academy/${c.slug}`}
                className="block p-5 rounded-xl border border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: LEVEL_COLORS[c.level] + '20', color: LEVEL_COLORS[c.level] }}>
                    {labelOf(LEVEL_LABELS, c.level, fa)}
                  </span>
                  <span className="text-xs text-slate-600">{labelOf(TYPE_LABELS, c.type, fa)}</span>
                </div>
                <h3 className="font-semibold text-white group-hover:text-indigo-300 transition-colors mb-2">{localized(c, 'title', fa)}</h3>
                <CourseMeta c={c} muted />
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
