'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card, Btn, Badge, PageHeader, useToast } from '@/components/admin/ui'
import { useAdminLocale } from '@/lib/admin/locale'
import { DataTable } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'

/* ── Types ───────────────────────────────────────────────────────────────── */
type Level = 'debug' | 'info' | 'warn' | 'error'
interface LogEntry {
  id?: number; ts: string; level: Level; source: string; service: string
  message: string; stacktrace?: string | null; requestId?: string | null; userId?: string | null
  fingerprint?: string; meta?: unknown
}
interface Group { fingerprint: string; level: Level; source: string; service: string; count: number; lastTs: string; message: string }
interface EngineStatus {
  running: boolean
  encryption: { algo: string; dedicatedKey: boolean }
  strategy: { storageTypes: number; mirror: boolean; offsite: boolean; rule321Met: boolean; copiesLatest: number; adapters: string[] }
  totals: { total: number; size: number; ok: number; failed: number; verified: number }
  latest: { version: string; status: string; verified: number; started_at: string; trigger: string } | null
  alerts: { level: string; message: string; count: number; at: string }[]
}

const LEVELS: (Level | 'all')[] = ['all', 'debug', 'info', 'warn', 'error']
const MAX_LIVE = 2000

const levelClass: Record<Level, string> = {
  debug: 'text-text-tertiary',
  info: 'text-text-secondary',
  warn: 'text-warning',
  error: 'text-danger',
}
const levelBadge: Record<Level, string> = { debug: 'slate', info: 'blue', warn: 'yellow', error: 'red' }

