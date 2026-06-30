import { Metadata } from 'next'
import Link from 'next/link'
import { getDb } from '@/lib/db'
import { docs } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const metadata: Metadata = {
  title: 'Documentation | HBZ Technology',
  description: 'Technical documentation, API references, runbooks, and guides for HBZ Technology platform.',
}

const TYPE_ICONS: Record<string, string> = { docs: '📄', api: '⚡', runbook: '📋', tutorial: '📖', guide: '🏛️', release: '📦' }
const TYPE_LABELS: Record<string, string> = { docs: 'Documentation', api: 'API Reference', runbook: 'Runbooks', tutorial: 'Tutorials', guide: 'Guides', release: 'Release Notes' }

export default async function DocsPage() {
  let docList: { id: number; slug: string; titleEn: string; type: string; version: string | null; views: number }[] = []
  try {
    const db = getDb()
    const rows = await db.select({ id: docs.id, slug: docs.slug, titleEn: docs.titleEn, type: docs.type, version: docs.version, views: docs.views })
      .from(docs).where(eq(docs.status, 'published'))
    docList = rows
  } catch {}

  const grouped = docList.reduce<Record<string, typeof docList>>((acc, d) => {
    if (!acc[d.type]) acc[d.type] = []
    acc[d.type].push(d)
    return acc
  }, {})

  const typeOrder = ['docs', 'api', 'guide', 'tutorial', 'runbook', 'release']

  return (
    <main className="min-h-screen bg-[#07070f] text-white">
      <section className="pt-32 pb-16 px-6 text-center">
        <h1 className="text-5xl md:text-6xl font-black mb-4">Documentation</h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto">Everything you need to build, integrate, and operate with HBZ Technology platform.</p>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-24 space-y-16">
        {typeOrder.map(type => {
          const items = grouped[type]
          if (!items?.length) return null
          return (
            <div key={type}>
              <div className="flex items-center gap-3 mb-6">
                <span className="text-2xl">{TYPE_ICONS[type]}</span>
                <h2 className="text-2xl font-bold">{TYPE_LABELS[type] || type}</h2>
                <span className="text-sm text-slate-600">({items.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map(d => (
                  <Link key={d.id} href={`/en/docs/${d.slug}`}
                    className="block p-5 rounded-xl border border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all group">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-white group-hover:text-indigo-300 transition-colors">{d.titleEn}</h3>
                      {d.version && <span className="text-xs text-slate-600 font-mono ml-2 flex-shrink-0">{d.version}</span>}
                    </div>
                    <div className="text-xs text-slate-600">{d.views.toLocaleString()} views</div>
                  </Link>
                ))}
              </div>
            </div>
          )
        })}

        {docList.length === 0 && (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">📚</div>
            <h3 className="text-xl font-bold mb-2">Documentation Coming Soon</h3>
            <p className="text-slate-500">We&apos;re building comprehensive documentation for the platform.</p>
          </div>
        )}
      </section>
    </main>
  )
}
