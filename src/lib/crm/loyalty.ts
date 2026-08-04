/**
 * Phase 27 بند۲ — the loyalty engine.
 *
 * The governing idea: **points are a financial liability, not a decoration.**
 * Every point earned is a discount the company has promised. So this module is
 * built like a ledger, not like a counter:
 *
 *   · a balance is the SUM of signed movements, never a number someone writes
 *   · earning happens from a CONFIRMED invoice, never a draft
 *   · returning that invoice REVERSES the points, exactly as a reversing GL
 *     entry undoes a posting (the 26.26b BUG-020 principle)
 *
 * A counter you can set directly is a counter that silently drifts, and a
 * loyalty balance that drifts is money.
 *
 * Everything here is pure.
 */

export type LoyaltyTxKind = 'earn' | 'redeem' | 'expire' | 'adjust' | 'reversal'

export interface LoyaltyTx {
  kind: LoyaltyTxKind
  /** Signed: earn/adjust-up positive, redeem/expire/reversal negative. */
  points: number
  refType?: string | null
  refId?: number | null
  createdAt?: string
}

export interface Tier {
  id: number
  nameEn: string
  nameFa: string
  threshold: number
  discountPct: number
}

/** Balance is derived, never stored as the truth. */
export function balanceOf(txs: LoyaltyTx[]): number {
  return round2(txs.reduce((s, t) => s + (t.points || 0), 0))
}

export function totalEarned(txs: LoyaltyTx[]): number {
  return round2(txs.filter(t => t.points > 0).reduce((s, t) => s + t.points, 0))
}

