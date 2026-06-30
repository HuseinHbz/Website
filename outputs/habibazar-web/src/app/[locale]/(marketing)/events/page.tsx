import { Metadata } from 'next'
import Link from 'next/link'
import { getDb } from '@/lib/db'
import { events } from '@/lib/db/schema'
import { inArray, eq, desc, asc } from 'drizzle-orm'

export const metadata: Metadata = {
  title: 'Events & Community | HBZ Technology',
  description: 'Webinars, conferences, workshops and community meetups for enterprise IT professionals.',
}

const TYPE_ICONS: Record<string, string> = { webinar: '🖥️', conference: '🏛️', meetup: '☕', workshop: '🔧', training: '📚', announcement: '📢' }
const FORMAT_LABELS: Record<string, string> = { online: 'Online', in_person: 'In Person', hybrid: 'Hybrid' }

export default async function EventsPage() {
  let upcomingLive: { id: number; slug: string; titleEn: string; type: string; status: string; format: string; startDate: string; registrationsCount: number; isFree: boolean; featured: boolean }[] = []
  let past: typeof upcomingLive = []

  try {
    const db = getDb()
    const rows = await db.select({
      id: events.id, slug: events.slug, titleEn: events.titleEn, type: events.type, status: events.status,
      format: events.format, startDate: events.startDate, registrationsCount: events.registrationsCount,
      isFree: events.isFree, featured: events.featured,
    }).from(events).where(inArray(events.status, ['upcoming', 'live'])).orderBy(asc(events.startDate))
    upcomingLive = rows

    const pastRows = await db.select({
      id: events.id, slug: events.slug, titleEn: events.titleEn, type: events.type, status: events.status,
      format: events.format, startDate: events.startDate, registrationsCount: events.registrationsCount,
      isFree: events.isFree, featured: events.featured,
    }).from(events).where(eq(events.status, 'completed')).orderBy(desc(events.startDate)).limit(6)
    past = pastRows
  } catch {}

  const upcoming = upcomingLive.filter(e => e.status === 'upcoming')
  const live = upcomingLive.filter(e => e.status === 'live')

  return (
    <main className="min-h-screen bg-[#07070f] text-white">
      <section className="pt-32 pb-16 px-6 text-center">
        <h1 className="text-5xl md:text-6xl font-black mb-4">Events & Community</h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto">Join webinars, workshops, and conferences with enterprise technology experts.</p>
      </section>

      {live.length > 0 && (
        <section className="max-w-4xl mx-auto px-6 pb-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse inline-block" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-red-400">Live Now</h2>
          </div>
          <div className="space-y-4">
            {live.map(e => (
              <Link key={e.id} href={`/en/events/${e.slug}`}
                className="flex items-center gap-4 p-5 rounded-2xl border border-red-500/30 hover:border-red-500/60 transition-all" style={{ background: 'rgba(239,68,68,0.05)' }}>
                <span className="text-3xl">{TYPE_ICONS[e.type] || '📅'}</span>
                <div className="flex-1">
                  <h3 className="font-bold text-white text-lg">{e.titleEn}</h3>
                  <div className="text-sm text-slate-400">{FORMAT_LABELS[e.format] || e.format} · {e.registrationsCount} registered</div>
                </div>
                <div className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-bold">Join Live</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="max-w-6xl mx-auto px-6 pb-16">
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-600 mb-6">Upcoming Events</h2>
        {upcoming.length === 0 ? (
          <div className="text-center py-16 border border-slate-800 rounded-2xl">
            <div className="text-4xl mb-3">🗓️</div>
            <h3 className="text-lg font-bold mb-2">No Upcoming Events</h3>
            <p className="text-slate-500 text-sm">Check back soon for new webinars and workshops.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {upcoming.map(e => (
              <Link key={e.id} href={`/en/events/${e.slug}`}
                className="block p-6 rounded-2xl border border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all group" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{TYPE_ICONS[e.type] || '📅'}</span>
                  <span className="text-xs text-slate-500 capitalize">{e.type}</span>
                  <span className="text-xs text-slate-600 ml-auto">{FORMAT_LABELS[e.format]}</span>
                </div>
                <h3 className="font-bold text-white group-hover:text-indigo-300 transition-colors mb-2">{e.titleEn}</h3>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">{new Date(e.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  <span className={e.isFree ? 'text-green-400 font-bold' : 'text-indigo-400 font-bold'}>{e.isFree ? 'Free' : 'Paid'}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 pb-24">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-600 mb-6">Past Events</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {past.map(e => (
              <Link key={e.id} href={`/en/events/${e.slug}`}
                className="block p-4 rounded-xl border border-slate-800/50 hover:border-slate-700 transition-all group opacity-70 hover:opacity-100">
                <div className="flex items-center gap-2 mb-2">
                  <span>{TYPE_ICONS[e.type] || '📅'}</span>
                  <span className="text-xs text-slate-600 capitalize">{e.type}</span>
                </div>
                <h3 className="font-medium text-white text-sm group-hover:text-indigo-300 transition-colors">{e.titleEn}</h3>
                <div className="text-xs text-slate-600 mt-1">{e.registrationsCount} attended</div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
