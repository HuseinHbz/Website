'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  filterRows, multiSortRows, nextMultiSort, paginate, applyColumnFilters, groupRows,
  toggleSelect, rangeSelect, invertSelection, selectionState, applyColumnView, cellValue,
  type Column, type Row, type SortSpec, type ColumnFilter, type TableView,
} from '@/lib/admin/dataTable'
import { toCsv, toJson, toExcelXml, exportColumns } from '@/lib/admin/dataTableExport'
import { usePointerDnd } from '@/lib/admin/pointerDnd'

// ── Public action contracts ─────────────────────────────────────────────────
export interface RowAction<T extends object> {
  id: string
  labelEn: string; labelFa: string
  icon?: string
  danger?: boolean
  /** RBAC action required to show this (checked via `can`). */
  requires?: string
  onClick: (row: T) => void
  hidden?: (row: T) => boolean
}
export interface BulkAction<T extends object> {
  id: string
  labelEn: string; labelFa: string
  icon?: string
  danger?: boolean
  requires?: string
  confirmEn?: string; confirmFa?: string
  run: (ids: string[], rows: T[]) => void | Promise<void>
}
export type ExportScope = 'page' | 'filtered' | 'selected' | 'all'

interface Props<T extends object> {
  columns: Column<T>[]
  rows: T[]
  locale: 'fa' | 'en'
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  onRefresh?: () => void
  pageSize?: number
  searchKeys?: string[]
  rowKey?: (row: T) => string
  emptyLabel?: string
  onRowClick?: (row: T) => void
  title?: string
  /** Enables per-user persistence (column layout + saved views) + scoped export names. */
  tableId?: string
  /** Caller's role — enables RBAC gating of actions/bulk/export. */
  role?: string
  /** RBAC predicate; defaults to allow-all when omitted. */
  can?: (action: string) => boolean
  selectable?: boolean
  rowActions?: RowAction<T>[]
  bulkActions?: BulkAction<T>[]
  quickCreate?: { labelEn: string; labelFa: string; onClick: () => void }
  /** Called with parsed+validated import rows (component shows the picker/preview). */
  canExport?: boolean
  exportName?: string
  /** Render huge datasets with row windowing instead of pagination. */
  virtualize?: boolean
  rowHeight?: number
}

const lc = (isRTL: boolean, en: string, fa: string) => (isRTL ? fa : en)

/**
 * Enterprise DataTable — the single reusable table for every admin module.
 * Pure logic lives in `lib/admin/dataTable*.ts`; this shell adds selection,
 * multi-sort, column filters/resize/reorder/pin, per-user saved views, export,
 * row + bulk actions, virtualization, all states, RBAC, WCAG a11y and RTL.
 */
