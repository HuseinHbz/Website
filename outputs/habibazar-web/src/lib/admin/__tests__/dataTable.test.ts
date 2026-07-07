import { describe, it, expect } from 'vitest'
import { sortRows, filterRows, paginate, nextSort } from '../dataTable'

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