function fmtTime(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleTimeString(undefined, { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0')
}
function fmtBytes(n: number): string {
  if (!n) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB']; const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  return `${(n / 1024 ** i).toFixed(1)} ${u[i]}`
}

export function LogsMonitoring() {
  const logsLocale = useAdminLocale()
  const { toast, ToastContainer } = useToast()
  const [mode, setMode] = useState<'live' | 'history'>('live')
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [history, setHistory] = useState<LogEntry[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [grouped, setGrouped] = useState(false)
  const [paused, setPaused] = useState(false)
  const [connected, setConnected] = useState(false)
  const [pending, setPending] = useState(0)
  const [facets, setFacets] = useState<{ sources: string[]; services: string[] }>({ sources: [], services: [] })
  const [engine, setEngine] = useState<EngineStatus | null>(null)

  // Filters
  const [level, setLevel] = useState<Level | 'all'>('all')
  const [source, setSource] = useState('all')
  const [service, setService] = useState('all')
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const pausedRef = useRef(paused); pausedRef.current = paused
  const filterRef = useRef({ level, source, service, q })
  filterRef.current = { level, source, service, q }
  const pendingBuf = useRef<LogEntry[]>([])
  const consoleRef = useRef<HTMLDivElement>(null)

  const matches = useCallback((e: LogEntry) => {
    const f = filterRef.current
    if (f.level !== 'all' && e.level !== f.level) return false
    if (f.source !== 'all' && e.source !== f.source) return false
    if (f.service !== 'all' && e.service !== f.service) return false
    if (f.q && !(`${e.message} ${e.stacktrace ?? ''}`.toLowerCase().includes(f.q.toLowerCase()))) return false
    return true
  }, [])

  /* ── Live SSE stream ───────────────────────────────────────────────────── */
  useEffect(() => {
    if (mode !== 'live') return
    const es = new EventSource('/api/admin/logs/stream')
    es.onopen = () => setConnected(true)
    es.onerror = () => setConnected(false)
    es.onmessage = (ev) => {
      let entry: LogEntry
      try { entry = JSON.parse(ev.data) } catch { return }
      if (!entry.level) return
      if (pausedRef.current) { pendingBuf.current.push(entry); setPending((n) => n + 1); return }
      setEntries((prev) => {
        const next = [...prev, entry]
        return next.length > MAX_LIVE ? next.slice(next.length - MAX_LIVE) : next
      })
    }
    return () => { es.close(); setConnected(false) }
  }, [mode])

  // Auto-scroll to newest unless the user scrolled up.
  useEffect(() => {
    const el = consoleRef.current
    if (!el || paused) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (nearBottom) el.scrollTop = el.scrollHeight
  }, [entries, paused])

  function resume() {
    setEntries((prev) => {
      const merged = [...prev, ...pendingBuf.current]
      return merged.length > MAX_LIVE ? merged.slice(merged.length - MAX_LIVE) : merged
    })
    pendingBuf.current = []
    setPending(0)
    setPaused(false)
  }

  /* ── Engine status (backup + alerts) ───────────────────────────────────── */
  const loadEngine = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/backup/engine')
      if (r.ok) setEngine(await r.json())
    } catch { /* ignore */ }
  }, [])
  useEffect(() => {
    loadEngine()
    const id = setInterval(loadEngine, 8000)
    return () => clearInterval(id)
  }, [loadEngine])

  /* ── History query ─────────────────────────────────────────────────────── */
  const queryParams = useCallback(() => {
    const p = new URLSearchParams()
    if (level !== 'all') p.set('level', level)
    if (source !== 'all') p.set('source', source)
    if (service !== 'all') p.set('service', service)
    if (q) p.set('q', q)
    if (from) p.set('from', new Date(from).toISOString())
    if (to) p.set('to', new Date(to).toISOString())
    return p
  }, [level, source, service, q, from, to])

  const runQuery = useCallback(async () => {
    const p = queryParams()
    if (grouped) {
      p.set('group', '1')
      const r = await fetch(`/api/admin/logs/query?${p}`)
      if (r.ok) { const d = await r.json(); setGroups(d.groups ?? []) }
      return
    }
    p.set('limit', '500')
    const r = await fetch(`/api/admin/logs/query?${p}`)
    if (r.ok) {
      const d = await r.json()
      setHistory(d.entries ?? [])
      if (d.facets) setFacets(d.facets)
    }
  }, [queryParams, grouped])

  useEffect(() => { if (mode === 'history') runQuery() }, [mode, grouped, runQuery])
  // Load facets once for the filter dropdowns.
  useEffect(() => { fetch('/api/admin/logs/query?limit=1').then((r) => r.ok && r.json()).then((d) => d?.facets && setFacets(d.facets)).catch(() => {}) }, [])

  async function runBackup() {
    try {
      const r = await fetch('/api/admin/backup/run', { method: 'POST' })
      if (r.status === 202) { toast('Backup started — watch the stream', 'success'); setMode('live') }
      else if (r.status === 409) toast('A backup is already running', 'error')
      else throw new Error()
    } catch { toast('Failed to start backup', 'error') }
  }

  const exportUrl = (format: 'json' | 'csv') => {
    const p = queryParams(); p.set('format', format)
    return `/api/admin/logs/export?${p}`
  }

  const visibleLive = useMemo(() => entries.filter(matches), [entries, matches])
  const criticalCount = (engine?.alerts ?? []).filter((a) => a.level === 'critical').length

  const rows = mode === 'live' ? visibleLive : history

  return (
    <>
      <ToastContainer />
      <PageHeader
        title="Logs & Monitoring"
        action={
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 text-xs ${connected ? 'text-success' : 'text-text-tertiary'}`}>
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-success animate-pulse' : 'bg-text-disabled'}`} />
              {connected ? 'Live' : 'Disconnected'}
            </span>
            <Btn size="sm" variant="secondary" onClick={runBackup}>Run backup now</Btn>
          </div>
        }
      />

      {/* ── Backup engine + alerts strip ─────────────────────────────────── */}
      {engine && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
          <StatTile label="Engine" value={engine.running ? 'Running' : 'Idle'} tone={engine.running ? 'ok' : undefined} />
          <StatTile label="3-2-1" value={engine.strategy.rule321Met ? 'Met' : 'Partial'} sub={engine.strategy.adapters.join(' · ')} tone={engine.strategy.rule321Met ? 'ok' : 'warn'} />
          <StatTile label="Backups" value={String(engine.totals.total)} sub={`${engine.totals.verified} verified · ${fmtBytes(engine.totals.size)}`} />
          <StatTile label="Failures" value={String(engine.totals.failed)} tone={engine.totals.failed > 0 ? 'bad' : 'ok'} />
          <StatTile label="Alerts" value={String(engine.alerts.length)} sub={criticalCount ? `${criticalCount} critical` : 'nominal'} tone={criticalCount ? 'bad' : engine.alerts.length ? 'warn' : 'ok'} />
        </div>
      )}
      {engine && engine.alerts.length > 0 && (
        <Card className="p-4 mb-4 border-danger/40">
          <h3 className="text-sm font-semibold text-danger mb-2">⚠ Active Alerts</h3>
          <ul className="space-y-1">
            {engine.alerts.slice(0, 8).map((a, i) => (
              <li key={i} className="text-xs text-text-secondary flex items-center gap-2">
                <Badge color={a.level === 'critical' ? 'red' : 'yellow'}>{a.level}</Badge>
                <span className="truncate">{a.message}</span>
                <span className="text-text-tertiary">×{a.count}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg bg-background border border-border overflow-hidden">
            <button onClick={() => setMode('live')} className={`px-3 py-1.5 text-xs font-medium ${mode === 'live' ? 'bg-brand text-white' : 'text-text-secondary'}`}>Live</button>
            <button onClick={() => setMode('history')} className={`px-3 py-1.5 text-xs font-medium ${mode === 'history' ? 'bg-brand text-white' : 'text-text-secondary'}`}>History</button>
          </div>

          <select value={level} onChange={(e) => setLevel(e.target.value as Level | 'all')} className="bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary">
            {LEVELS.map((l) => <option key={l} value={l}>{l === 'all' ? 'All levels' : l.toUpperCase()}</option>)}
          </select>
          <select value={source} onChange={(e) => setSource(e.target.value)} className="bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary">
            <option value="all">All sources</option>
            {facets.sources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={service} onChange={(e) => setService(e.target.value)} className="bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary">
            <option value="all">All services</option>
            {facets.services.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="flex-1 min-w-[160px] bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary placeholder-text-disabled" />

          {mode === 'history' && (
            <>
              <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary" />
              <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} className="bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary" />
              <Btn size="sm" variant="secondary" onClick={runQuery}>Search</Btn>
              <label className="flex items-center gap-1.5 text-xs text-text-secondary"><input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} /> Group errors</label>
            </>
          )}

          {mode === 'live' && (
            paused
              ? <Btn size="sm" onClick={resume}>▶ Resume{pending > 0 ? ` (${pending})` : ''}</Btn>
              : <Btn size="sm" variant="secondary" onClick={() => setPaused(true)}>⏸ Pause</Btn>
          )}

          <a href={exportUrl('json')} download><Btn size="sm" variant="secondary">↓ JSON</Btn></a>
          <a href={exportUrl('csv')} download><Btn size="sm" variant="secondary">↓ CSV</Btn></a>
        </div>
      </Card>

      {/* ── Console / grouped view ───────────────────────────────────────── */}
      {mode === 'history' && grouped ? (
        <Card className="p-4">
          <DataTable
            tableId="logs-groups"
            columns={[
              { key: 'count', labelEn: 'Count', labelFa: 'تعداد', type: 'number', numeric: true, render: g => <span className="font-bold text-text-primary">{g.count}</span> },
              { key: 'level', labelEn: 'Level', labelFa: 'سطح', type: 'enum', render: g => <Badge color={levelBadge[g.level]}>{g.level}</Badge> },
              { key: 'source', labelEn: 'Source', labelFa: 'منبع', type: 'enum', render: g => <span className="text-text-tertiary">{g.source}</span> },
              { key: 'message', labelEn: 'Message', labelFa: 'پیام', render: g => <span className={`font-mono ${levelClass[g.level]}`}>{g.message}</span> },
              { key: 'lastTs', labelEn: 'Last seen', labelFa: 'آخرین', type: 'date', render: g => <span className="text-text-tertiary">{fmtTime(g.lastTs)}</span> },
            ] as Column<Group>[]}
            rows={groups}
            locale={logsLocale}
            rowKey={g => g.fingerprint}
            exportName="log-groups"
            emptyLabel="No matching log groups."
          />
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div ref={consoleRef} className="font-mono text-xs leading-relaxed overflow-y-auto max-h-[62vh] bg-sunken p-3">
            {rows.length === 0 ? (
              <p className="text-text-tertiary p-4">{mode === 'live' ? 'Waiting for log events…' : 'No logs match the filters.'}</p>
            ) : rows.map((e, i) => (
              <div key={e.id ?? `${e.ts}-${i}`} className={`flex gap-2 py-0.5 px-1 ${e.level === 'error' ? 'bg-danger/5' : ''}`}>
                <span className="text-text-disabled shrink-0 w-24">{fmtTime(e.ts)}</span>
                <span className={`shrink-0 w-12 uppercase font-semibold ${levelClass[e.level]}`}>{e.level}</span>
                <span className="text-brand shrink-0 w-28 truncate" title={`${e.source}/${e.service}`}>{e.source}</span>
                <span className={`flex-1 break-all ${e.level === 'error' ? 'text-danger' : 'text-text-primary'}`}>
                  {e.message}
                  {e.stacktrace && <span className="block text-text-tertiary whitespace-pre-wrap">{e.stacktrace}</span>}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between px-3 py-1.5 border-t border-subtle text-2xs text-text-tertiary">
            <span>{rows.length} entries{mode === 'live' ? ` · ${entries.length} buffered` : ''}</span>
            <span>{mode === 'live' ? (paused ? 'paused' : 'streaming') : 'history'}</span>
          </div>
        </Card>
      )}
    </>
  )
}

function StatTile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'ok' | 'warn' | 'bad' }) {
  const ring = tone === 'ok' ? 'border-success/40' : tone === 'warn' ? 'border-warning/40' : tone === 'bad' ? 'border-danger/40' : 'border-subtle'
  return (
    <div className={`rounded-xl p-3 bg-surface-2 border ${ring}`}>
      <p className="text-2xs text-text-tertiary mb-0.5">{label}</p>
      <p className="text-lg font-bold text-text-primary">{value}</p>
      {sub && <p className="text-3xs text-text-tertiary truncate">{sub}</p>}
    </div>
  )
}
