/**
 * 26.33 بند ۱.۱ — zero locale awareness: English-only reads, English-only
 * labels, and `/en/` hardcoded into every link (so a Persian reader was thrown
 * out of their locale by clicking a document).
 */
import { Metadata } from 'next'
import Link from 'next/link'
import { getDb } from '@/lib/db'
import { docs } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { SITE } from '@/lib/site'
import { localized, labelOf, tr } from '@/lib/localizedContent'

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const fa = locale === 'fa'
  return {
    title: fa ? 'مستندات | HBZ Technology' : 'Documentation | HBZ Technology',
    description: fa
      ? 'مستندات فنی، مرجع رابط برنامه‌نویسی، دستورالعمل‌های اجرایی و راهنماهای پلتفرم HBZ.'
      : 'Technical documentation, API references, runbooks, and guides for the HBZ Technology platform.',
    openGraph: { url: `${SITE.url}/${locale}/docs` },
  }
}

const TYPE_ICONS: Record<string, string> = { docs: '📄', api: '⚡', runbook: '📋', tutorial: '📖', guide: '🏛️', release: '📦' }

const TYPE_LABELS: Record<string, { en: string; fa: string }> = {
  docs: { en: 'Documentation', fa: 'مستندات' },
  api: { en: 'API Reference', fa: 'مرجع رابط برنامه‌نویسی' },
  runbook: { en: 'Runbooks', fa: 'دستورالعمل‌های اجرایی' },
  tutorial: { en: 'Tutorials', fa: 'آموزش‌های گام‌به‌گام' },
  guide: { en: 'Guides', fa: 'راهنماها' },
  release: { en: 'Release Notes', fa: 'یادداشت‌های انتشار' },
}

interface DocRow {
  id: number; slug: string; titleEn: string; titleFa: string | null
  type: string; version: string | null; views: number
}

export default async function DocsPage({ params }: Props) {
  const { locale } = await params
  const fa = locale === 'fa'
  const L = (en: string, faText: string) => tr(fa, en, faText)

  let docList: DocRow[] = []
  try {
    const db = getDb()
    docList = await db.select({
      id: docs.id, slug: docs.slug, titleEn: docs.titleEn, titleFa: docs.titleFa,
      type: docs.type, version: docs.version, views: docs.views,
    }).from(docs).where(eq(docs.status, 'published'))
  } catch { /* no docs yet → empty state, never a crash */ }

  const grouped = docList.reduce<Record<string, DocRow[]>>((acc, d) => {
    if (!acc[d.type]) acc[d.type] = []
    acc[d.type].push(d)
    return acc
  }, {})

  const typeOrder = ['docs', 'api', 'guide', 'tutorial', 'runbook', 'release']
  const num = (n: number) => n.toLocaleString(fa ? 'fa-IR' : 'en-US')

  return (
    <main className="min-h-screen bg-background text-white" dir={fa ? 'rtl' : 'ltr'}>
      <section className="pt-32 pb-16 px-6 text-center">
        <h1 className="text-5xl md:text-6xl font-black mb-4">{L('Documentation', 'مستندات')}</h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto">
          {L('Everything you need to build, integrate, and operate with the HBZ Technology platform.',
             'هر آنچه برای ساخت، یکپارچه‌سازی و بهره‌برداری از پلتفرم HBZ نیاز دارید.')}
        </p>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-24 space-y-16">
        {typeOrder.map(type => {
          const items = grouped[type]
          if (!items?.length) return null
          return (
            <div key={type}>
              <div className="flex items-center gap-3 mb-6">
                <span className="text-2xl">{TYPE_ICONS[type]}</span>
                <h2 className="text-2xl font-bold">{labelOf(TYPE_LABELS, type, fa)}</h2>
                <span className="text-sm text-slate-600">({num(items.length)})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map(d => (
                  <Link key={d.id} href={`/${locale}/docs/${d.slug}`}
                    className="block p-5 rounded-xl border border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all group">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-white group-hover:text-indigo-300 transition-colors">{localized(d, 'title', fa)}</h3>
                      {d.version && <span className="text-xs text-slate-600 font-mono ms-2 flex-shrink-0" dir="ltr">{d.version}</span>}
                    </div>
                    <div className="text-xs text-slate-600">{L(`${num(d.views)} views`, `${num(d.views)} بازدید`)}</div>
                  </Link>
                ))}
              </div>
            </div>
          )
        })}

        {docList.length === 0 && (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">📚</div>
            <h3 className="text-xl font-bold mb-2">{L('Documentation coming soon', 'مستندات به‌زودی')}</h3>
            <p className="text-slate-500">
              {L('We’re building comprehensive documentation for the platform.', 'در حال تدوین مستندات کامل پلتفرم هستیم.')}
            </p>
          </div>
        )}
      </section>
    </main>
  )
}
