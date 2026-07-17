import { describe, it, expect } from 'vitest'
import { groupBy, aggregate, summarize, pivot, toCsv, type Row } from '../pivot'

const ROWS: Row[] = [
  { region: 'US', product: 'A', amount: 100 },
  { region: 'US', product: 'B', amount: 50 },
  { region: 'EU', product: 'A', amount: 200 },
  { region: 'EU', product: 'A', amount: 25 },
]

describe('groupBy / aggregate', () => {
  it('groups rows by a field', () => {
    expect(groupBy(ROWS, 'region').get('US')).toHaveLength(2)
  })
  it('aggregates sum/count/avg/min/max', () => {
    expect(aggregate(ROWS, 'amount', 'sum')).toBe(375)
    expect(aggregate(ROWS, 'amount', 'count')).toBe(4)
    expect(aggregate(ROWS, 'amount', 'avg')).toBe(93.75)
    expect(aggregate(ROWS, 'amount', 'min')).toBe(25)
    expect(aggregate(ROWS, 'amount', 'max')).toBe(200)
  })
})

describe('summarize', () => {
  it('groups + aggregates, sorted by value desc', () => {
    const s = summarize(ROWS, 'region', 'amount', 'sum')
    expect(s[0]).toEqual({ group: 'EU', value: 225, count: 2 })
    expect(s[1]).toEqual({ group: 'US', value: 150, count: 2 })
  })
})

describe('pivot', () => {
  it('builds a region×product pivot with row/col/grand totals', () => {
    const p = pivot(ROWS, 'region', 'product', 'amount', 'sum')
    expect(p.cols).toEqual(['A', 'B'])
    const eu = p.rows.find(r => r.key === 'EU')!
    expect(eu.cells.A).toBe(225)
    expect(eu.cells.B).toBe(0)
    expect(eu.total).toBe(225)
    expect(p.colTotals.A).toBe(325)
    expect(p.grandTotal).toBe(375)
  })
})

describe('toCsv', () => {
  it('serialises with RFC-4180 quoting', () => {
    const csv = toCsv([{ key: 'region', label: 'Region' }, { key: 'note', label: 'Note' }], [
      { region: 'US', note: 'a,b' }, { region: 'EU', note: 'say "hi"' },
    ])
    expect(csv.split('\n')[0]).toBe('Region,Note')
    expect(csv).toContain('"a,b"')
    expect(csv).toContain('"say ""hi"""')
  })
})
