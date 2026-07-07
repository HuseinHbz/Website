import { describe, it, expect } from 'vitest'
import {
  sortRows, filterRows, paginate, nextSort,
  nextMultiSort, multiSortRows, applyColumnFilters, groupRows,
  toggleSelect, rangeSelect, invertSelection, selectionState, applyColumnView, cellValue,
  type Column, type ColumnFilter, type SortSpec,
} from '../dataTable'

const ROWS = [
  { name: 'Beta', qty: 10 },
  { name: 'alpha', qty: 2 },
  { name: 'Gamma', qty: 30 },
]

describe('sortRows', () => {
  it('sorts strings case-insensitively, both directions, stable', () => {
    expect(sortRows(ROWS, 'name', 'asc').map(r => r.name)).toEqual(['alpha', 'Beta', 'Gamma'])
    expect(sortRows(ROWS, 'name', 'desc').map(r => r.name)).toEqual(['Gamma', 'Beta', 'alpha'])
  })
  it('sorts numeric columns by value', () => {
    expect(sortRows(ROWS, 'qty', 'asc', true).map(r => r.qty)).toEqual([2, 10, 30])
  })
  it('null key = no change', () => {
    expect(sortRows(ROWS, null, 'asc')).toEqual(ROWS)
  })
})

describe('filterRows', () => {
  it('keeps rows matching any searched column', () => {
    expect(filterRows(ROWS, 'amm', ['name']).map(r => r.name)).toEqual(['Gamma'])
    expect(filterRows(ROWS, '', ['name'])).toHaveLength(3)
  })
})

describe('paginate', () => {
  it('slices + reports metadata, clamps page', () => {
    const p = paginate(ROWS, 1, 2)
    expect(p.rows).toHaveLength(2); expect(p.pageCount).toBe(2); expect(p.from).toBe(1); expect(p.to).toBe(2)
    const p2 = paginate(ROWS, 99, 2)
    expect(p2.page).toBe(2); expect(p2.rows).toHaveLength(1)
    expect(paginate([], 1, 10).from).toBe(0)
  })
})

describe('nextSort', () => {
  it('cycles asc → desc → cleared', () => {
    expect(nextSort({ key: null, dir: 'asc' }, 'name')).toEqual({ key: 'name', dir: 'asc' })
    expect(nextSort({ key: 'name', dir: 'asc' }, 'name')).toEqual({ key: 'name', dir: 'desc' })
    expect(nextSort({ key: 'name', dir: 'desc' }, 'name')).toEqual({ key: null, dir: 'asc' })
  })
})

describe('multi-sort', () => {
  it('non-additive click resets to one column, cycles asc→desc→removed', () => {
    expect(nextMultiSort([], 'a', false)).toEqual([{ key: 'a', dir: 'asc' }])
    expect(nextMultiSort([{ key: 'a', dir: 'asc' }], 'a', false)).toEqual([{ key: 'a', dir: 'desc' }])
    expect(nextMultiSort([{ key: 'a', dir: 'desc' }], 'a', false)).toEqual([])
  })
  it('additive (shift) appends + toggles while keeping others', () => {
    const s1 = nextMultiSort([{ key: 'a', dir: 'asc' }], 'b', true)
    expect(s1).toEqual([{ key: 'a', dir: 'asc' }, { key: 'b', dir: 'asc' }])
    expect(nextMultiSort(s1, 'b', true)).toEqual([{ key: 'a', dir: 'asc' }, { key: 'b', dir: 'desc' }])
    expect(nextMultiSort([{ key: 'a', dir: 'asc' }, { key: 'b', dir: 'desc' }], 'b', true)).toEqual([{ key: 'a', dir: 'asc' }])
  })
  it('sorts by priority order', () => {
    const rows = [{ g: 'x', n: 2 }, { g: 'x', n: 1 }, { g: 'y', n: 5 }]
    const specs: SortSpec[] = [{ key: 'g', dir: 'asc' }, { key: 'n', dir: 'asc' }]
    expect(multiSortRows(rows, specs, new Set(['n'])).map(r => `${r.g}${r.n}`)).toEqual(['x1', 'x2', 'y5'])
  })
})