export function DataTable<T extends object>({
  columns, rows, locale, loading, error, onRetry, onRefresh, pageSize: pageSizeProp = 10,
  searchKeys, rowKey, emptyLabel, onRowClick, title, tableId, role, can,
  selectable, rowActions, bulkActions, quickCreate, canExport = true, exportName = 'export',
  virtualize, rowHeight = 44,
}: Props<T>) {
  const isRTL = locale === 'fa'
  const allow = useCallback((a?: string) => !a || (can ? can(a) : true), [can])

  // View state (persisted per user via tableId).
  const [view, setView] = useState<TableView>({})
  const [q, setQ] = useState('')
  const [specs, setSpecs] = useState<SortSpec[]>([])
  const [filters, setFilters] = useState<Record<string, ColumnFilter>>({})
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const [dense, setDense] = useState(false)
  const [pageSize, setPageSize] = useState(pageSizeProp)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [anchor, setAnchor] = useState<string | null>(null)
  const [colMenu, setColMenu] = useState(false)
  const [exportMenu, setExportMenu] = useState(false)
  const [viewMenu, setViewMenu] = useState(false)
  const [groupBy, setGroupBy] = useState<string | null>(null)
  const [savedViews, setSavedViews] = useState<{ id: number; name: string; state: TableView; owned: boolean; isDefault: boolean }[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const loadedPrefs = useRef(false)

  const rid = useCallback((r: T, i = 0) => (rowKey ? rowKey(r) : String((r as Record<string, unknown>).id ?? i)), [rowKey])
  const valueOf = useCallback((r: T, key: string) => { const c = columns.find(x => x.key === key); return c ? cellValue(c, r) : (r as Record<string, unknown>)[key] }, [columns])
  const numericKeys = useMemo(() => new Set(columns.filter(c => c.numeric || c.type === 'number').map(c => c.key)), [columns])

  // ── Load persisted prefs + saved views ──
  useEffect(() => {
    if (!tableId) return
    fetch(`/api/admin/table-prefs?tableId=${encodeURIComponent(tableId)}`).then(r => r.json()).then(d => {
      const p = (d.prefs ?? {}) as TableView
      setView(v => ({ ...v, ...p }))
      if (p.density) setDense(p.density === 'compact')
      if (p.pageSize) setPageSize(p.pageSize)
      if (p.sort) setSpecs(p.sort)
      if (p.filters) setFilters(p.filters)
      if (p.groupBy !== undefined) setGroupBy(p.groupBy)
      loadedPrefs.current = true
    }).catch(() => { loadedPrefs.current = true })
    fetch(`/api/admin/table-views?tableId=${encodeURIComponent(tableId)}`).then(r => r.json())
      .then(d => setSavedViews((d.views ?? []).map((v: { id: number; name: string; state: TableView; owned: boolean; isDefault: boolean }) => v)))
      .catch(() => {})
  }, [tableId])

  // Persist layout prefs (debounced) whenever they change.
  const persist = useCallback((next: Partial<TableView>) => {
    if (!tableId) return
    const merged: TableView = { ...view, density: dense ? 'compact' : 'comfortable', pageSize, sort: specs, filters, groupBy, ...next }
    setView(merged)
    fetch('/api/admin/table-prefs', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tableId, prefs: sanitizeForApi(merged) }) }).catch(() => {})
  }, [tableId, view, dense, pageSize, specs, filters, groupBy])

  // ── Column view (order / hidden / width / pin) ──
  const viewedCols = useMemo(() => applyColumnView(columns, view), [columns, view])
  const label = (c: Column<T>) => (isRTL ? c.labelFa : c.labelEn)
  const align = (c: Column<T>) => c.align ?? (c.numeric || c.type === 'number' ? 'end' : 'start')

  // ── Data pipeline: global filter → column filters → sort ──
  const filterKeys = searchKeys ?? columns.filter(c => c.key !== '__actions').map(c => c.key)
  const processed = useMemo(() => {
    let r = filterRows(rows, q, filterKeys)
    r = applyColumnFilters(r, filters, valueOf)
    r = multiSortRows(r, specs, numericKeys)
    return r
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, filters, specs, columns])

  const groups = useMemo(() => groupBy ? groupRows(processed, groupBy, [...numericKeys], valueOf) : null, [processed, groupBy, numericKeys, valueOf])
  const pageData = paginate(processed, page, pageSize)
  const visibleRows = virtualize ? processed : pageData.rows
  const pageIds = useMemo(() => (groupBy ? processed : virtualize ? processed : pageData.rows).map((r, i) => rid(r as T, i)), [groupBy, virtualize, pageData.rows, processed, rid])
  const allIds = useMemo(() => processed.map((r, i) => rid(r, i)), [processed, rid])

  const headState = selectionState(pageIds, sel)
  const selectedRows = useMemo(() => processed.filter((r, i) => sel.has(rid(r, i))), [processed, sel, rid])

  const onHeaderSort = (c: Column<T>, additive: boolean) => {
    if (c.sortable === false || c.key === '__actions') return
    const ns = nextMultiSort(specs, c.key, additive); setSpecs(ns); setPage(1); persist({ sort: ns })
  }
  const sortInfo = (key: string) => { const idx = specs.findIndex(s => s.key === key); return idx === -1 ? null : { dir: specs[idx].dir, pos: idx + 1, multi: specs.length > 1 } }

  const clickRow = (r: T, i: number, e: React.MouseEvent) => {
    const id = rid(r, i)
    if (selectable && (e.shiftKey && anchor)) { setSel(s => rangeSelect(pageIds, anchor, id, s)); return }
    if (onRowClick) onRowClick(r)
  }
  const toggleRow = (id: string, shift: boolean) => {
    if (shift && anchor) setSel(s => rangeSelect(pageIds, anchor, id, s))
    else { setSel(s => toggleSelect(s, id)); setAnchor(id) }
  }
  const toggleHeader = () => setSel(s => (headState === 'all' ? new Set([...s].filter(id => !pageIds.includes(id))) : new Set([...s, ...pageIds])))

  // ── Column resize ──
  const resizing = useRef<{ key: string; startX: number; startW: number } | null>(null)
  useEffect(() => {
    const move = (e: MouseEvent) => {
      const r = resizing.current; if (!r) return
      const dx = (isRTL ? -1 : 1) * (e.clientX - r.startX)
      const w = Math.max(60, r.startW + dx)
      setView(v => ({ ...v, columnWidths: { ...v.columnWidths, [r.key]: w } }))
    }
    const up = () => { if (resizing.current) { persist({}); resizing.current = null } }
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
  }, [isRTL, persist])

  // ── Column reorder (drag header) ──
  const colDrag = usePointerDnd<string>((srcKey, targetKey) => onDropCol(targetKey, srcKey))
  const dragCol = useRef<string | null>(null)
  const onDropCol = (targetKey: string, srcKey?: string) => {
    const src = srcKey ?? dragCol.current; dragCol.current = null
    if (!src || src === targetKey) return
    const order = viewedCols.map(c => c.key)
    const from = order.indexOf(src), to = order.indexOf(targetKey)
    if (from === -1 || to === -1) return
    order.splice(to, 0, order.splice(from, 1)[0])
    const full = [...order, ...columns.filter(c => !order.includes(c.key)).map(c => c.key)]
    setView(v => ({ ...v, columnOrder: full })); persist({ columnOrder: full })
  }

  const toggleHidden = (key: string) => {
    const cur = new Set(view.hidden ?? columns.filter(c => c.hidden).map(c => c.key))
    cur.has(key) ? cur.delete(key) : cur.add(key)
    const arr = [...cur]; setView(v => ({ ...v, hidden: arr })); persist({ hidden: arr })
  }
  const pinCol = (key: string, pin: 'start' | 'end' | undefined) => {
    const pinned = { ...(view.pinned ?? {}) }
    if (pin) pinned[key] = pin; else delete pinned[key]
    setView(v => ({ ...v, pinned })); persist({ pinned })
  }

  // ── Export ──
  const download = (content: string, ext: string, mime: string) => {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob); const a = document.createElement('a')
    a.href = url; a.download = `${exportName}-${new Date().toISOString().slice(0, 10)}.${ext}`; a.click(); URL.revokeObjectURL(url)
  }
  const rowsForScope = (scope: ExportScope): T[] =>
    scope === 'selected' ? selectedRows : scope === 'page' ? pageData.rows : processed // 'filtered' and 'all' both use processed (all when no filters)
  const doExport = (fmt: 'csv' | 'excel' | 'json', scope: ExportScope) => {
    const data = scope === 'all' ? rows : rowsForScope(scope)
    const cols = exportColumns(viewedCols)
    if (fmt === 'csv') download(toCsv(cols, data, locale), 'csv', 'text/csv;charset=utf-8')
    else if (fmt === 'excel') download(toExcelXml(cols, data, title || 'Sheet1', locale), 'xls', 'application/vnd.ms-excel')
    else download(toJson(cols, data), 'json', 'application/json')
    setExportMenu(false)
  }

  // ── Saved views ──
  const applyView = (state: TableView) => {
    setView(v => ({ ...v, ...state }))
    if (state.sort) setSpecs(state.sort)
    if (state.filters) setFilters(state.filters)
    if (state.density) setDense(state.density === 'compact')
    if (state.pageSize) setPageSize(state.pageSize)
    if (state.groupBy !== undefined) setGroupBy(state.groupBy)
    setViewMenu(false)
  }
  const currentState = (): TableView => ({ ...view, sort: specs, filters, density: dense ? 'compact' : 'comfortable', pageSize, groupBy })
  const saveView = async () => {
    if (!tableId) return
    const name = window.prompt(lc(isRTL, 'View name', 'نام نما')); if (!name) return
    setBusy('view')
    try {
      const r = await fetch('/api/admin/table-views', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', tableId, name, state: sanitizeForApi(currentState()) }) })
      const d = await r.json(); if (d.id) setSavedViews(v => [...v, { id: d.id, name, state: currentState(), owned: true, isDefault: false }])
    } finally { setBusy(null); setViewMenu(false) }
  }
  const deleteView = async (id: number) => {
    await fetch('/api/admin/table-views', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id }) })
    setSavedViews(v => v.filter(x => x.id !== id))
  }

  // ── Bulk action ──
  const runBulk = async (b: BulkAction<T>) => {
    const ids = [...sel]; if (ids.length === 0) return
    const confirm = isRTL ? b.confirmFa : b.confirmEn
    if (confirm && !window.confirm(confirm)) return
    setBusy(b.id)
    try { await b.run(ids, selectedRows); setSel(new Set()) } finally { setBusy(null) }
  }

  const pad = dense ? 'py-1.5 px-3' : 'py-3 px-4'
  const colStyle = (c: Column<T>) => c.width ? { width: c.width, minWidth: c.width } : (c.minWidth ? { minWidth: c.minWidth } : undefined)
  const visibleBulk = (bulkActions ?? []).filter(b => allow(b.requires))

  // Virtual window
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const viewportH = 560
  const total = visibleRows.length
  const startIdx = virtualize ? Math.max(0, Math.floor(scrollTop / rowHeight) - 6) : 0
  const endIdx = virtualize ? Math.min(total, Math.ceil((scrollTop + viewportH) / rowHeight) + 6) : total
  const windowRows = virtualize && !groupBy ? visibleRows.slice(startIdx, endIdx) : visibleRows

  const colCount = viewedCols.length + (selectable ? 1 : 0) + (rowActions?.length ? 1 : 0)

  return (
    <div className="space-y-3" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2">
        {title && <h3 className="text-sm font-semibold text-text-primary me-2">{title}</h3>}
        <input value={q} onChange={e => { setQ(e.target.value); setPage(1) }}
          placeholder={lc(isRTL, 'Search…', 'جستجو…')} aria-label={lc(isRTL, 'Search table', 'جستجوی جدول')}
          className="px-3 py-1.5 rounded-lg text-sm bg-white/[0.04] border border-white/[0.08] text-text-primary placeholder:text-text-disabled outline-none focus:border-brand/40 min-w-[200px]" />
        <button onClick={() => setShowFilters(f => !f)} aria-pressed={showFilters} className="text-xs px-2 py-1.5 rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors">
          {lc(isRTL, 'Filters', 'فیلترها')}{Object.keys(filters).length > 0 ? ` (${Object.keys(filters).length})` : ''}
        </button>

        <div className="ms-auto flex items-center gap-2">
          {quickCreate && allow('edit') && (
            <button onClick={quickCreate.onClick} className="text-xs px-2.5 py-1.5 rounded-lg bg-brand/90 text-white hover:bg-brand transition-colors">
              + {isRTL ? quickCreate.labelFa : quickCreate.labelEn}
            </button>
          )}
          {onRefresh && <button onClick={onRefresh} aria-label={lc(isRTL, 'Refresh', 'تازه‌سازی')} className="text-xs px-2 py-1.5 rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors">↻</button>}
          <button onClick={() => { setDense(d => { const n = !d; persist({ density: n ? 'compact' : 'comfortable' }); return n }) }} aria-pressed={dense} className="text-xs px-2 py-1.5 rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors">
            {dense ? lc(isRTL, 'Comfortable', 'راحت') : lc(isRTL, 'Compact', 'فشرده')}
          </button>
          {/* Columns menu */}
          <div className="relative">
            <button onClick={() => setColMenu(o => !o)} aria-haspopup="menu" aria-expanded={colMenu} className="text-xs px-2 py-1.5 rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors">{lc(isRTL, 'Columns', 'ستون‌ها')}</button>
            {colMenu && (
              <div role="menu" className="absolute z-30 mt-1 end-0 w-56 rounded-lg bg-surface border border-border shadow-2xl py-1 max-h-72 overflow-y-auto">
                {columns.filter(c => c.key !== '__actions').map(c => {
                  const hidden = (view.hidden ?? columns.filter(x => x.hidden).map(x => x.key)).includes(c.key)
                  const pin = view.pinned?.[c.key]
                  return (
                    <div key={c.key} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-white/5">
                      <label className="flex items-center gap-2 cursor-pointer flex-1">
                        <input type="checkbox" checked={!hidden} onChange={() => toggleHidden(c.key)} /> {label(c)}
                      </label>
                      <button onClick={() => pinCol(c.key, pin === 'start' ? undefined : 'start')} title={lc(isRTL, 'Pin', 'سنجاق')} className={`text-3xs px-1 rounded ${pin ? 'text-brand' : 'text-text-disabled hover:text-text-secondary'}`}>📌</button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          {/* Group-by */}
          <select value={groupBy ?? ''} onChange={e => { const g = e.target.value || null; setGroupBy(g); persist({ groupBy: g }) }} aria-label={lc(isRTL, 'Group by', 'گروه‌بندی')}
            className="text-xs px-2 py-1.5 rounded-lg border border-border bg-transparent text-text-secondary">
            <option value="">{lc(isRTL, 'No grouping', 'بدون گروه')}</option>
            {columns.filter(c => c.key !== '__actions' && c.type !== 'number').map(c => <option key={c.key} value={c.key}>{label(c)}</option>)}
          </select>
          {/* Export */}
          {canExport && allow('view') && (
            <div className="relative">
              <button onClick={() => setExportMenu(o => !o)} aria-haspopup="menu" aria-expanded={exportMenu} className="text-xs px-2 py-1.5 rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors">{lc(isRTL, 'Export', 'خروجی')}</button>
              {exportMenu && (
                <div role="menu" className="absolute z-30 mt-1 end-0 w-52 rounded-lg bg-surface border border-border shadow-2xl py-1 text-xs">
                  {(['csv', 'excel', 'json'] as const).map(fmt => (
                    <div key={fmt} className="px-2 py-1">
                      <p className="text-overline text-text-disabled px-1">{fmt.toUpperCase()}</p>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {(['page', 'filtered', 'selected', 'all'] as ExportScope[]).map(sc => (
                          <button key={sc} disabled={sc === 'selected' && sel.size === 0} onClick={() => doExport(fmt, sc)} className="px-1.5 py-0.5 rounded border border-border text-text-secondary hover:text-brand hover:border-brand/40 disabled:opacity-30">
                            {lc(isRTL, sc, { page: 'صفحه', filtered: 'فیلترشده', selected: 'انتخابی', all: 'همه' }[sc])}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* Saved views */}
          {tableId && (
            <div className="relative">
              <button onClick={() => setViewMenu(o => !o)} aria-haspopup="menu" aria-expanded={viewMenu} className="text-xs px-2 py-1.5 rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors">{lc(isRTL, 'Views', 'نماها')}</button>
              {viewMenu && (
                <div role="menu" className="absolute z-30 mt-1 end-0 w-56 rounded-lg bg-surface border border-border shadow-2xl py-1 text-xs max-h-72 overflow-y-auto">
                  <button onClick={saveView} disabled={busy === 'view'} className="w-full text-start px-3 py-1.5 text-brand hover:bg-white/5">+ {lc(isRTL, 'Save current view', 'ذخیره نمای فعلی')}</button>
                  {savedViews.length > 0 && <div className="border-t border-border my-1" />}
                  {savedViews.map(v => (
                    <div key={v.id} className="flex items-center justify-between gap-1 px-3 py-1.5 hover:bg-white/5">
                      <button onClick={() => applyView(v.state)} className="flex-1 text-start text-text-secondary hover:text-text-primary truncate">{v.name}</button>
                      {v.owned && <button onClick={() => deleteView(v.id)} className="text-danger-text/70 hover:text-danger-text" aria-label={lc(isRTL, 'Delete view', 'حذف نما')}>✕</button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Bulk action bar ── */}
      {selectable && sel.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-brand/10 border border-brand/25 text-xs">
          <span className="text-brand font-semibold">{isRTL ? `${sel.size} انتخاب‌شده` : `${sel.size} selected`}</span>
          <button onClick={() => setSel(new Set())} className="text-text-secondary hover:text-text-primary">{lc(isRTL, 'Clear', 'پاک‌کردن')}</button>
          <button onClick={() => setSel(invertSelection(allIds, sel))} className="text-text-secondary hover:text-text-primary">{lc(isRTL, 'Invert', 'معکوس')}</button>
          <div className="ms-auto flex flex-wrap gap-1">
            {visibleBulk.map(b => (
              <button key={b.id} onClick={() => runBulk(b)} disabled={busy === b.id}
                className={`px-2 py-1 rounded border transition-colors ${b.danger ? 'border-danger-text/30 text-danger-text hover:bg-danger-text/10' : 'border-border text-text-secondary hover:text-brand hover:border-brand/40'} disabled:opacity-40`}>
                {b.icon ? `${b.icon} ` : ''}{isRTL ? b.labelFa : b.labelEn}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Table ── */}
      {error ? (
        <div className="rounded-xl border border-danger-text/30 bg-danger-text/5 py-10 text-center">
          <p className="text-danger-text text-sm mb-2">{error}</p>
          {onRetry && <button onClick={onRetry} className="text-xs px-3 py-1.5 rounded-lg border border-border text-text-secondary hover:text-text-primary">{lc(isRTL, 'Retry', 'تلاش دوباره')}</button>}
        </div>
      ) : (
        <div ref={scrollRef} onScroll={virtualize ? e => setScrollTop((e.target as HTMLDivElement).scrollTop) : undefined}
          className="overflow-auto rounded-xl border border-border" style={virtualize ? { maxHeight: viewportH } : undefined}>
          <table className="w-full text-sm" role="table" style={{ tableLayout: virtualize ? 'fixed' : 'auto' }}>
            <thead className="sticky top-0 z-10 bg-surface">
              <tr className="border-b border-border">
                {selectable && (
                  <th className={`${pad} w-10`}><input type="checkbox" aria-label={lc(isRTL, 'Select page', 'انتخاب صفحه')} checked={headState === 'all'} ref={el => { if (el) el.indeterminate = headState === 'some' }} onChange={toggleHeader} /></th>
                )}
                {viewedCols.map(c => {
                  const sortable = c.sortable !== false && c.key !== '__actions'
                  const si = sortInfo(c.key)
                  // 26.31 بند ۶ — inherited debt from 26.29: HTML5 column drag
                  // never started (no dataTransfer.setData) and does not exist on
                  // touch. Reuses the SAME pointer helper as the CRM kanban.
                  const drag = c.key !== '__actions' ? colDrag.dragHandlers(c.key, c.key) : null
                  return (
                    <th key={c.key} scope="col"
                      {...(c.key !== '__actions' ? colDrag.zoneProps(c.key) : {})}
                      {...(drag ? { onPointerDown: drag.onPointerDown } : {})}
                      style={{ ...colStyle(c), ...(drag ? drag.style : {}) }}
                      aria-sort={si ? (si.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                      className={`relative ${pad} text-overline text-text-tertiary font-semibold text-${align(c)} ${c.pinned ? 'sticky bg-surface z-[5]' : ''}`}>
                      {sortable ? (
                        <button onClick={e => onHeaderSort(c, e.shiftKey)} className="inline-flex items-center gap-1 hover:text-text-primary transition-colors">
                          {label(c)}
                          <span aria-hidden className="text-3xs">{si ? (si.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
                          {si?.multi && <sup className="text-4xs text-brand">{si.pos}</sup>}
                        </button>
                      ) : label(c)}
                      {c.key !== '__actions' && <span onMouseDown={e => { resizing.current = { key: c.key, startX: e.clientX, startW: c.width ?? (e.currentTarget.parentElement as HTMLElement).offsetWidth } }}
                        className="absolute top-0 bottom-0 end-0 w-1 cursor-col-resize hover:bg-brand/40" aria-hidden />}
                    </th>
                  )
                })}
                {rowActions?.length ? <th className={`${pad} w-10 text-end`} aria-label="actions" /> : null}
              </tr>
              {/* Column filter row */}
              {showFilters && (
                <tr className="border-b border-border bg-white/[0.02]">
                  {selectable && <th />}
                  {viewedCols.map(c => (
                    <th key={c.key} className="px-2 py-1.5">
                      {c.key !== '__actions' && c.filterable !== false && <ColumnFilterInput col={c} isRTL={isRTL} value={filters[c.key]} onChange={f => {
                        setFilters(prev => { const n = { ...prev }; if (f) n[c.key] = f; else delete n[c.key]; persist({ filters: n }); return n }); setPage(1)
                      }} />}
                    </th>
                  ))}
                  {rowActions?.length ? <th /> : null}
                </tr>
              )}
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/40">
                    {selectable && <td className={pad} />}
                    {viewedCols.map(c => <td key={c.key} className={pad}><div className="h-4 rounded bg-white/[0.05] animate-pulse" /></td>)}
                    {rowActions?.length ? <td className={pad} /> : null}
                  </tr>
                ))
              ) : processed.length === 0 ? (
                <tr><td colSpan={colCount} className="py-12 text-center text-text-tertiary text-sm">
                  {q || Object.keys(filters).length ? lc(isRTL, 'No results match your filters', 'نتیجه‌ای با فیلترها مطابقت ندارد') : (emptyLabel ?? lc(isRTL, 'No data yet', 'هنوز داده‌ای نیست'))}
                </td></tr>
              ) : groups ? (
                groups.map(g => (
                  <GroupBlock key={g.key} groupKey={g.key} count={g.count} colCount={colCount} pad={pad} isRTL={isRTL}>
                    {g.rows.map((row, i) => renderRow(row, i))}
                  </GroupBlock>
                ))
              ) : virtualize ? (
                <>
                  {startIdx > 0 && <tr style={{ height: startIdx * rowHeight }}><td colSpan={colCount} /></tr>}
                  {windowRows.map((row, i) => renderRow(row, startIdx + i))}
                  {endIdx < total && <tr style={{ height: (total - endIdx) * rowHeight }}><td colSpan={colCount} /></tr>}
                </>
              ) : (
                pageData.rows.map((row, i) => renderRow(row, i))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination ── */}
      {!loading && !error && !virtualize && !groupBy && processed.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-tertiary">
          <div className="flex items-center gap-2">
            <span>{isRTL ? `${pageData.from}–${pageData.to} از ${pageData.total}` : `${pageData.from}–${pageData.to} of ${pageData.total}`}</span>
            <select value={pageSize} onChange={e => { const n = Number(e.target.value); setPageSize(n); setPage(1); persist({ pageSize: n }) }} aria-label={lc(isRTL, 'Page size', 'اندازه صفحه')} className="px-1.5 py-1 rounded border border-border bg-transparent">
              {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={pageData.page <= 1} className="px-2 py-1 rounded border border-border disabled:opacity-40 hover:border-border-strong">«</button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={pageData.page <= 1} className="px-2 py-1 rounded border border-border disabled:opacity-40 hover:border-border-strong">{isRTL ? '›' : '‹'}</button>
            <span className="px-2">{pageData.page} / {pageData.pageCount}</span>
            <button onClick={() => setPage(p => Math.min(pageData.pageCount, p + 1))} disabled={pageData.page >= pageData.pageCount} className="px-2 py-1 rounded border border-border disabled:opacity-40 hover:border-border-strong">{isRTL ? '‹' : '›'}</button>
            <button onClick={() => setPage(pageData.pageCount)} disabled={pageData.page >= pageData.pageCount} className="px-2 py-1 rounded border border-border disabled:opacity-40 hover:border-border-strong">»</button>
          </div>
        </div>
      )}
      {!loading && !error && virtualize && <p className="text-xs text-text-tertiary">{isRTL ? `${total} ردیف` : `${total} rows`}</p>}
    </div>
  )

  function renderRow(row: T, i: number) {
    const id = rid(row, i)
    const checked = sel.has(id)
    return (
      <tr key={id} onClick={e => clickRow(row, i, e)}
        className={`border-b border-border/40 transition-colors ${checked ? 'bg-brand/[0.06]' : ''} ${onRowClick ? 'cursor-pointer hover:bg-white/[0.025]' : 'hover:bg-white/[0.015]'}`}
        style={virtualize ? { height: rowHeight } : undefined}>
        {selectable && (
          <td className={pad} onClick={e => e.stopPropagation()}>
            <input type="checkbox" aria-label={lc(isRTL, 'Select row', 'انتخاب ردیف')} checked={checked} onClick={e => toggleRow(id, (e as React.MouseEvent).shiftKey)} onChange={() => {}} />
          </td>
        )}
        {viewedCols.map(c => (
          <td key={c.key} style={colStyle(c)} className={`${pad} text-text-secondary text-${align(c)} ${c.numeric || c.type === 'number' ? 'tabular-nums' : ''} ${c.pinned ? 'sticky bg-surface z-[2]' : ''}`}>
            {(c.render ? c.render(row) : ((row as Record<string, unknown>)[c.key] as React.ReactNode)) as React.ReactNode}
          </td>
        ))}
        {rowActions?.length ? (
          <td className={`${pad} text-end`} onClick={e => e.stopPropagation()}><RowActionsMenu row={row} actions={rowActions.filter(a => allow(a.requires) && !a.hidden?.(row))} isRTL={isRTL} /></td>
        ) : null}
      </tr>
    )
  }
}

// Strip non-serializable / oversized bits before persisting a view.
function sanitizeForApi(v: TableView): TableView {
  return {
    columnOrder: v.columnOrder, columnWidths: v.columnWidths, hidden: v.hidden, pinned: v.pinned,
    sort: v.sort, filters: v.filters, groupBy: v.groupBy, density: v.density, pageSize: v.pageSize,
  }
}

// ── Sub-components ───────────────────────────────────────────────────────────
function ColumnFilterInput<T extends object>({ col, value, onChange, isRTL }: { col: Column<T>; value?: ColumnFilter; onChange: (f: ColumnFilter | null) => void; isRTL: boolean }) {
  const cls = 'w-full px-1.5 py-1 rounded border border-border bg-transparent text-xs text-text-secondary outline-none focus:border-brand/40'
  if (col.type === 'number') {
    const v = value?.type === 'number' ? value : { type: 'number' as const }
    return (
      <div className="flex gap-1">
        <input type="number" placeholder={lc(isRTL, 'min', 'کمینه')} className={cls} defaultValue={v.min ?? ''} onChange={e => onChange({ type: 'number', min: e.target.value === '' ? undefined : Number(e.target.value), max: v.max })} />
        <input type="number" placeholder={lc(isRTL, 'max', 'بیشینه')} className={cls} defaultValue={v.max ?? ''} onChange={e => onChange({ type: 'number', min: v.min, max: e.target.value === '' ? undefined : Number(e.target.value) })} />
      </div>
    )
  }
  if (col.type === 'boolean') {
    const v = value?.type === 'boolean' ? String(value.value) : ''
    return <select className={cls} value={v} onChange={e => onChange(e.target.value === '' ? null : { type: 'boolean', value: e.target.value === 'true' })}>
      <option value="">{lc(isRTL, 'Any', 'همه')}</option><option value="true">{lc(isRTL, 'Yes', 'بله')}</option><option value="false">{lc(isRTL, 'No', 'خیر')}</option>
    </select>
  }
  if (col.type === 'enum' && col.options) {
    const v = value?.type === 'enum' ? value.values[0] ?? '' : ''
    return <select className={cls} value={v} onChange={e => onChange(e.target.value === '' ? null : { type: 'enum', values: [e.target.value] })}>
      <option value="">{lc(isRTL, 'Any', 'همه')}</option>
      {col.options.map(o => <option key={o.value} value={o.value}>{isRTL ? o.labelFa : o.labelEn}</option>)}
    </select>
  }
  if (col.type === 'date') {
    const v = value?.type === 'date' ? value : { type: 'date' as const }
    return <div className="flex gap-1">
      <input type="date" className={cls} defaultValue={v.from ?? ''} onChange={e => onChange({ type: 'date', from: e.target.value || undefined, to: v.to })} />
      <input type="date" className={cls} defaultValue={v.to ?? ''} onChange={e => onChange({ type: 'date', from: v.from, to: e.target.value || undefined })} />
    </div>
  }
  const v = value?.type === 'text' ? value.value : ''
  return <input className={cls} placeholder={lc(isRTL, 'Filter…', 'فیلتر…')} defaultValue={v} onChange={e => onChange(e.target.value === '' ? null : { type: 'text', value: e.target.value })} />
}

function RowActionsMenu<T extends object>({ row, actions, isRTL }: { row: T; actions: RowAction<T>[]; isRTL: boolean }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  // Position the menu with `position: fixed` from the button's viewport rect so
  // it escapes the table's `overflow-auto` clip (previously it was hidden and
  // needed scrolling). Flips up/left when near the viewport edge.
  const openMenu = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    const W = 176, H = Math.min(actions.length * 32 + 8, 320)
    let top = r.bottom + 4
    if (top + H > window.innerHeight - 8) top = Math.max(8, r.top - H - 4)
    let left = isRTL ? r.right - W : r.left
    left = Math.max(8, Math.min(left, window.innerWidth - W - 8))
    setPos({ top, left })
  }, [actions.length, isRTL])
  useEffect(() => {
    if (!pos) return
    const close = () => setPos(null)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close) }
  }, [pos])
  if (actions.length === 0) return null
  return (
    <div className="inline-block">
      <button ref={btnRef} onClick={() => (pos ? setPos(null) : openMenu())} aria-haspopup="menu" aria-expanded={!!pos} aria-label={lc(isRTL, 'Row actions', 'عملیات ردیف')} className="px-2 py-1 rounded hover:bg-white/10 text-text-tertiary">⋯</button>
      {pos && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setPos(null)} />
          <div role="menu" style={{ position: 'fixed', top: pos.top, left: pos.left, width: 176 }} className="z-[61] rounded-lg bg-surface border border-border shadow-2xl py-1 text-xs max-h-80 overflow-y-auto">
            {actions.map(a => (
              <button key={a.id} role="menuitem" onClick={() => { setPos(null); a.onClick(row) }}
                className={`w-full text-start px-3 py-1.5 hover:bg-white/5 ${a.danger ? 'text-danger-text' : 'text-text-secondary hover:text-text-primary'}`}>
                {a.icon ? `${a.icon} ` : ''}{isRTL ? a.labelFa : a.labelEn}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function GroupBlock({ groupKey, count, colCount, pad, isRTL, children }: { groupKey: string; count: number; colCount: number; pad: string; isRTL: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <>
      <tr className="bg-white/[0.03] border-b border-border cursor-pointer" onClick={() => setOpen(o => !o)}>
        <td colSpan={colCount} className={`${pad} text-xs font-semibold text-text-secondary`}>
          <span className="me-2">{open ? '▾' : '▸'}</span>{groupKey} <span className="text-text-disabled">({count})</span>
        </td>
      </tr>
      {open && children}
    </>
  )
}
