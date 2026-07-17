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
export type ColumnType = 'text' | 'number' | 'date' | 'boolean' | 'enum' | 'tag'

export interface Column<T extends object = Row> {
  key: string
  labelEn: string
  labelFa: string
  /** Sortable? Defaults to true. */
  sortable?: boolean
  /** Numeric alignment / comparison. */
  numeric?: boolean
  /** Semantic type — drives the column-filter UI + comparators. Defaults to 'text'. */
  type?: ColumnType
  /** Filterable via the per-column filter panel? Defaults to true (except actions). */
  filterable?: boolean
  /** Enum/tag option values (for enum/tag filters). */
  options?: { value: string; labelEn: string; labelFa: string }[]
  /** Default / saved pixel width. */
  width?: number
  minWidth?: number
  /** Pin to a table edge (start/end respect RTL at render time). */
  pinned?: 'start' | 'end'
  /** Column-group header this column belongs to (for grouped headers). */
  group?: string
  /** Hidden by default. */
  hidden?: boolean
  /** Exclude from CSV/Excel/JSON export (e.g. an actions column). */
  noExport?: boolean
  /** Text alignment override. */
  align?: 'start' | 'center' | 'end'
  /** Raw value used for sorting/filtering/export when the cell is a custom render. */
  value?: (row: T) => unknown
  /** Custom cell renderer key is handled by the component; engine only sorts/filters raw values. */
  render?: (row: T) => unknown
}

/** Index an arbitrary row object by string key without requiring an index signature. */
const ix = (r: object, k: string): unknown => (r as Record<string, unknown>)[k]

/** Extract the raw comparable/filterable/exportable value of a cell. */
export function cellValue<T extends object>(col: Column<T>, row: T): unknown {
  return col.value ? col.value(row) : ix(row, col.key)
}

function cmp(a: unknown, b: unknown, numeric?: boolean): number {
  if (numeric) return (Number(a) || 0) - (Number(b) || 0)
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true })
}

/** Sort rows by a column key + direction (stable, non-mutating). */
export function sortRows<T extends object>(rows: T[], key: string | null, dir: SortDir, numeric = false): T[] {
  if (!key) return rows
  return rows.map((r, i) => [r, i] as const)
    .sort(([a, ia], [b, ib]) => {
      const c = cmp(ix(a, key), ix(b, key), numeric)
      return (dir === 'asc' ? c : -c) || ia - ib
    })
    .map(([r]) => r)
}

/** Filter rows: keep any row where a searched column contains the query (case-insensitive). */
export function filterRows<T extends object>(rows: T[], query: string, keys: string[]): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return rows
  return rows.filter(r => keys.some(k => String(ix(r, k) ?? "").toLowerCase().includes(q)))
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

// ── Multi-sort ──────────────────────────────────────────────────────────────
export interface SortSpec { key: string; dir: SortDir }

/**
 * Cycle a column within a multi-sort spec. Non-additive click resets to just
 * this column (asc→desc→removed). Additive (shift) toggles/appends this column
 * while preserving the others.
 */
export function nextMultiSort(specs: SortSpec[], key: string, additive: boolean): SortSpec[] {
  const existing = specs.find(s => s.key === key)
  if (!additive) {
    if (!existing) return [{ key, dir: 'asc' }]
    if (existing.dir === 'asc') return [{ key, dir: 'desc' }]
    return []
  }
  if (!existing) return [...specs, { key, dir: 'asc' }]
  if (existing.dir === 'asc') return specs.map(s => s.key === key ? { key, dir: 'desc' as SortDir } : s)
  return specs.filter(s => s.key !== key)
}

/** Sort by multiple columns in priority order (stable). `numericKeys` marks numeric cols. */
export function multiSortRows<T extends object>(rows: T[], specs: SortSpec[], numericKeys: Set<string> = new Set()): T[] {
  if (specs.length === 0) return rows
  return rows.map((r, i) => [r, i] as const)
    .sort(([a, ia], [b, ib]) => {
      for (const s of specs) {
        const c = cmp(ix(a, s.key), ix(b, s.key), numericKeys.has(s.key))
        if (c !== 0) return s.dir === 'asc' ? c : -c
      }
      return ia - ib
    })
    .map(([r]) => r)
}

// ── Column filters ──────────────────────────────────────────────────────────
export type ColumnFilter =
  | { type: 'text'; value: string }
  | { type: 'number'; min?: number; max?: number }
  | { type: 'date'; from?: string; to?: string }
  | { type: 'boolean'; value: boolean }
  | { type: 'enum'; values: string[] }      // OR across selected values
  | { type: 'tag'; values: string[] }       // row must contain all tags (AND)