describe('column filters', () => {
  const rows = [
    { name: 'Acme', qty: 5, active: true, date: '2026-01-10', tags: 'gold,vip' },
    { name: 'Beta', qty: 50, active: false, date: '2026-03-01', tags: 'silver' },
    { name: 'Cara', qty: 500, active: true, date: '2026-06-15', tags: 'gold' },
  ]
  const f = (o: Record<string, ColumnFilter>) => applyColumnFilters(rows, o).map(r => r.name)
  it('text / number-range / boolean / date-range / enum / tag', () => {
    expect(f({ name: { type: 'text', value: 'ar' } })).toEqual(['Cara'])
    expect(f({ qty: { type: 'number', min: 10, max: 100 } })).toEqual(['Beta'])
    expect(f({ active: { type: 'boolean', value: true } })).toEqual(['Acme', 'Cara'])
    expect(f({ date: { type: 'date', from: '2026-02-01', to: '2026-06-15' } })).toEqual(['Beta', 'Cara'])
    expect(f({ name: { type: 'enum', values: ['Acme', 'Beta'] } })).toEqual(['Acme', 'Beta'])
    expect(f({ tags: { type: 'tag', values: ['gold', 'vip'] } })).toEqual(['Acme'])
  })
  it('empty filter map = passthrough', () => {
    expect(applyColumnFilters(rows, {})).toHaveLength(3)
  })
})

describe('groupRows', () => {
  it('groups + counts + sums/avgs', () => {
    const rows = [{ team: 'A', pts: 10 }, { team: 'A', pts: 20 }, { team: 'B', pts: 5 }]
    const g = groupRows(rows, 'team', ['pts'])
    expect(g.map(x => x.key)).toEqual(['A', 'B'])
    expect(g[0].count).toBe(2)
    expect(g[0].aggregates['pts:sum']).toBe(30)
    expect(g[0].aggregates['pts:avg']).toBe(15)
  })
})

describe('selection engine', () => {
  const ids = ['a', 'b', 'c', 'd']
  it('toggle / range / invert / state', () => {
    expect([...toggleSelect(new Set<string>(), 'a')]).toEqual(['a'])
    expect([...rangeSelect(ids, 'b', 'd', new Set())].sort()).toEqual(['b', 'c', 'd'])
    expect([...invertSelection(ids, new Set(['a', 'b']))].sort()).toEqual(['c', 'd'])
    expect(selectionState(ids, new Set(['a', 'b', 'c', 'd']))).toBe('all')
    expect(selectionState(ids, new Set(['a']))).toBe('some')
    expect(selectionState(ids, new Set())).toBe('none')
  })
})

describe('applyColumnView', () => {
  const cols: Column[] = [
    { key: 'a', labelEn: 'A', labelFa: 'A' },
    { key: 'b', labelEn: 'B', labelFa: 'B' },
    { key: 'c', labelEn: 'C', labelFa: 'C', hidden: true },
  ]
  it('reorders, hides, applies widths + pins', () => {
    const out = applyColumnView(cols, { columnOrder: ['b', 'a'], hidden: ['a'], columnWidths: { b: 200 }, pinned: { b: 'start' } })
    expect(out.map(c => c.key)).toEqual(['b'])
    expect(out[0].width).toBe(200); expect(out[0].pinned).toBe('start')
  })
  it('defaults to column-declared hidden when no view hidden set', () => {
    expect(applyColumnView(cols, {}).map(c => c.key)).toEqual(['a', 'b'])
  })
  it('cellValue uses custom value() when present', () => {
    expect(cellValue({ key: 'x', labelEn: '', labelFa: '', value: r => (r.n as number) * 2 }, { n: 3 })).toBe(6)
  })
})
