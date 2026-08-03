/**
 * 26.33 بند ۱.۱ — zero locale awareness: English-only reads, raw enum values
 * rendered as badges (`coming_soon` shown verbatim), and `/en/` hardcoded links.
 */
import { Metadata } from 'next'
import Link from 'next/link'
import { getDb } from '@/lib/db'
import { products } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'
import { SITE } from '@/lib/site'
import { localized, labelOf, tr } from '@/lib/localizedContent'

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const fa = locale === 'fa'
  return {
    title: fa ? 'محصولات و پلتفرم | HBZ Technology' : 'Products & Platform | HBZ Technology',
    description: fa
      ? 'زیرساخت، امنیت، پایش و ابزارهای هوش مصنوعی سازمانی، ساخته‌شده برای سازمان‌های امروزی.'
      : 'Enterprise infrastructure, security, monitoring, and AI tools built for modern organizations.',
    openGraph: { url: `${SITE.url}/${locale}/products` },
  }
}

const TYPE_ICONS: Record<string, string> = { hardware: '🖥️', software: '💿', service: '☁️', subscription: '🔁', license: '🔑', saas: '🚀' }

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  active: { bg: '#22c55e20', text: '#22c55e' },
  beta: { bg: '#f59e0b20', text: '#f59e0b' },
  coming_soon: { bg: '#6366f120', text: '#6366f1' },
  deprecated: { bg: '#64748b20', text: '#64748b' },
  archived: { bg: '#64748b20', text: '#64748b' },
}

// The raw enum key used to be printed straight into the badge, so a Persian
// visitor saw `coming_soon` — not even English prose, a database value.
const STATUS_LABELS: Record<string, { en: string; fa: string }> = {
  active: { en: 'Available', fa: 'موجود' },
  beta: { en: 'Beta', fa: 'نسخهٔ آزمایشی' },
  coming_soon: { en: 'Coming soon', fa: 'به‌زودی' },
  deprecated: { en: 'Deprecated', fa: 'منسوخ' },
  archived: { en: 'Archived', fa: 'بایگانی‌شده' },
}

interface ProductRow {
  id: number; slug: string; nameEn: string; nameFa: string | null
  type: string; status: string; currentVersion: string | null; featured: boolean
}

export default async function ProductsPage({ params }: Props) {
  const { locale } = await params
  const fa = locale === 'fa'
  const L = (en: string, faText: string) => tr(fa, en, faText)

  let productList: ProductRow[] = []
  try {
    const db = getDb()
    productList = await db.select({
      id: products.id, slug: products.slug, nameEn: products.nameEn, nameFa: products.nameFa,
      type: products.type, status: products.status,
      currentVersion: products.currentVersion, featured: products.featured,
    }).from(products).orderBy(desc(products.featured), products.nameEn)
  } catch { /* no products yet → empty state, never a crash */ }

  const featured = productList.filter(p => p.featured)
  const rest = productList.filter(p => !p.featured)

  const StatusBadge = ({ status }: { status: string }) => {
    const s = STATUS_STYLES[status] || STATUS_STYLES.active
    return (
      <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: s.bg, color: s.text }}>
        {labelOf(STATUS_LABELS, status, fa)}
      </span>
    )
  }

  return (
    <main className="min-h-screen bg-background text-white" dir={fa ? 'rtl' : 'ltr'}>
      <section className="pt-32 pb-16 px-6 text-center">
        <h1 className="text-5xl md:text-6xl font-black mb-4">{L('Enterprise platform', 'پلتفرم سازمانی')}</h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto">
          {L('Infrastructure, security, monitoring, and AI tools engineered for enterprise scale.',
             'زیرساخت، امنیت، پایش و ابزارهای هوش مصنوعی، مهندسی‌شده برای مقیاس سازمانی.')}
        </p>
      </section>

      {featured.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 pb-16">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-600 mb-6">{L('Featured products', 'محصولات منتخب')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featured.map(p => (
              <Link key={p.id} href={`/${locale}/products/${p.slug}`}
                className="block p-6 rounded-2xl border border-indigo-500/20 hover:border-indigo-500/50 transition-all group" style={{ background: 'rgba(99,102,241,0.04)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">{TYPE_ICONS[p.type] || '📦'}</span>
                  <StatusBadge status={p.status} />
                </div>
                <h3 className="font-bold text-lg text-white group-hover:text-indigo-300 transition-colors mb-1">{localized(p, 'name', fa)}</h3>
                {p.currentVersion && <div className="text-xs text-slate-600 font-mono" dir="ltr">v{p.currentVersion}</div>}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="max-w-6xl mx-auto px-6 pb-24">
        {rest.length > 0 && <h2 className="text-xs font-bold uppercase tracking-widest text-slate-600 mb-6">{L('All products', 'همهٔ محصولات')}</h2>}
        {productList.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">🚀</div>
            <h3 className="text-xl font-bold mb-2">{L('Products coming soon', 'محصولات به‌زودی')}</h3>
            <p className="text-slate-500">{L('Our enterprise product catalog is being finalized.', 'کاتالوگ محصولات سازمانی در حال نهایی‌شدن است.')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rest.map(p => (
              <Link key={p.id} href={`/${locale}/products/${p.slug}`}
                className="block p-5 rounded-xl border border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xl">{TYPE_ICONS[p.type] || '📦'}</span>
                  <StatusBadge status={p.status} />
                </div>
                <h3 className="font-semibold text-white group-hover:text-indigo-300 transition-colors">{localized(p, 'name', fa)}</h3>
                {p.currentVersion && <div className="text-xs text-slate-600 font-mono mt-1" dir="ltr">v{p.currentVersion}</div>}
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
