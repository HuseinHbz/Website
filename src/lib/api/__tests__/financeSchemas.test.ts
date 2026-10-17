import { describe, it, expect } from 'vitest'
import { money, signedMoney, qty, pct, isoDate, currencyCode, idParam } from '../financeSchemas'

describe('financeSchemas (ERPFIX-4, BUG-ERP-18)', () => {
  it('money rejects negative/NaN/Infinity, accepts 0 and a real amount', () => {
    expect(money.safeParse(-1).success).toBe(false)
    expect(money.safeParse(NaN).success).toBe(false)
    expect(money.safeParse(Infinity).success).toBe(false)
    expect(money.safeParse(0).success).toBe(true)
    expect(money.safeParse(1_000_000).success).toBe(true)
  })
  it('signedMoney allows negative (credit notes), still rejects non-finite', () => {
    expect(signedMoney.safeParse(-500).success).toBe(true)
    expect(signedMoney.safeParse(NaN).success).toBe(false)
  })
  it('qty rejects zero and negative; accepts a positive amount', () => {
    expect(qty.safeParse(0).success).toBe(false)
    expect(qty.safeParse(-5).success).toBe(false)
    expect(qty.safeParse(1).success).toBe(true)
  })
  it('pct is bounded 0-100', () => {
    expect(pct.safeParse(-1).success).toBe(false)
    expect(pct.safeParse(101).success).toBe(false)
    expect(pct.safeParse(500).success).toBe(false)
    expect(pct.safeParse(0).success).toBe(true)
    expect(pct.safeParse(100).success).toBe(true)
  })
  it('isoDate rejects a non-date string and an impossible calendar date', () => {
    expect(isoDate.safeParse('abc').success).toBe(false)
    expect(isoDate.safeParse('2024-02-30').success).toBe(false)
    expect(isoDate.safeParse('2024-13-01').success).toBe(false)
    expect(isoDate.safeParse('2024-02-29').success).toBe(true)
  })
  it('currencyCode requires exactly 3 uppercase letters', () => {
    expect(currencyCode.safeParse('usd').success).toBe(false)
    expect(currencyCode.safeParse('US').success).toBe(false)
    expect(currencyCode.safeParse('USD').success).toBe(true)
  })
  it('idParam coerces a numeric string and rejects garbage/negative/zero', () => {
    expect(idParam.safeParse('42').success).toBe(true)
    expect(idParam.safeParse('abc').success).toBe(false)
    expect(idParam.safeParse('-1').success).toBe(false)
    expect(idParam.safeParse('0').success).toBe(false)
    expect(idParam.safeParse(null).success).toBe(false)
  })
})
