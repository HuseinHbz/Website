import { Metadata } from 'next'
import Link from 'next/link'
import { getDb } from '@/lib/db'
import { products } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'

export const metadata: Metadata = {
  title: 'Products & Platform | HBZ Technology',
  description: 'Enterprise infrastructure, security, monitoring, and AI tools built for modern organizations.',
}

const TYPE_ICONS: Record<string, string> = { hardware: '🖥️', software: '💿', service: '☁️', subscription: '🔁', license: '🔑', saas: '🚀' }
const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  active: { bg: '#22c55e20', text: '#22c55e' },
  beta: { bg: '#f59e0b20', text: '#f59e0b' },
  coming_soon: { bg: '#6366f120', text: '#6366f1' },
  deprecated: { bg: '#64748b20', text: '#64748b' },
  archived: { bg: '#64748b20', text: '#64748b' },
}

export default async function ProductsPage() {
  let productList: { id: number; slug: string; nameEn: string; type: string; status: string; currentVersion: string | null; featured: boolean }[] = []
  try {
    const db = getDb()
    const rows = await db.select({
      id: products.id, slug: products.slug, nameEn: products.nameEn, type: products.type,
      status: products.status, currentVersion: products.currentVersion, featured: products.featured,
    }).from(products).orderBy(desc(products.featured), products.nameEn)
    productList = rows
  } catch {}

  const featured = productList.filter(p => p.featured)
  const rest = productList.filter(p => !p.featured)

  return (
    <main className="min-h-screen bg-background text-white">
      <section className="pt-32 pb-16 px-6 text-center">
        <h1 className="text-5xl md:text-6xl font-black mb-4">Enterprise Platform</h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto">Infrastructure, security, monitoring, and AI tools engineered for enterprise scale.</p>
      </section>

      {featured.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 pb-16">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-600 mb-6">Featured Products</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featured.map(p => {
              const s = STATUS_STYLES[p.status] || STATUS_STYLES.active
              return (
                <Link key={p.id} href={`/en/products/${p.slug}`}
                  className="block p-6 rounded-2xl border border-indigo-500/20 hover:border-indigo-500/50 transition-all group" style={{ background: 'rgba(99,102,241,0.04)' }}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-2xl">{TYPE_ICONS[p.type] || '📦'}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: s.bg, color: s.text }}>{p.status}</span>
                  </div>
                  <h3 className="font-bold text-lg text-white group-hover:text-indigo-300 transition-colors mb-1">{p.nameEn}</h3>
                  {p.currentVersion && <div className="text-xs text-slate-600 font-mono">v{p.currentVersion}</div>}
                </Link>
              )
            })}
          </div>
        </section>
      )}

      <section className="max-w-6xl mx-auto px-6 pb-24">
        {rest.length > 0 && <h2 className="text-xs font-bold uppercase tracking-widest text-slate-600 mb-6">All Products</h2>}
        {productList.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">🚀</div>
            <h3 className="text-xl font-bold mb-2">Products Coming Soon</h3>
            <p className="text-slate-500">Our enterprise product catalog is being finalized.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rest.map(p => {
              const s = STATUS_STYLES[p.status] || STATUS_STYLES.active
              return (
                <Link key={p.id} href={`/en/products/${p.slug}`}
                  className="block p-5 rounded-xl border border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all group">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xl">{TYPE_ICONS[p.type] || '📦'}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: s.bg, color: s.text }}>{p.status}</span>
                  </div>
                  <h3 className="font-semibold text-white group-hover:text-indigo-300 transition-colors">{p.nameEn}</h3>
                  {p.currentVersion && <div className="text-xs text-slate-600 font-mono mt-1">v{p.currentVersion}</div>}
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
