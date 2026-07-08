'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Card, Input, PageHeader, Badge, useToast } from '@/components/admin/ui'
import { useT } from '@/lib/admin/locale'

interface Hit { module: string; type: string; id: number | string; title: string; subtitle?: string; url: string; score: number }
interface Group { module: string; hits: Hit[] }

const MODULE_META: Record<string, { icon: string; color: string }> = {
  crm: { icon: '📇', color: 'blue' },
  sales: { icon: '🛒', color: 'green' },
  finance: { icon: '💰', color: 'yellow' },
  inventory: { icon: '📦', color: 'indigo' },
  assets: { icon: '🖧', color: 'slate' },
  projects: { icon: '📋', color: 'blue' },
  documents: { icon: '📄', color: 'slate' },
  workflows: { icon: '🔀', color: 'indigo' },
  rules: { icon: '⚖️', color: 'yellow' },
  integrations: { icon: '🔌', color: 'green' },
}

export function GlobalSearch() {
  const t = useT()
  const { toast, ToastContainer } = useToast()
  const [q, setQ] = useState('')
  const [modules, setModules] = useState<string[]>([])
  const [filter, setFilter] = useState<string[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/admin/search')
      .then(r => r.json())
      .then(d => setModules(d.modules ?? []))
      .catch(() => {})
  }, [])

  const run = useCallback(async (query: string, mods: string[]) => {
    if (query.trim().length < 2) { setGroups([]); setTotal(0); setSearched(false); return }
    setLoading(true)
    try {
      const url = `/api/admin/search?q=${encodeURIComponent(query)}${mods.length ? `&modules=${mods.join(',')}` : ''}`
      const r = await fetch(url)
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'failed')
      setGroups(d.groups ?? []); setTotal(d.total ?? 0); setSearched(true)
    } catch { toast(t('gs_fail'), 'error') } finally { setLoading(false) }
  }, [toast, t])

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => run(q, filter), 250)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [q, filter, run])

  const toggle = (m: string) => setFilter(f => f.includes(m) ? f.filter(x => x !== m) : [...f, m])

  const moduleLabel = useCallback((m: string) => t(`gs_mod_${m}`), [t])
  const hasQuery = q.trim().length >= 2
  const emptyResult = useMemo(() => searched && total === 0 && !loading, [searched, total, loading])

  return (
    <div className="space-y-6">
      <ToastContainer />
      <PageHeader title={t('gs_title')} subtitle={t('gs_subtitle')} />

      <Card className="p-4 space-y-4">
        <Input
          value={q}
          onChange={setQ}
          placeholder={t('gs_placeholder')}
        />
        <div className="flex flex-wrap gap-2">
          {modules.map(m => {
            const on = filter.includes(m)
            return (
              <button
                key={m}
                onClick={() => toggle(m)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                  on ? 'bg-brand text-white border-brand' : 'bg-surface-2 text-text-secondary border-border hover:border-border-strong'
                }`}
              >
                <span aria-hidden>{MODULE_META[m]?.icon ?? '•'}</span>{moduleLabel(m)}
              </button>
            )
          })}
          {filter.length > 0 && (
            <button onClick={() => setFilter([])} className="text-xs text-text-tertiary hover:text-text-primary underline">
              {t('gs_clearFilter')}
            </button>
          )}
        </div>
      </Card>

      {loading && <p className="text-sm text-text-tertiary">{t('gs_searching')}</p>}

      {searched && total > 0 && (
        <p className="text-sm text-text-secondary">{t('gs_results')}: <span className="font-semibold text-text-primary">{total}</span></p>
      )}

      {emptyResult && (
        <Card className="p-8 text-center">
          <p className="text-text-tertiary text-sm">{t('gs_noResults')} “{q}”.</p>
        </Card>
      )}

      {!hasQuery && !loading && (
        <Card className="p-8 text-center">
          <p className="text-text-tertiary text-sm">{t('gs_hint')}</p>
        </Card>
      )}

      <div className="space-y-5">
        {groups.map(g => (
          <div key={g.module}>
            <div className="flex items-center gap-2 mb-2">
              <span aria-hidden>{MODULE_META[g.module]?.icon ?? '•'}</span>
              <h3 className="text-sm font-semibold text-text-primary">{moduleLabel(g.module)}</h3>
              <Badge color={MODULE_META[g.module]?.color ?? 'slate'}>{g.hits.length}</Badge>
            </div>
            <Card className="p-0 overflow-hidden divide-y divide-border/50">
              {g.hits.map(h => (
                <Link
                  key={`${h.type}-${h.id}`}
                  href={h.url}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/[0.025] transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{h.title}</p>
                    {h.subtitle && <p className="text-xs text-text-tertiary truncate">{h.subtitle}</p>}
                  </div>
                  <span className="shrink-0 text-2xs uppercase tracking-wide text-text-tertiary">{t(`gs_type_${h.type}`)}</span>
                </Link>
              ))}
            </Card>
          </div>
        ))}
      </div>

      <p className="text-xs text-text-tertiary">{t('gs_footnote')}</p>
    </div>
  )
}
