import { describe, it, expect } from 'vitest'
import { buildLine, buildInvoice, validateInvoice, type MoadianInvoiceInput } from '../moadian/invoice'
import { taxUniqueId } from '../moadian/moadianData'

const base: MoadianInvoiceInput = {
  pattern: '1', serial: 'INV-1403-000001', issueDateMs: 1710000000000, taxId: 'ABC',
  seller: { economicCode: '411111111111', name: 'HBZ', tccim: 2 },
  buyer: { economicCode: '422222222222', name: 'Acme', tccim: 2 },
  lines: [
    { description: 'Widget', quantity: 2, unitPrice: 1_000_000, discount: 100_000, vatRate: 9 },
    { description: 'Service', quantity: 1, unitPrice: 5_000_000, discount: 0, vatRate: 9 },
  ],
}

describe('moadian line math (قلم)', () => {
  it('computes discount → vat → total per line', () => {
    const l = buildLine({ description: 'x', quantity: 2, unitPrice: 1_000_000, discount: 100_000, vatRate: 9 })
    expect(l.prdis).toBe(1_900_000)          // 2M - 100k
    expect(l.vam).toBe(171_000)              // 9% of 1.9M
    expect(l.tsstam).toBe(2_071_000)         // afterDiscount + vat
  })
  it('falls back to a generic stuff-id when none given', () => {
    expect(buildLine({ description: 'svc', quantity: 1, unitPrice: 100, discount: 0, vatRate: 0 }).sstid).toBe('2001000000000')
  })
})

describe('moadian invoice header totals', () => {
  const inv = buildInvoice(base)
  it('derives totals from the lines (self-reconciling)', () => {
    // Line1: 1.9M + 171k = 2,071,000 ; Line2: 5M + 450k = 5,450,000
    expect(inv.header.tvam).toBe(171_000 + 450_000)
    expect(inv.header.tbill).toBe(2_071_000 + 5_450_000)
    expect(inv.header.tdis).toBe(100_000)
    expect(inv.header.tadis).toBe(1_900_000 + 5_000_000)
  })
  it('passes validation for a well-formed invoice', () => {
    expect(validateInvoice(inv)).toEqual([])
  })
  it('flags a seller without economic code + total mismatch', () => {
    const bad = buildInvoice({ ...base, seller: { name: 'x' } })
    bad.header.tbill = 999 // corrupt total
    const errs = validateInvoice(bad)
    expect(errs.some(e => e.includes('فروشنده'))).toBe(true)
    expect(errs.some(e => e.includes('همخوانی'))).toBe(true)
  })
})

describe('taxUniqueId', () => {
  it('is deterministic and memory-id prefixed', () => {
    const a = taxUniqueId('MEM123', 'INV-1', 1710000000000)
    const b = taxUniqueId('MEM123', 'INV-1', 1710000000000)
    expect(a).toBe(b)
    expect(a.startsWith('MEM123')).toBe(true)
    expect(taxUniqueId('MEM123', 'INV-2', 1710000000000)).not.toBe(a)
  })
})
