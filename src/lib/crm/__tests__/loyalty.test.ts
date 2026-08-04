/**
 * Phase 27 بند۲ — the loyalty engine.
 *
 * These lock the property that makes points safe to promise: the balance is
 * the ledger, a returned invoice reverses its points, and a coupon cannot be
 * talked past its limits by the client.
 */
import { describe, it, expect } from 'vitest'
import {
  balanceOf, totalEarned, totalSpent, pointsForInvoice, reversalFor, tierFor,
  pointsValue, canRedeem, expiredPoints, checkCoupon, refusalMessage,
  type LoyaltyTx, type Coupon,
} from '../loyalty'

const tx = (points: number, kind: LoyaltyTx['kind'] = 'earn', createdAt?: string): LoyaltyTx =>
  ({ kind, points, createdAt })

describe('balance is derived from the ledger', () => {
  it('sums signed movements', () => {
    expect(balanceOf([tx(100), tx(-30, 'redeem'), tx(50)])).toBe(120)
  })
  it('an empty ledger is zero, not NaN', () => {
    expect(balanceOf([])).toBe(0)
  })
  it('separates earned from spent', () => {
    const l = [tx(100), tx(-40, 'redeem'), tx(20)]
    expect(totalEarned(l)).toBe(120)
    expect(totalSpent(l)).toBe(40)
  })
})

describe('earning', () => {
  it('a confirmed invoice earns', () => {
    expect(pointsForInvoice(1_000_000, 0.001, 'confirmed')).toBe(1000)
  })
  it('paid and partial also earn', () => {
    expect(pointsForInvoice(1_000_000, 0.001, 'paid')).toBe(1000)
    expect(pointsForInvoice(1_000_000, 0.001, 'partial')).toBe(1000)
  })
  it('a DRAFT earns nothing — no liability for a sale that may not happen', () => {
    expect(pointsForInvoice(1_000_000, 0.001, 'draft')).toBe(0)
  })
  it('a void invoice earns nothing', () => {
    expect(pointsForInvoice(1_000_000, 0.001, 'void')).toBe(0)
  })
  it('a zero or negative total earns nothing', () => {
    expect(pointsForInvoice(0, 0.001, 'confirmed')).toBe(0)
    expect(pointsForInvoice(-500, 0.001, 'confirmed')).toBe(0)
  })
})

describe('reversal — the BUG-020 principle applied to points', () => {
  it('is the negative of what was earned', () => {
    expect(reversalFor(1000)).toBe(-1000)
  })
  it('is negative even if handed a negative (idempotent in sign)', () => {
    expect(reversalFor(-1000)).toBe(-1000)
  })
  it('returning an invoice brings the balance back to where it started', () => {
    const earned = pointsForInvoice(2_000_000, 0.001, 'confirmed')   // 2000
    const ledger = [tx(earned, 'earn'), tx(reversalFor(earned), 'reversal')]
    expect(balanceOf(ledger)).toBe(0)
  })
  it('the original earn row SURVIVES the reversal — history is not erased', () => {
    const ledger = [tx(2000, 'earn'), tx(reversalFor(2000), 'reversal')]
    expect(ledger.filter(t => t.kind === 'earn')).toHaveLength(1)
    expect(totalEarned(ledger)).toBe(2000)
  })
  it('a reversal after a partial spend can leave the balance negative — surfaced, not hidden', () => {
    // earn 1000, spend 800, then the invoice is returned
    const ledger = [tx(1000, 'earn'), tx(-800, 'redeem'), tx(reversalFor(1000), 'reversal')]
    expect(balanceOf(ledger)).toBe(-800)
  })
})

describe('tiers', () => {
  const tiers = [
    { id: 1, nameEn: 'Bronze', nameFa: 'برنز', threshold: 0, discountPct: 0 },
    { id: 2, nameEn: 'Silver', nameFa: 'نقره', threshold: 1000, discountPct: 5 },
    { id: 3, nameEn: 'Gold', nameFa: 'طلا', threshold: 5000, discountPct: 10 },
  ]
  it('picks the highest threshold cleared', () => {
    expect(tierFor(6000, tiers)?.nameEn).toBe('Gold')
    expect(tierFor(1500, tiers)?.nameEn).toBe('Silver')
    expect(tierFor(10, tiers)?.nameEn).toBe('Bronze')
  })
  it('is exact at the boundary', () => {
    expect(tierFor(1000, tiers)?.nameEn).toBe('Silver')
  })
  it('returns null when no tier is reached', () => {
    expect(tierFor(-5, tiers)).toBeNull()
  })
  it('handles an unsorted tier list', () => {
    expect(tierFor(6000, [...tiers].reverse())?.nameEn).toBe('Gold')
  })
})

