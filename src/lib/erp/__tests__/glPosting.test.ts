import { describe, it, expect } from 'vitest'
import { applyGlMap, reversalLines, type GlMap } from '../glPosting'
import { salesInvoicePostingLines } from '../sales'

const MAP: GlMap = { ar: '1105', revenue: '4010', vat: '2110', ap: '2005', inventory: '1205', bank: '1015' }

describe('applyGlMap (بند ۱.۱ configurable mapping)', () => {
  it('translates every default code through the erp_settings map', () => {
    const lines = applyGlMap(salesInvoicePostingLines(1_000_000, 90_000, 1_090_000, 'invoice'), MAP)
    const codes = lines.map(l => l.accountCode).sort()
    expect(codes).toEqual(['1105', '2110', '4010'])
  })
  it('leaves unknown codes untouched', () => {
    const out = applyGlMap([{ accountCode: '6100', debit: 5, credit: 0, memo: '' }], MAP)
    expect(out[0].accountCode).toBe('6100')
  })
  it('identity map is a no-op', () => {
    const id: GlMap = { ar: '1100', revenue: '4000', vat: '2100', ap: '2000', inventory: '1200', bank: '1010' }
    const src = salesInvoicePostingLines(100, 9, 109, 'invoice')
    expect(applyGlMap(src, id)).toEqual(src)
  })
})

describe('reversalLines (بند ۲.۱ reversal entry)', () => {
  const src = [
    { accountId: 1, debit: 1_090_000, credit: 0, memo: 'AR' },
    { accountId: 2, debit: 0, credit: 1_000_000, memo: 'Rev' },
    { accountId: 3, debit: 0, credit: 90_000, memo: 'VAT' },
  ]
  it('mirrors debit and credit on every line', () => {
    const rev = reversalLines(src)
    expect(rev[0]).toMatchObject({ accountId: 1, debit: 0, credit: 1_090_000 })
    expect(rev[1]).toMatchObject({ accountId: 2, debit: 1_000_000, credit: 0 })
    expect(rev[2]).toMatchObject({ accountId: 3, debit: 90_000, credit: 0 })
  })
  it('a reversal of a balanced entry stays balanced', () => {
    const rev = reversalLines(src)
    const dr = rev.reduce((s, l) => s + l.debit, 0)
    const cr = rev.reduce((s, l) => s + l.credit, 0)
    expect(dr).toBe(cr)
    expect(dr).toBe(1_090_000)
  })
  it('source + reversal net to zero per account', () => {
    const rev = reversalLines(src)
    for (let i = 0; i < src.length; i++)
      expect(src[i].debit - src[i].credit + rev[i].debit - rev[i].credit).toBe(0)
  })
})
