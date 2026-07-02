'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

type Result = { type: string; id: number; slug: string; title: string; excerpt: string; score: number }

const TYPE_ICONS: Record<string, string> = { knowledge: '💡', docs: '📄', product: '📦', course: '🎓', solution: '🔧', project: '🏗️', blog: '✍️', event: '📅' }
const TYPE_PATHS: Record<string, string> = { knowledge: '/knowledge', docs: '/docs', product: '/products', course: '/academy', solution: '/solutions', project: '/projects', blog: '/blog', event: '/events' }

function SearchContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [activeTypes, setActiveTypes] = useState<string[]>([])

  const search = useCallback(async (q: string, types: string[]) => {
    if (!q.trim()) { setResults([]); setTotal(0); return }
    setLoading(true)
    try {
      const params = new URLSearchParams({ q, limit: '30' })
      if (types.length) params.set('types', types.join(','))
      const r = await fetch(`/api/search?${params}`)
      if (r.ok) {
        const data = await r.json()
        setResults(data.results || [])
        setTotal(data.total || 0)
      }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const q = searchParams.get('q') || ''
    setQuery(q)
    search(q, activeTypes)
  }, [searchParams, activeTypes, search])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    router.push(`?q=${encodeURIComponent(query)}`)
  }

  const types = Object.keys(TYPE_ICONS)

  return (
    <main className="min-h-screen bg-background text-white">
      <section className="pt-32 pb-12 px-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-black mb-6 text-center">Search Everything</h1>
          <form onSubmit={handleSubmit}>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-lg">🔍</span>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search knowledge, docs, products, courses, events..."
                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white/5 border border-slate-700 text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-colors text-lg"
                autoFocus
              />
              <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-colors">Search</button>
            </div>
          </form>

          <div className="flex flex-wrap gap-2 mt-4">
            {types.map(t => (
              <button key={t} onClick={() => setActiveTypes(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t])}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTypes.includes(t) ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400 hover:text-white'}`}>
                {TYPE_ICONS[t]} {t}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 pb-24">
        {loading && <div className="text-center py-12 text-slate-500">Searching…</div>}

        {!loading && query && results.length === 0 && (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🔍</div>
            <h3 className="text-lg font-bold mb-2">No results for &quot;{query}&quot;</h3>
            <p className="text-slate-500 text-sm">Try different keywords or remove filters.</p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <>
            <div className="text-sm text-slate-500 mb-4">{total} results for &quot;{query}&quot;</div>
            <div className="space-y-3">
              {results.map((r, i) => (
                <Link key={i} href={`/en${TYPE_PATHS[r.type] || ''}/${r.slug}`}
                  className="block p-5 rounded-xl border border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all group">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm">{TYPE_ICONS[r.type] || '📄'}</span>
                    <span className="text-xs text-slate-600 capitalize">{r.type}</span>
                  </div>
                  <h3 className="font-semibold text-white group-hover:text-indigo-300 transition-colors mb-1">{r.title}</h3>
                  {r.excerpt && <p className="text-sm text-slate-500 line-clamp-2">{r.excerpt}</p>}
                </Link>
              ))}
            </div>
          </>
        )}

        {!loading && !query && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🌐</div>
            <h3 className="text-lg font-bold mb-2">Search Across All Content</h3>
            <p className="text-slate-500 text-sm">Knowledge base, documentation, products, courses, blog posts, events and more.</p>
          </div>
        )}
      </section>
    </main>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center text-slate-500">Loading…</div>}>
      <SearchContent />
    </Suspense>
  )
}