export function totalSpent(txs: LoyaltyTx[]): number {
  return round2(Math.abs(txs.filter(t => t.points < 0).reduce((s, t) => s + t.points, 0)))
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Points earned from an invoice. Only a confirmed document earns: awarding on
 * a draft would create a liability for a sale that may never happen.
 */
export function pointsForInvoice(
  invoiceTotal: number,
  earnRate: number,
  status: string,
): number {
  const EARNING_STATUSES = ['confirmed', 'partial', 'paid']
  if (!EARNING_STATUSES.includes(status)) return 0
  if (invoiceTotal <= 0) return 0
  return round2(invoiceTotal * earnRate)
}

/**
 * The reversal for a returned invoice.
 *
 * Returns a NEGATIVE movement equal to what was earned — the original earn row
 * stays in the ledger untouched, so the history still shows what happened and
 * why. Deleting the earn row instead would erase the audit trail and make the
 * two sides impossible to reconcile.
 */
export function reversalFor(earned: number): number {
  return -Math.abs(round2(earned))
}

/** Which tier a balance qualifies for — the highest threshold it clears. */
export function tierFor(balance: number, tiers: Tier[]): Tier | null {
  const sorted = [...tiers].sort((a, b) => a.threshold - b.threshold)
  let match: Tier | null = null
  for (const t of sorted) if (balance >= t.threshold) match = t
  return match
}

/** Currency value of a number of points. */
export function pointsValue(points: number, redeemRate: number): number {
  return round2(Math.max(0, points) * redeemRate)
}

export interface RedeemCheck {
  ok: boolean
  reason?: 'insufficient' | 'invalid'
  points: number
  value: number
}

/**
 * Can this many points be redeemed?
 *
 * A redemption is refused rather than clamped: silently spending fewer points
 * than the customer asked for is the kind of surprise that destroys trust in a
 * loyalty programme.
 */
export function canRedeem(balance: number, points: number, redeemRate: number): RedeemCheck {
  if (!Number.isFinite(points) || points <= 0) return { ok: false, reason: 'invalid', points: 0, value: 0 }
  if (points > balance) return { ok: false, reason: 'insufficient', points, value: 0 }
  return { ok: true, points, value: pointsValue(points, redeemRate) }
}

/** Points that have passed their expiry window, oldest first. */
export function expiredPoints(txs: LoyaltyTx[], expireDays: number | null, now = Date.now()): number {
  if (!expireDays || expireDays <= 0) return 0
  const cutoff = now - expireDays * 86_400_000
  const stale = txs
    .filter(t => t.kind === 'earn' && t.createdAt && new Date(t.createdAt).getTime() < cutoff)
    .reduce((s, t) => s + t.points, 0)
  // Never expire more than is actually there — a customer who already spent
  // their old points must not go negative.
  return round2(Math.min(Math.max(0, stale), Math.max(0, balanceOf(txs))))
}

// ── Coupons ─────────────────────────────────────────────────────────────────

export interface Coupon {
  id: number
  code: string
  kind: 'percent' | 'amount'
  value: number
  minOrderTotal: number
  maxRedemptions: number | null
  maxPerCustomer: number
  validFrom?: string | null
  validUntil?: string | null
  active: boolean
}

export type CouponRefusal =
  | 'not_found' | 'inactive' | 'not_started' | 'expired'
  | 'below_minimum' | 'limit_reached' | 'customer_limit_reached'

export interface CouponCheck {
  ok: boolean
  reason?: CouponRefusal
  discount: number
}

/**
 * Validate a coupon and compute its discount — **server-side only**.
 *
 * Every limit lives here rather than in the form, so a tampered client cannot
 * spend an expired coupon or exceed a per-customer cap. The UI may mirror
 * these checks for a nicer message; it is never the authority.
 */
export function checkCoupon(
  coupon: Coupon | null | undefined,
  ctx: { orderTotal: number; totalRedemptions: number; customerRedemptions: number; now?: number },
): CouponCheck {
  const now = ctx.now ?? Date.now()
  if (!coupon) return { ok: false, reason: 'not_found', discount: 0 }
  if (!coupon.active) return { ok: false, reason: 'inactive', discount: 0 }
  if (coupon.validFrom && new Date(coupon.validFrom).getTime() > now)
    return { ok: false, reason: 'not_started', discount: 0 }
  if (coupon.validUntil && new Date(coupon.validUntil).getTime() < now)
    return { ok: false, reason: 'expired', discount: 0 }
  if (ctx.orderTotal < coupon.minOrderTotal)
    return { ok: false, reason: 'below_minimum', discount: 0 }
  if (coupon.maxRedemptions != null && ctx.totalRedemptions >= coupon.maxRedemptions)
    return { ok: false, reason: 'limit_reached', discount: 0 }
  if (ctx.customerRedemptions >= coupon.maxPerCustomer)
    return { ok: false, reason: 'customer_limit_reached', discount: 0 }

  const raw = coupon.kind === 'percent'
    ? ctx.orderTotal * (coupon.value / 100)
    : coupon.value
  // A coupon may never exceed the order — a discount larger than the invoice
  // would turn a sale into a payout.
  return { ok: true, discount: round2(Math.min(raw, ctx.orderTotal)) }
}

export const COUPON_REFUSAL_LABELS: Record<CouponRefusal, { en: string; fa: string }> = {
  not_found:              { en: 'Coupon code not found', fa: 'کد تخفیف یافت نشد' },
  inactive:               { en: 'This coupon is not active', fa: 'این کد تخفیف فعال نیست' },
  not_started:            { en: 'This coupon is not valid yet', fa: 'زمان استفاده از این کد هنوز نرسیده است' },
  expired:                { en: 'This coupon has expired', fa: 'اعتبار این کد تخفیف تمام شده است' },
  below_minimum:          { en: 'Order total is below the coupon minimum', fa: 'مبلغ سفارش از حداقل لازم کمتر است' },
  limit_reached:          { en: 'This coupon has reached its usage limit', fa: 'ظرفیت استفاده از این کد تکمیل شده است' },
  customer_limit_reached: { en: 'You have already used this coupon', fa: 'شما قبلاً از این کد استفاده کرده‌اید' },
}

export function refusalMessage(reason: CouponRefusal, fa: boolean): string {
  const m = COUPON_REFUSAL_LABELS[reason]
  return fa ? m.fa : m.en
}
