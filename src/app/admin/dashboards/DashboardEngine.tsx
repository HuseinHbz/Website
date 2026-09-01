'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePointerDnd } from '@/lib/admin/pointerDnd'
import dynamic from 'next/dynamic'
import { Card, Btn, Badge, useToast } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import Link from 'next/link'
import { workspaceById } from '@/lib/admin/workspaces'
import { formatDateTime } from '@/lib/admin/datetime'

const WidgetChart = dynamic(() => import('./WidgetChart'), { ssr: false, loading: () => <div className="h-[180px] animate-pulse bg-white/[0.03] rounded" /> })

type Size = 'sm' | 'md' | 'lg'
interface WidgetConfig { refreshInterval?: number; warn?: number; critical?: number }
interface LayoutEntry { id: string; size: Size; config?: WidgetConfig }
interface Available { id: string; titleEn: string; titleFa: string; category: string; size: Size; icon: string }
type Payload =
  | { kind: 'kpi'; value: number; unit?: string; sub?: string; subFa?: string }
  | { kind: 'chart'; points: { x: string; y: number }[] }
  | { kind: 'table'; columns: { en: string; fa: string }[]; rows: (string | number)[][] }
  | { kind: 'list'; items: { level: string; text: string; textFa: string }[] }
  | { kind: 'ops'; metrics: { label: string; labelFa: string; value: string; pct?: number }[] }
  | { kind: 'empty' } | { kind: 'error'; message: string } | { kind: 'denied' }

const SPAN: Record<Size, string> = { sm: 'md:col-span-1', md: 'md:col-span-2', lg: 'md:col-span-4' }
const NEXT: Record<Size, Size> = { sm: 'md', md: 'lg', lg: 'sm' }
const LEVEL_COLOR: Record<string, string> = { critical: 'text-danger-text', warning: 'text-warning-text', ok: 'text-success-text' }
const fmt = (n: number, unit?: string) => `${unit === '$' ? '$' : ''}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`