function matchesFilter(raw: unknown, f: ColumnFilter): boolean {
  switch (f.type) {
    case 'text': {
      const q = f.value.trim().toLowerCase()
      return !q || String(raw ?? '').toLowerCase().includes(q)
    }
    case 'number': {
      const n = Number(raw)
      if (Number.isNaN(n)) return false
      if (f.min != null && n < f.min) return false
      if (f.max != null && n > f.max) return false
      return true
    }
    case 'date': {
      const t = new Date(String(raw ?? '')).getTime()
      if (Number.isNaN(t)) return false
      if (f.from && t < new Date(f.from).getTime()) return false
      if (f.to && t > new Date(f.to).getTime() + 86_399_999) return false // inclusive end-of-day
      return true
    }
    case 'boolean':
      return Boolean(raw) === f.value
    case 'enum':
      return f.values.length === 0 || f.values.includes(String(raw ?? ''))
    case 'tag': {
      const hay = String(raw ?? '').toLowerCase()
      return f.values.every(v => hay.includes(v.toLowerCase()))
    }
  }
}

/**
 * Apply a map of per-column filters. `valueOf` resolves the raw cell value for a
 * column key (so custom-rendered columns still filter on their true value).
 */
export function applyColumnFilters<T extends object>(
  rows: T[], filters: Record<string, ColumnFilter>, valueOf: (row: T, key: string) => unknown = (r, k) => ix(r, k),
): T[] {
  const entries = Object.entries(filters)
  if (entries.length === 0) return rows
  return rows.filter(r => entries.every(([k, f]) => matchesFilter(valueOf(r, k), f)))
}

// ── Grouping + aggregation ──────────────────────────────────────────────────
export interface RowGroup<T> { key: string; rows: T[]; count: number; aggregates: Record<string, number> }

/** Group rows by a column value; compute count + sum/avg for the given numeric keys. */
export function groupRows<T extends object>(
  rows: T[], groupKey: string, aggregateKeys: string[] = [], valueOf: (row: T, key: string) => unknown = (r, k) => ix(r, k),
): RowGroup<T>[] {
  const map = new Map<string, T[]>()
  for (const r of rows) {
    const k = String(valueOf(r, groupKey) ?? '—')
    const g = map.get(k) ?? []; g.push(r); map.set(k, g)
  }
  return [...map.entries()].map(([key, grp]) => {
    const aggregates: Record<string, number> = {}
    for (const ak of aggregateKeys) {
      const sum = grp.reduce((s, r) => s + (Number(valueOf(r, ak)) || 0), 0)
      aggregates[`${ak}:sum`] = sum
      aggregates[`${ak}:avg`] = grp.length ? sum / grp.length : 0
    }
    return { key, rows: grp, count: grp.length, aggregates }
  }).sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }))
}

// ── Selection engine ────────────────────────────────────────────────────────
/** Toggle a single id in a selection set (non-mutating). */
export function toggleSelect(sel: Set<string>, id: string): Set<string> {
  const n = new Set(sel); n.has(id) ? n.delete(id) : n.add(id); return n
}
/** Select the inclusive range of ids between anchor and target (shift-click). */
export function rangeSelect(orderedIds: string[], anchor: string, target: string, sel: Set<string>): Set<string> {
  const a = orderedIds.indexOf(anchor), b = orderedIds.indexOf(target)
  if (a === -1 || b === -1) return toggleSelect(sel, target)
  const [lo, hi] = a < b ? [a, b] : [b, a]
  const n = new Set(sel)
  for (let i = lo; i <= hi; i++) n.add(orderedIds[i])
  return n
}
/** Invert selection across a known id universe. */
export function invertSelection(allIds: string[], sel: Set<string>): Set<string> {
  return new Set(allIds.filter(id => !sel.has(id)))
}
/** Are all/some of these ids selected? (for the header tri-state checkbox) */
export function selectionState(ids: string[], sel: Set<string>): 'none' | 'some' | 'all' {
  if (ids.length === 0) return 'none'
  const n = ids.filter(id => sel.has(id)).length
  return n === 0 ? 'none' : n === ids.length ? 'all' : 'some'
}

// ── View / preferences state ────────────────────────────────────────────────
export interface TableView {
  columnOrder?: string[]
  columnWidths?: Record<string, number>
  hidden?: string[]
  pinned?: Record<string, 'start' | 'end'>
  sort?: SortSpec[]
  filters?: Record<string, ColumnFilter>
  groupBy?: string | null
  density?: 'comfortable' | 'compact'
  pageSize?: number
}

/** Order + filter columns for rendering per a saved view (pure). Unknown keys ignored. */
export function applyColumnView<T extends object>(columns: Column<T>[], view: TableView): Column<T>[] {
  const byKey = new Map(columns.map(c => [c.key, c]))
  const ordered: Column<T>[] = []
  const seen = new Set<string>()
  for (const k of view.columnOrder ?? []) { const c = byKey.get(k); if (c) { ordered.push(c); seen.add(k) } }
  for (const c of columns) if (!seen.has(c.key)) ordered.push(c)
  // A view's hidden list plus any column declared hidden-by-default (unless the
  // view explicitly re-orders/keeps it — an explicit columnOrder entry un-hides).
  const shown = new Set(view.columnOrder ?? [])
  const hidden = new Set([
    ...(view.hidden ?? []),
    ...columns.filter(c => c.hidden && !shown.has(c.key)).map(c => c.key),
  ])
  return ordered
    .filter(c => !hidden.has(c.key))
    .map(c => ({ ...c, width: view.columnWidths?.[c.key] ?? c.width, pinned: view.pinned?.[c.key] ?? c.pinned }))
}
