/**
 * Reporting Platform — pure pivot / aggregation / CSV core (Phase 21.9).
 *
 * Grouping, aggregation, pivot-table building and CSV serialisation with no I/O →
 * fully unit-tested. The report data layer produces flat rows; these helpers turn
 * them into grouped summaries, pivots and exports. Shared by every report so the
 * maths lives in one place.
 */

export type Row = Record<string, unknown>
export type AggFn = 'sum' | 'count' | 'avg' | 'min' | 'max'

function num(v: unknown): number { const n = Number(v); return Number.isFinite(n) ? n : 0 }
function round2(n: number): number { return Math.round(n * 100) / 100 }

/** Group rows by a key field. */
export function groupBy(rows: Row[], key: string): Map<string, Row[]> {
  const m = new Map<string, Row[]>()
  for (const r of rows) {
    const k = String(r[key] ?? '—')
    const g = m.get(k) ?? []
    g.push(r); m.set(k, g)
  }
  return m
}

/** Aggregate a measure across a set of rows. */
export function aggregate(rows: Row[], measure: string, fn: AggFn): number {
  if (fn === 'count') return rows.length
  const vals = rows.map(r => num(r[measure]))
  if (vals.length === 0) return 0
  switch (fn) {
    case 'sum': return round2(vals.reduce((s, v) => s + v, 0))
    case 'avg': return round2(vals.reduce((s, v) => s + v, 0) / vals.length)
    case 'min': return Math.min(...vals)
    case 'max': return Math.max(...vals)
  }
}

export interface GroupSummary { group: string; value: number; count: number }
/** Group by a field and aggregate a measure per group (sorted by value desc). */
export function summarize(rows: Row[], groupField: string, measure: string, fn: AggFn = 'sum'): GroupSummary[] {
  return [...groupBy(rows, groupField).entries()]
    .map(([group, g]) => ({ group, value: aggregate(g, measure, fn), count: g.length }))
    .sort((a, b) => b.value - a.value)
}

export interface PivotTable { cols: string[]; rows: { key: string; cells: Record<string, number>; total: number }[]; colTotals: Record<string, number>; grandTotal: number }
/** Build a pivot table: rowField × colField, aggregating `measure`. */
export function pivot(rows: Row[], rowField: string, colField: string, measure: string, fn: AggFn = 'sum'): PivotTable {
  const cols = [...new Set(rows.map(r => String(r[colField] ?? '—')))].sort()
  const rowKeys = [...new Set(rows.map(r => String(r[rowField] ?? '—')))].sort()
  const colTotals: Record<string, number> = Object.fromEntries(cols.map(c => [c, 0]))
  let grandTotal = 0
  const out = rowKeys.map(rk => {
    const cells: Record<string, number> = {}
    let total = 0
    for (const c of cols) {
      const matched = rows.filter(r => String(r[rowField] ?? '—') === rk && String(r[colField] ?? '—') === c)
      const v = aggregate(matched, measure, fn)
      cells[c] = v; total = round2(total + v); colTotals[c] = round2(colTotals[c] + v)
    }
    grandTotal = round2(grandTotal + total)
    return { key: rk, cells, total }
  })
  return { cols, rows: out, colTotals, grandTotal }
}

export interface Column { key: string; label: string }
/** Serialise rows to CSV (RFC-4180 quoting). */
export function toCsv(columns: Column[], rows: Row[]): string {
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = columns.map(c => esc(c.label)).join(',')
  const body = rows.map(r => columns.map(c => esc(r[c.key])).join(',')).join('\n')
  return `${header}\n${body}`
}
