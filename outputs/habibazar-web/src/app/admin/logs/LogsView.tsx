'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, Btn, PageHeader } from '@/components/admin/ui'

interface LogEntry {
  ts: string | null
  level: 'debug' | 'info' | 'warn' | 'error'
  msg: string
  source: 'out' | 'error'
  raw: string
}

const LEVEL_STYLE: Record<string, string> = {
  error: 'text-danger-text border-danger/30 bg-danger-muted',
  warn: 'text-warning-text border-warning/30 bg-warning-muted',
  info: 'text-info-text border-info/25 bg-info-muted',
  debug: 'text-text-tertiary border-border bg-surface',
}

export function LogsView() {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [dir, setDir] = useState('')
  const [available, setAvailable] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [auto, setAuto] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch('/api/admin/logs?lines=500')
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed to load logs')
      setEntries(d.entries || [])
      setDir(d.dir || '')
      setAvailable(!!d.available)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load logs')
    } finally {
      setLoading(false)
    }
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!auto) return
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [auto, load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return entries.filter((e) => {
      if (levelFilter !== 'all' && e.level !== levelFilter) return false
      if (q && !e.raw.toLowerCase().includes(q)) return false
      return true
    })
  }, [entries, levelFilter, search])

  const counts = useMemo(() => {
    const c = { error: 0, warn: 0, info: 0, debug: 0 }
    for (const e of entries) c[e.level]++
    return c
  }, [entries])

  return (
    <>
      <PageHeader title="System Logs" subtitle="Application stdout/stderr captured by PM2 — errors, warnings and info." />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {(['all', 'error', 'warn', 'info', 'debug'] as const).map((lv) => (
            <button
              key={lv}
              onClick={() => setLevelFilter(lv)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${levelFilter === lv ? 'bg-brand text-white' : 'text-text-secondary hover:text-white'}`}
            >
              {lv}{lv !== 'all' && lv in counts ? ` (${counts[lv as keyof typeof counts]})` : ''}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search logs…"
          className="flex-1 min-w-[180px] bg-background border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand"
        />
        <label className="flex items-center gap-2 text-xs text-text-secondary select-none">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
          Auto-refresh (5s)
        </label>
        <Btn onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</Btn>
      </div>

      <Card className="p-0 overflow-hidden">
        {error ? (
          <p className="p-5 text-sm text-danger-text">{error}</p>
        ) : !available ? (
          <div className="p-5 text-sm text-text-tertiary">
            No log files found in <span className="font-mono text-text-secondary">{dir}</span>.
            On the server these are written by PM2; set <span className="font-mono">PM2_LOG_DIR</span> if your path differs.
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-5 text-sm text-text-tertiary">No matching log lines.</p>
        ) : (
          <div className="max-h-[65vh] overflow-auto divide-y divide-border font-mono text-xs">
            {filtered.map((e, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-2 hover:bg-surface/50">
                <span className={`shrink-0 px-1.5 py-0.5 rounded border text-[10px] uppercase ${LEVEL_STYLE[e.level] || LEVEL_STYLE.info}`}>
                  {e.level}
                </span>
                {e.ts && <span className="shrink-0 text-text-tertiary">{new Date(e.ts).toLocaleTimeString()}</span>}
                <span className="text-text-secondary break-all whitespace-pre-wrap">{e.msg}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
      <p className="mt-3 text-xs text-text-tertiary">Showing the latest 500 lines from <span className="font-mono">{dir}</span>.</p>
    </>
  )
}
