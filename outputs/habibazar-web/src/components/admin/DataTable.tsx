'use client'

import { useMemo, useState } from 'react'
import { sortRows, filterRows, paginate, nextSort, type Column, type Row, type SortDir } from '@/lib/admin/dataTable'

interface Props<T extends Row> {
  columns: Column<T>[]
  rows: T[]
  locale: 'fa' | 'en'
  loading?: boolean
  pageSize?: number
  /** Column keys to include in the global filter (defaults to all). */
  searchKeys?: string[]
  rowKey?: (row: T) => string
  emptyLabel?: string
  onRowClick?: (row: T) => void
}

/**
 * Enterprise DataTable — one reusable, accessible table with client-side
 * sorting, global filter, density toggle, column visibility and pagination.
 * Logic lives in the pure engine (`lib/admin/dataTable.ts`). RTL + bilingual +
 * loading/empty states + `aria-sort` headers.
 */
export function DataTable<T extends Row>({ columns, rows, locale, loading, pageSize = 10, searchKeys, rowKey, emptyLabel, onRowClick }: Props<T>) {
  const isRTL = locale === 'fa'
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<{ key: string | null; dir: SortDir }>({ key: null, dir: 'asc' })
  const [page, setPage] = useState(1)
  const [dense, setDense] = useState(false)
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [colMenu, setColMenu] = useState(false)

  const filterKeys = searchKeys ?? columns.map(c => c.key)
  const activeCols = columns.filter(c => !hidden.has(c.key))
  const numericOf = (key: string | null) => !!columns.find(c => c.key === key)?.numeric

  const processed = useMemo(() => {
    const filtered = filterRows(rows, q, filterKeys)
    const sorted = sortRows(filtered, sort.key, sort.dir, numericOf(sort.key))
    return sorted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, sort, columns])
  const pageData = paginate(processed, page, pageSize)

  const label = (c: Column<T>) => (isRTL ? c.labelFa : c.labelEn)
  const cell = (c: Column<T>, row: T) => (c.render ? c.render(row) : (row[c.key] as React.ReactNode))
  const pad = dense ? 'py-1.5 px-3' : 'py-3 px-4'

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q} onChange={e => { setQ(e.target.value); setPage(1) }}
          placeholder={isRTL ? 'جستجو…' : 'Search…'}
          aria-label={isRTL ? 'جستجوی جدول' : 'Search table'}
          className="px-3 py-1.5 rounded-lg text-sm bg-white/[0.04] border border-white/[0.08] text-text-primary placeholder:text-text-disabled outline-none focus:border-brand/40 min-w-[200px]"
        />
        <div className="ms-auto flex items-center gap-2">
          <button onClick={() => setDense(d => !d)} className="text-xs px-2 py-1.5 rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors" aria-pressed={dense}>
            {dense ? (isRTL ? 'راحت' : 'Comfortable') : (isRTL ? 'فشرده' : 'Compact')}
          </button>
          <div className="relative">
            <button onClick={() => setColMenu(o => !o)} aria-haspopup="menu" aria-expanded={colMenu} className="text-xs px-2 py-1.5 rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors">
              {isRTL ? 'ستون‌ها' : 'Columns'}
            </button>
            {colMenu && (
              <div role="menu" className="absolute z-20 mt-1 end-0 w-48 rounded-lg bg-surface border border-border shadow-2xl py-1 max-h-64 overflow-y-auto">
                {columns.map(c => (
                  <label key={c.key} className="flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-white/5 cursor-pointer">
                    <input type="checkbox" checked={!hidden.has(c.key)} onChange={() => setHidden(h => { const n = new Set(h); n.has(c.key) ? n.delete(c.key) : n.add(c.key); return n })} />
                    {label(c)}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm" role="table">
          <thead>
            <tr className="border-b border-border bg-white/[0.02]">
              {activeCols.map(c => {
                const sortable = c.sortable !== false
                const isSorted = sort.key === c.key
                return (
                  <th key={c.key} scope="col"
                    aria-sort={isSorted ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={`text-start ${pad} text-overline text-text-tertiary font-semibold ${c.numeric ? 'text-end' : ''}`}>
                    {sortable ? (
                      <button onClick={() => { setSort(s => nextSort(s, c.key)); setPage(1) }} className="inline-flex items-center gap-1 hover:text-text-primary transition-colors">
                        {label(c)}
                        <span aria-hidden className="text-[10px]">{isSorted ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </button>
                    ) : label(c)}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border/40">
                  {activeCols.map(c => <td key={c.key} className={pad}><div className="h-4 rounded bg-white/[0.05] animate-pulse" /></td>)}
                </tr>
              ))
            ) : pageData.rows.length === 0 ? (
              <tr><td colSpan={activeCols.length} className="py-10 text-center text-text-tertiary text-sm">{emptyLabel ?? (isRTL ? 'داده‌ای نیست' : 'No data')}</td></tr>
            ) : (
              pageData.rows.map((row, i) => (
                <tr key={rowKey ? rowKey(row) : i}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`border-b border-border/40 transition-colors ${onRowClick ? 'cursor-pointer hover:bg-white/[0.025]' : 'hover:bg-white/[0.015]'}`}>
                  {activeCols.map(c => <td key={c.key} className={`${pad} text-text-secondary ${c.numeric ? 'text-end tabular-nums' : ''}`}>{cell(c, row) as React.ReactNode}</td>)}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && pageData.total > pageSize && (
        <div className="flex items-center justify-between text-xs text-text-tertiary">
          <span>{isRTL ? `${pageData.from}–${pageData.to} از ${pageData.total}` : `${pageData.from}–${pageData.to} of ${pageData.total}`}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={pageData.page <= 1} className="px-2 py-1 rounded border border-border disabled:opacity-40 hover:border-border-strong">{isRTL ? '›' : '‹'}</button>
            <span className="px-2">{pageData.page} / {pageData.pageCount}</span>
            <button onClick={() => setPage(p => Math.min(pageData.pageCount, p + 1))} disabled={pageData.page >= pageData.pageCount} className="px-2 py-1 rounded border border-border disabled:opacity-40 hover:border-border-strong">{isRTL ? '‹' : '›'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
