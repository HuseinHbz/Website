/**
 * 26.33 بند ۱.۱ — this page had ZERO locale awareness: it read only `titleEn`,
 * hardcoded every label in English, and even hardcoded `/en/` into its links,
 * so a Persian visitor got an English page that then dropped them out of their
 * own locale. The `titleFa`/`descriptionFa` values were in the same rows the
 * whole time. Rebuilt on the pattern the healthy pages already use.
 */
import { Metadata } from 'next'
import Link from 'next/link'
import { getDb } from '@/lib/db'
import { events } from '@/lib/db/schema'
import { inArray, eq, desc, asc } from 'drizzle-orm'
import { SITE } from '@/lib/site'
import { localized, labelOf, tr, EVENT_MODE_LABELS } from '@/lib/localizedContent'

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const fa = locale === 'fa'
  return {
    title: fa ? 'رویدادها و همایش‌ها' : 'Events & Community',
    description: fa
      ? 'وبینار، همایش، کارگاه و گردهمایی تخصصی برای متخصصان فناوری اطلاعات سازمانی.'
      : 'Webinars, conferences, workshops and community meetups for enterprise IT professionals.',
    openGraph: { url: `${SITE.url}/${locale}/events` },
  }
}

const TYPE_ICONS: Record<string, string> = { webinar: '🖥️', conference: '🏛️', meetup: '☕', workshop: '🔧', training: '📚', announcement: '📢' }

const TYPE_LABELS: Record<string, { en: string; fa: string }> = {
  webinar: { en: 'Webinar', fa: 'وبینار' },
  conference: { en: 'Conference', fa: 'همایش' },
  meetup: { en: 'Meetup', fa: 'گردهمایی' },
  workshop: { en: 'Workshop', fa: 'کارگاه' },
  training: { en: 'Training', fa: 'دورهٔ آموزشی' },
  announcement: { en: 'Announcement', fa: 'اطلاعیه' },
}

interface EventRow {
  id: number; slug: string; titleEn: string; titleFa: string | null
  type: string; status: string; format: string; startDate: string
  registrationsCount: number; isFree: boolean; featured: boolean
}

export default async function EventsPage({ params }: Props) {
  const { locale } = await params
  const fa = locale === 'fa'
  const L = (en: string, faText: string) => tr(fa, en, faText)

  let upcomingLive: EventRow[] = []
  let past: EventRow[] = []

  const columns = {
    id: events.id, slug: events.slug, titleEn: events.titleEn, titleFa: events.titleFa,
    type: events.type, status: events.status, format: events.format, startDate: events.startDate,
    registrationsCount: events.registrationsCount, isFree: events.isFree, featured: events.featured,
  }

  try {
    const db = getDb()
    upcomingLive = await db.select(columns).from(events)
      .where(inArray(events.status, ['upcoming', 'live'])).orderBy(asc(events.startDate))
    past = await db.select(columns).from(events)
      .where(eq(events.status, 'completed')).orderBy(desc(events.startDate)).limit(6)
  } catch { /* an empty events table renders the empty state, never a crash */ }

  const upcoming = upcomingLive.filter(e => e.status === 'upcoming')
  const live = upcomingLive.filter(e => e.status === 'live')

  const title = (e: EventRow) => localized(e, 'title', fa)
  const dateOf = (iso: string) =>
    new Date(iso).toLocaleDateString(fa ? 'fa-IR' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const count = (n: number) => (fa ? n.toLocaleString('fa-IR') : String(n))

  return (
    <main className="min-h-screen bg-background text-white" dir={fa ? 'rtl' : 'ltr'}>
      <section className="pt-32 pb-16 px-6 text-center">
        <h1 className="text-5xl md:text-6xl font-black mb-4">{L('Events & Community', 'رویدادها و همایش‌ها')}</h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto">
          {L('Join webinars, workshops, and conferences with enterprise technology experts.',
             'در وبینارها، کارگاه‌ها و همایش‌ها همراه با متخصصان فناوری سازمانی شرکت کنید.')}
        </p>
      </section>

      {live.length > 0 && (
        <section className="max-w-4xl mx-auto px-6 pb-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse inline-block" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-red-400">{L('Live now', 'هم‌اکنون زنده')}</h2>
          </div>
          <div className="space-y-4">
            {live.map(e => (
              <Link key={e.id} href={`/${locale}/events/${e.slug}`}
                className="flex items-center gap-4 p-5 rounded-2xl border border-red-500/30 hover:border-red-500/60 transition-all" style={{ background: 'rgba(239,68,68,0.05)' }}>
                <span className="text-3xl">{TYPE_ICONS[e.type] || '📅'}</span>
                <div className="flex-1">
                  <h3 className="font-bold text-white text-lg">{title(e)}</h3>
                  <div className="text-sm text-slate-400">
                    {labelOf(EVENT_MODE_LABELS, e.format, fa)} · {L(`${count(e.registrationsCount)} registered`, `${count(e.registrationsCount)} نفر ثبت‌نام کرده‌اند`)}
                  </div>
                </div>
                <div className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-bold">{L('Join live', 'ورود به رویداد')}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="max-w-6xl mx-auto px-6 pb-16">
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-600 mb-6">{L('Upcoming events', 'رویدادهای پیش‌رو')}</h2>
        {upcoming.length === 0 ? (
          <div className="text-center py-16 border border-slate-800 rounded-2xl">
            <div className="text-4xl mb-3">🗓️</div>
            <h3 className="text-lg font-bold mb-2">{L('No upcoming events', 'رویداد پیش‌رویی نیست')}</h3>
            <p className="text-slate-500 text-sm">{L('Check back soon for new webinars and workshops.', 'به‌زودی وبینارها و کارگاه‌های تازه اعلام می‌شوند.')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {upcoming.map(e => (
              <Link key={e.id} href={`/${locale}/events/${e.slug}`}
                className="block p-6 rounded-2xl border border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all group" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{TYPE_ICONS[e.type] || '📅'}</span>
                  <span className="text-xs text-slate-500">{labelOf(TYPE_LABELS, e.type, fa)}</span>
                  <span className="text-xs text-slate-600 ms-auto">{labelOf(EVENT_MODE_LABELS, e.format, fa)}</span>
                </div>
                <h3 className="font-bold text-white group-hover:text-indigo-300 transition-colors mb-2">{title(e)}</h3>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">{dateOf(e.startDate)}</span>
                  <span className={e.isFree ? 'text-green-400 font-bold' : 'text-indigo-400 font-bold'}>
                    {e.isFree ? L('Free', 'رایگان') : L('Paid', 'با هزینه')}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 pb-24">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-600 mb-6">{L('Past events', 'رویدادهای برگزارشده')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {past.map(e => (
              <Link key={e.id} href={`/${locale}/events/${e.slug}`}
                className="block p-4 rounded-xl border border-slate-800/50 hover:border-slate-700 transition-all group opacity-70 hover:opacity-100">
                <div className="flex items-center gap-2 mb-2">
                  <span>{TYPE_ICONS[e.type] || '📅'}</span>
                  <span className="text-xs text-slate-600">{labelOf(TYPE_LABELS, e.type, fa)}</span>
                </div>
                <h3 className="font-medium text-white text-sm group-hover:text-indigo-300 transition-colors">{title(e)}</h3>
                <div className="text-xs text-slate-600 mt-1">
                  {L(`${count(e.registrationsCount)} attended`, `${count(e.registrationsCount)} نفر شرکت کردند`)}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
