/**
 * Enterprise DataTable — pure engine (Phase 22.5).
 *
 * Sorting, global filtering and pagination with no I/O and no React → fully
 * unit-tested. The DataTable component is a thin rendering shell over these
 * helpers, so the table logic lives in one place and every module gets the same
 * behaviour. Generic over the row type.
 */

export type SortDir = 'asc' | 'desc'
export type Row = Record<string, unknown>

export interface Column<T extends Row = Row> {
  key: string
  labelEn: string
  labelFa: string
  /** Sortable? Defaults to true. */
  sortable?: boolean
  /** Numeric alignment / comparison. */
  numeric?: boolean
  /** Custom cell renderer key is handled by the component; engine only sorts/filters raw values. */
  render?: (row: T) => unknown
}

function cmp(a: unknown, b: unknown, numeric?: boolean): number {
  if (numeric) return (Number(a) || 0) - (Number(b) || 0)
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true })
}

/** Sort rows by a column key + direction (stable, non-mutating). */
export function sortRows<T extends Row>(rows: T[], key: string | null, dir: SortDir, numeric = false): T[] {
  if (!key) return rows
  return rows.map((r, i) => [r, i] as const)
    .sort(([a, ia], [b, ib]) => {
      const c = cmp(a[key], b[key], numeric)
      return (dir === 'asc' ? c : -c) || ia - ib
    })
    .map(([r]) => r)
}

/** Filter rows: keep any row where a searched column contains the query (case-insensitive). */
export function filterRows<T extends Row>(rows: T[], query: string, keys: string[]): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return rows
  return rows.filter(r => keys.some(k => String(r[k] ?? '').toLowerCase().includes(q)))
}

export interface Page<T> { rows: T[]; page: number; pageCount: number; total: number; from: number; to: number }

/** Slice rows into a page (1-indexed page, clamped). */
export function paginate<T>(rows: T[], page: number, pageSize: number): Page<T> {
  const total = rows.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const p = Math.min(Math.max(1, page), pageCount)
  const start = (p - 1) * pageSize
  const slice = rows.slice(start, start + pageSize)
  return { rows: slice, page: p, pageCount, total, from: total === 0 ? 0 : start + 1, to: start + slice.length }
}

/** Next sort state when a header is clicked: asc → desc → cleared. */
export function nextSort(current: { key: string | null; dir: SortDir }, key: string): { key: string | null; dir: SortDir } {
  if (current.key !== key) return { key, dir: 'asc' }
  if (current.dir === 'asc') return { key, dir: 'desc' }
  return { key: null, dir: 'asc' }
}