export function DashboardEngine({ workspace }: { workspace: string }) {
  const t = useT()
  const locale = useAdminLocale()
  const isRTL = locale === 'fa'
  const { toast, ToastContainer } = useToast()
  const ws = workspaceById(workspace)
  const [layout, setLayout] = useState<LayoutEntry[]>([])
  const [available, setAvailable] = useState<Available[]>([])
  const [data, setData] = useState<Record<string, Payload>>({})
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [source, setSource] = useState<'user' | 'department' | 'role' | 'default'>('default')
  const [canSetRole, setCanSetRole] = useState(false)
  const [department, setDepartment] = useState<string | null>(null)
  const [templates, setTemplates] = useState<{ id: number; nameEn: string; nameFa: string | null; layout: LayoutEntry[] }[]>([])
  const [shared, setShared] = useState<{ id: number; ownerName: string | null; permission: string; layout: LayoutEntry[] }[]>([])
  const [tplMenu, setTplMenu] = useState(false)
  const dragId = useRef<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const meta = useMemo(() => Object.fromEntries(available.map(a => [a.id, a])), [available])

  const loadData = useCallback(async (ids: string[], fresh = false) => {
    if (ids.length === 0) { setData({}); return }
    try {
      const r = await fetch(`/api/admin/dashboards/data?ids=${ids.join(',')}${fresh ? '&fresh=1' : ''}`)
      const d = await r.json()
      setData(prev => ({ ...prev, ...(d.data ?? {}) }))
    } catch { /* individual cards show their own error state */ }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/admin/dashboards?workspace=${workspace}`)
      const d = await r.json()
      setLayout(d.layout ?? []); setAvailable(d.available ?? []); setSource(d.source ?? 'default'); setCanSetRole(!!d.canSetRole); setDepartment(d.department ?? null)
      await loadData((d.layout ?? []).map((e: LayoutEntry) => e.id), true)
      fetch(`/api/admin/dashboards/templates?workspace=${workspace}`).then(r => r.json()).then(x => setTemplates(x.templates ?? [])).catch(() => {})
      fetch(`/api/admin/dashboards/shares?workspace=${workspace}`).then(r => r.json()).then(x => setShared(x.shares ?? [])).catch(() => {})
    } catch { toast(t('dash_loadFail'), 'error') } finally { setLoading(false) }
  }, [workspace, loadData, toast, t])
  useEffect(() => { load() }, [load])

  async function saveTemplate() {
    const name = window.prompt(t('dash_tplName')); if (!name?.trim()) return
    const r = await fetch('/api/admin/dashboards/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nameEn: name.trim(), workspace, layout }) })
    if (r.ok) { toast(t('dash_tplSaved'), 'success'); fetch(`/api/admin/dashboards/templates?workspace=${workspace}`).then(x => x.json()).then(x => setTemplates(x.templates ?? [])) }
    else toast(t('dash_saveFail'), 'error')
  }
  function applyLayout(l: LayoutEntry[]) { setLayout(l); setDirty(true); setEdit(true); setTplMenu(false); loadData(l.map(e => e.id), true) }
  async function deleteTemplate(id: number) {
    if (!confirm(t('dash_confirmDelete'))) return
    const r = await fetch(`/api/admin/dashboards/templates?id=${id}`, { method: 'DELETE' })
    if (r.ok) setTemplates(ts => ts.filter(x => x.id !== id))
  }
  async function shareDashboard() {
    const targetType = window.prompt(t('dash_shareTarget')) as 'user' | 'role' | 'department' | null
    if (!targetType || !['user', 'role', 'department'].includes(targetType)) return
    const targetKey = window.prompt(t('dash_shareKey')); if (!targetKey?.trim()) return
    const permission = (window.prompt(t('dash_sharePerm'), 'view') || 'view').trim()
    const r = await fetch('/api/admin/dashboards/shares', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace, targetType, targetKey: targetKey.trim(), permission, layout }) })
    if (r.ok) toast(t('dash_shared'), 'success'); else toast(t('dash_saveFail'), 'error')
  }

  // Per-widget auto-refresh: each widget with a refreshInterval polls fresh data.
  // A polling seam that a future SSE/WebSocket feed can replace without redesign.
  useEffect(() => {
    const timers = layout
      .filter(e => e.config?.refreshInterval && e.config.refreshInterval > 0)
      .map(e => setInterval(() => loadData([e.id], true), e.config!.refreshInterval! * 1000))
    return () => timers.forEach(clearInterval)
  }, [layout, loadData])

  const inLayout = new Set(layout.map(e => e.id))
  const addable = available.filter(a => !inLayout.has(a.id))

  function addWidget(id: string) {
    const size = meta[id]?.size ?? 'sm'
    setLayout(l => [...l, { id, size }]); setDirty(true); setAddOpen(false)
    loadData([...layout.map(e => e.id), id])
  }
  function removeWidget(id: string) { setLayout(l => l.filter(e => e.id !== id)); setDirty(true) }
  function resizeWidget(id: string) { setLayout(l => l.map(e => e.id === id ? { ...e, size: NEXT[e.size] } : e)); setDirty(true) }
  function setRefresh(id: string, secs: number) {
    setLayout(l => l.map(e => e.id === id ? { ...e, config: { ...e.config, refreshInterval: secs || undefined } } : e)); setDirty(true)
  }

  // 26.32 — last remaining HTML5 drag in the admin: it never called
  // dataTransfer.setData (so the browser never started a drag) and did not work
  // on touch. Reuses the SAME pointer helper as the kanban and the DataTable.
  const widgetDrag = usePointerDnd<string>((fromId, targetId) => onDrop(targetId, fromId))

  function onDrop(targetId: string, fromId?: string) {
    const from = fromId ?? dragId.current; dragId.current = null
    if (!from || from === targetId) return
    setLayout(l => {
      const arr = [...l]
      const fi = arr.findIndex(e => e.id === from), ti = arr.findIndex(e => e.id === targetId)
      if (fi < 0 || ti < 0) return l
      const [m] = arr.splice(fi, 1); arr.splice(ti, 0, m); return arr
    })
    setDirty(true)
  }

  async function save(scope: 'user' | 'role' | 'department' = 'user') {
    try {
      const r = await fetch('/api/admin/dashboards', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace, layout, scope }) })
      if (!r.ok) throw new Error()
      toast(scope === 'role' ? t('dash_roleSaved') : t('dash_saved'), 'success'); setDirty(false)
      if (scope === 'user') setSource('user')
    } catch { toast(t('dash_saveFail'), 'error') }
  }
  async function reset() {
    if (!confirm(t('dash_confirmReset'))) return
    const r = await fetch(`/api/admin/dashboards?workspace=${workspace}`, { method: 'DELETE' })
    const d = await r.json().catch(() => ({}))
    if (r.ok) { setLayout(d.layout ?? []); setDirty(false); setSource(d.source ?? 'default'); loadData((d.layout ?? []).map((e: LayoutEntry) => e.id), true); toast(t('dash_resetDone'), 'success') }
  }
  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text())
      const imported = Array.isArray(parsed) ? parsed : parsed.layout
      if (!Array.isArray(imported)) throw new Error('bad file')
      setLayout(imported); setDirty(true); setEdit(true)
      loadData(imported.map((x: LayoutEntry) => x.id), true)
      toast(t('dash_imported'), 'success')
    } catch { toast(t('dash_importFail'), 'error') }
  }

  return (
    <div className="space-y-5" dir={isRTL ? 'rtl' : 'ltr'}>
      <ToastContainer />
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <span>{ws?.icon}</span>{isRTL ? ws?.nameFa : ws?.nameEn} — {t('dash_title')}
            <Badge color={source === 'user' ? 'green' : source === 'role' ? 'indigo' : 'slate'}>{t(`dash_src_${source}`)}</Badge>
          </h1>
          <p className="text-xs text-text-tertiary mt-0.5">{t('dash_subtitle')}</p>
        </div>
        <Btn variant="ghost" onClick={load}>{t('dash_refresh')}</Btn>
        <a href={`/api/admin/dashboards?workspace=${workspace}&export=1`} download className="inline-flex items-center gap-2 rounded-lg font-semibold h-9 px-4 py-2 text-sm bg-surface-2 hover:bg-surface text-text-primary border border-border hover:border-border-strong transition-all">{t('dash_export')}</a>
        <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg font-semibold h-9 px-4 py-2 text-sm bg-surface-2 hover:bg-surface text-text-primary border border-border hover:border-border-strong transition-all">{t('dash_import')}</button>
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={onImport} className="hidden" />
        <div className="relative">
          <button onClick={() => setTplMenu(o => !o)} className="inline-flex items-center gap-2 rounded-lg font-semibold h-9 px-4 py-2 text-sm bg-surface-2 hover:bg-surface text-text-primary border border-border hover:border-border-strong transition-all">{t('dash_templates')} ▾</button>
          {tplMenu && (
            <div className="absolute z-30 mt-1 end-0 w-72 rounded-lg bg-surface border border-border shadow-2xl py-1 max-h-80 overflow-y-auto">
              <button onClick={() => { setTplMenu(false); saveTemplate() }} className="w-full text-start px-3 py-2 text-sm text-brand hover:bg-white/5">+ {t('dash_saveTpl')}</button>
              {templates.length === 0 ? <p className="px-3 py-2 text-xs text-text-tertiary">{t('dash_noTpl')}</p> : templates.map(tp => (
                <div key={tp.id} className="flex items-center gap-1 px-3 py-2 hover:bg-white/5">
                  <button onClick={() => applyLayout(tp.layout)} className="flex-1 text-start text-sm text-text-secondary truncate">{isRTL && tp.nameFa ? tp.nameFa : tp.nameEn}</button>
                  <button onClick={() => deleteTemplate(tp.id)} className="text-xs text-danger-text px-1">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <Btn variant={edit ? 'primary' : 'secondary'} onClick={() => setEdit(e => !e)}>{edit ? t('dash_done') : t('dash_customize')}</Btn>
        {edit && dirty && <Btn onClick={() => save('user')}>{t('dash_save')}</Btn>}
        {edit && canSetRole && <Btn variant="secondary" onClick={() => save('role')}>{t('dash_saveRole')}</Btn>}
        {edit && canSetRole && department && <Btn variant="secondary" onClick={() => save('department')}>{t('dash_saveDept')}</Btn>}
        {edit && <Btn variant="secondary" onClick={shareDashboard}>{t('dash_share')}</Btn>}
        {edit && <Btn variant="danger" onClick={reset}>{t('dash_reset')}</Btn>}
      </div>

      {shared.length > 0 && (
        <Card className="p-3">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-text-tertiary">{t('dash_sharedWithMe')}:</span>
            {shared.map(s => (
              <button key={s.id} onClick={() => applyLayout(s.layout)} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 bg-brand/10 border border-brand/25 text-text-secondary hover:text-text-primary">
                <span>{s.ownerName ?? '—'}</span><span className="text-text-tertiary">· {s.permission}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {edit && (
        <Card className="p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-text-tertiary">{t('dash_addHint')}</span>
            <div className="relative">
              <Btn variant="secondary" onClick={() => setAddOpen(o => !o)} disabled={addable.length === 0}>+ {t('dash_addWidget')}</Btn>
              {addOpen && addable.length > 0 && (
                <div className="absolute z-20 mt-1 w-64 rounded-lg bg-surface border border-border shadow-2xl py-1 max-h-72 overflow-y-auto">
                  {addable.map(a => (
                    <button key={a.id} onClick={() => addWidget(a.id)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-start text-text-secondary hover:bg-white/5 hover:text-text-primary">
                      <span className="w-5 text-center">{a.icon}</span><span className="flex-1 truncate">{isRTL ? a.titleFa : a.titleEn}</span>
                      <span className="text-3xs text-text-tertiary uppercase">{a.category}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 rounded-2xl bg-white/[0.03] animate-pulse" />)}
        </div>
      ) : layout.length === 0 ? (
        // 26.7: workspaces without widgets (e.g. System Administration) show
        // their real module grid instead of a blank page — never an empty screen.
        <Card className="p-6">
          <p className="text-sm text-text-tertiary mb-4">{t('dash_empty')}</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {(workspaceById(workspace)?.groups ?? []).flatMap(g => g.items).map(it => (
              <Link key={it.href} href={it.href} className="rounded-xl p-4 bg-surface-2 border border-subtle hover:border-brand/50 transition-colors">
                <div className="text-lg mb-1" aria-hidden>{it.icon}</div>
                <div className="text-xs font-medium text-text-secondary">{locale === 'fa' ? it.labelFa : it.labelEn}</div>
              </Link>
            ))}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {layout.map(entry => {
            const m = meta[entry.id]
            const payload = data[entry.id]
            return (
              <div
                key={entry.id}
                {...(edit ? widgetDrag.zoneProps(entry.id) : {})}
                {...(edit ? { onPointerDown: widgetDrag.dragHandlers(entry.id, entry.id).onPointerDown } : {})}
                style={edit ? widgetDrag.dragHandlers(entry.id, entry.id).style : undefined}
                className={`${SPAN[entry.size]} ${edit ? 'cursor-move' : ''} ${edit && widgetDrag.overZone === entry.id ? 'ring-2 ring-brand rounded-xl' : ''}`}
              >
                <Card className="p-4 h-full">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-base">{m?.icon}</span>
                    <h3 className="text-sm font-semibold text-text-primary flex-1 truncate">{m ? (isRTL ? m.titleFa : m.titleEn) : entry.id}</h3>
                    {edit && (
                      <div className="flex items-center gap-1">
                        <select
                          value={entry.config?.refreshInterval ?? 0}
                          onChange={e => setRefresh(entry.id, Number(e.target.value))}
                          title={t('dash_refreshEvery')}
                          aria-label={t('dash_refreshEvery')}
                          className="text-3xs bg-white/[0.04] border border-white/[0.08] rounded px-1 py-0.5 text-text-tertiary outline-none"
                        >
                          <option value={0}>{t('dash_refreshOff')}</option>
                          <option value={30}>30s</option>
                          <option value={60}>60s</option>
                          <option value={300}>5m</option>
                        </select>
                        <button onClick={() => resizeWidget(entry.id)} title={t('dash_resize')} className="text-xs text-text-tertiary hover:text-text-primary px-1">⤢</button>
                        <button onClick={() => removeWidget(entry.id)} title={t('dash_remove')} className="text-xs text-danger-text hover:opacity-80 px-1">✕</button>
                      </div>
                    )}
                  </div>
                  <WidgetBody payload={payload} t={t} locale={locale} />
                </Card>
              </div>
            )
          })}
        </div>
      )}
      <p className="text-xs text-text-tertiary">{t('dash_footnote')}</p>
    </div>
  )
}

function WidgetBody({ payload, t, locale }: { payload: Payload | undefined; t: (k: string) => string; locale: string }) {
  if (!payload) return <div className="h-16 animate-pulse bg-white/[0.03] rounded" />
  switch (payload.kind) {
    case 'denied': return <p className="text-xs text-text-tertiary py-4">{t('dash_denied')}</p>
    case 'error': return <p className="text-xs text-danger-text py-4">{t('dash_error')}</p>
    case 'empty': return <p className="text-xs text-text-tertiary py-4">{t('dash_noData')}</p>
    case 'kpi': {
      const sub = locale === 'fa' ? (payload.subFa ?? payload.sub) : payload.sub
      return (
        <div>
          <p className="text-3xl font-bold text-text-primary tracking-tight">{fmt(payload.value, payload.unit)}</p>
          {sub && <p className="text-xs text-text-tertiary mt-1">{sub}</p>}
        </div>
      )
    }
    case 'chart': return <WidgetChart points={payload.points} locale={locale} />
    case 'ops': return (
      <div className="space-y-2">
        {payload.metrics.map(m => (
          <div key={m.label} className="flex items-center gap-2 text-sm">
            <span className="w-28 shrink-0 text-text-secondary">{locale === 'fa' ? m.labelFa : m.label}</span>
            {m.pct != null ? (
              <div className="flex-1 h-2 rounded bg-white/[0.05] overflow-hidden"><div className="h-full rounded bg-brand" style={{ width: `${Math.min(100, m.pct)}%` }} /></div>
            ) : <div className="flex-1" />}
            <span className="w-14 text-end tabular-nums text-text-primary">{m.value}</span>
          </div>
        ))}
      </div>
    )
    case 'list': return (
      <ul className="space-y-1.5">
        {payload.items.slice(0, 8).map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className={`text-xs mt-0.5 ${LEVEL_COLOR[it.level] ?? 'text-text-tertiary'}`}>●</span>
            <span className="text-text-secondary">{locale === 'fa' ? it.textFa : it.text}</span>
          </li>
        ))}
      </ul>
    )
    case 'table': return (
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="text-text-tertiary">{payload.columns.map(c => <th key={c.en} className="text-start font-medium py-1 pe-3">{locale === 'fa' ? c.fa : c.en}</th>)}</tr></thead>
          <tbody>{payload.rows.map((row, i) => <tr key={i} className="border-t border-border/40">{row.map((c, j) => <td key={j} className="py-1.5 pe-3 text-text-secondary truncate max-w-[160px]">{j === 0 ? formatDateTime(String(c), locale === 'fa' ? 'fa' : 'en') : c}</td>)}</tr>)}</tbody>
        </table>
      </div>
    )
  }
}
