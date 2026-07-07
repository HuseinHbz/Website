import { describe, it, expect } from 'vitest'
import { toCsv, toJson, toExcelXml, parseCsv, importCsv, exportCell } from '../dataTableExport'
import type { Column } from '../dataTable'

const cols: Column[] = [
  { key: 'name', labelEn: 'Name', labelFa: 'نام' },
  { key: 'qty', labelEn: 'Qty', labelFa: 'تعداد', type: 'number', numeric: true },
  { key: '__actions', labelEn: 'Actions', labelFa: '', noExport: true },
]
const rows = [{ name: 'Acme, Inc', qty: 5 }, { name: 'Say "hi"', qty: 12 }]

describe('export', () => {
  it('CSV escapes commas/quotes, uses header, excludes noExport', () => {
    const csv = toCsv(cols, rows)
    expect(csv.split('\r\n')[0]).toBe('Name,Qty')          // actions excluded
    expect(csv).toContain('"Acme, Inc",5')
    expect(csv).toContain('"Say ""hi""",12')
  })
  it('JSON keys by column key, excludes noExport', () => {
    const j = JSON.parse(toJson(cols, rows))
    expect(j[0]).toEqual({ name: 'Acme, Inc', qty: 5 })
  })
  it('Excel XML types numbers as Number cells', () => {
    const xml = toExcelXml(cols, rows)
    expect(xml).toContain('ss:Type="Number">5<')
    expect(xml).toContain('ss:Type="String">Acme, Inc<')
  })
  it('exportCell normalizes null/objects/dates', () => {
    expect(exportCell(null)).toBe('')
    expect(exportCell({ a: 1 })).toBe('{"a":1}')
    expect(exportCell(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01-01T00:00:00.000Z')
  })
})

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, CRLF', () => {
    const m = parseCsv('a,b\r\n"x,y","he said ""hi"""\n1,2')
    expect(m).toEqual([['a', 'b'], ['x,y', 'he said "hi"'], ['1', '2']])
  })
})

describe('importCsv', () => {
  it('maps by label, coerces types, flags required + duplicates', () => {
    const csv = 'Name,Qty\nAcme,5\nAcme,7\n,9'
    const res = importCsv(csv, cols, { required: ['name'], dedupeKey: 'name' })
    expect(res.rows).toHaveLength(3)
    expect(res.rows[0]).toEqual({ name: 'Acme', qty: 5 })
    expect(res.duplicates).toEqual([3])                    // 2nd Acme (row 3)
    expect(res.errors.some(e => e.row === 4)).toBe(true)   // missing name
  })
  it('reports a non-numeric number cell', () => {
    const res = importCsv('Name,Qty\nAcme,abc', cols)
    expect(res.errors.some(e => /not a number/.test(e.message))).toBe(true)
  })
})