describe('redemption', () => {
  it('converts points to currency', () => {
    expect(pointsValue(500, 10)).toBe(5000)
  })
  it('allows a redemption within balance', () => {
    expect(canRedeem(1000, 400, 10)).toMatchObject({ ok: true, value: 4000 })
  })
  it('REFUSES rather than clamping when the balance is short', () => {
    const r = canRedeem(300, 400, 10)
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('insufficient')
    expect(r.value).toBe(0)
  })
  it('rejects zero and negative requests', () => {
    expect(canRedeem(1000, 0, 10).reason).toBe('invalid')
    expect(canRedeem(1000, -5, 10).reason).toBe('invalid')
  })
})

describe('expiry', () => {
  const now = new Date('2026-06-01').getTime()
  const old = '2026-01-01'   // ~150 days earlier
  const recent = '2026-05-25'

  it('expires points older than the window', () => {
    expect(expiredPoints([tx(500, 'earn', old)], 90, now)).toBe(500)
  })
  it('leaves recent points alone', () => {
    expect(expiredPoints([tx(500, 'earn', recent)], 90, now)).toBe(0)
  })
  it('never expires more than the balance — a spent customer cannot go negative', () => {
    const ledger = [tx(500, 'earn', old), tx(-400, 'redeem', recent)]
    expect(expiredPoints(ledger, 90, now)).toBe(100)
  })
  it('a programme with no expiry expires nothing', () => {
    expect(expiredPoints([tx(500, 'earn', old)], null, now)).toBe(0)
  })
})

describe('coupons — every limit enforced server-side', () => {
  const base: Coupon = {
    id: 1, code: 'HBZ10', kind: 'percent', value: 10, minOrderTotal: 0,
    maxRedemptions: null, maxPerCustomer: 1, active: true,
  }
  const ctx = { orderTotal: 1_000_000, totalRedemptions: 0, customerRedemptions: 0 }

  it('computes a percentage discount', () => {
    expect(checkCoupon(base, ctx)).toMatchObject({ ok: true, discount: 100_000 })
  })
  it('computes a fixed-amount discount', () => {
    expect(checkCoupon({ ...base, kind: 'amount', value: 50_000 }, ctx).discount).toBe(50_000)
  })
  it('never discounts more than the order — a sale must not become a payout', () => {
    expect(checkCoupon({ ...base, kind: 'amount', value: 9_999_999 }, ctx).discount).toBe(1_000_000)
  })
  it('refuses an unknown code', () => {
    expect(checkCoupon(null, ctx).reason).toBe('not_found')
  })
  it('refuses an inactive coupon', () => {
    expect(checkCoupon({ ...base, active: false }, ctx).reason).toBe('inactive')
  })
  it('refuses before the start date', () => {
    expect(checkCoupon({ ...base, validFrom: '2099-01-01' }, ctx).reason).toBe('not_started')
  })
  it('refuses after expiry', () => {
    expect(checkCoupon({ ...base, validUntil: '2000-01-01' }, ctx).reason).toBe('expired')
  })
  it('refuses below the minimum order', () => {
    expect(checkCoupon({ ...base, minOrderTotal: 5_000_000 }, ctx).reason).toBe('below_minimum')
  })
  it('refuses once the global limit is reached', () => {
    expect(checkCoupon({ ...base, maxRedemptions: 10 }, { ...ctx, totalRedemptions: 10 }).reason).toBe('limit_reached')
  })
  it('refuses a second use by the same customer', () => {
    expect(checkCoupon(base, { ...ctx, customerRedemptions: 1 }).reason).toBe('customer_limit_reached')
  })
  it('explains the refusal in the reader’s language', () => {
    expect(refusalMessage('expired', true)).toBe('اعتبار این کد تخفیف تمام شده است')
    expect(refusalMessage('expired', false)).toBe('This coupon has expired')
  })
})
