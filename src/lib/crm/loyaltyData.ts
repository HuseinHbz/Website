/**
 * Phase 27 بند۲ — loyalty server layer.
 *
 * Invariant this module exists to protect: **the balance is never written by a
 * caller.** Every mutation goes through `postTransaction`, which appends to the
 * ledger and then recomputes the cached balance from it. That is what makes the
 * reversal path correct — and it is the same discipline the GL uses.
 */
import { pgQuery } from '@/lib/db'
import {
  balanceOf, totalEarned, totalSpent, pointsForInvoice, reversalFor, tierFor,
  canRedeem, checkCoupon, expiredPoints,
  type LoyaltyTx, type LoyaltyTxKind, type Coupon, type Tier,
} from './loyalty'

const NOW = `to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`

export interface Program {
  id: number; nameEn: string; nameFa: string; kind: string
  earnRate: number; redeemRate: number; pointsExpireDays: number | null; active: boolean
}

export async function activeProgram(): Promise<Program | null> {
  const r = await pgQuery<Program>(
    `SELECT id, name_en AS "nameEn", name_fa AS "nameFa", kind,
            earn_rate::float AS "earnRate", redeem_rate::float AS "redeemRate",
            points_expire_days AS "pointsExpireDays", active::boolean AS active
     FROM loyalty_programs WHERE active=1 ORDER BY id LIMIT 1`)
  return r[0] ?? null
}

export async function listPrograms() {
  return await pgQuery<Program>(
    `SELECT id, name_en AS "nameEn", name_fa AS "nameFa", kind,
            earn_rate::float AS "earnRate", redeem_rate::float AS "redeemRate",
            points_expire_days AS "pointsExpireDays", active::boolean AS active
     FROM loyalty_programs ORDER BY id`)
}

export async function tiersOf(programId: number): Promise<Tier[]> {
  return await pgQuery<Tier>(
    `SELECT id, name_en AS "nameEn", name_fa AS "nameFa",
            threshold::float AS threshold, discount_pct::float AS "discountPct"
     FROM loyalty_tiers WHERE program_id=$1 ORDER BY threshold`, [programId])
}

/** Get or create the customer's account for a programme. */
export async function accountFor(customerId: number, programId: number): Promise<number> {
  const existing = (await pgQuery<{ id: number }>(
    `SELECT id FROM loyalty_accounts WHERE customer_id=$1 AND program_id=$2`,
    [customerId, programId]))[0]
  if (existing) return existing.id
  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO loyalty_accounts (customer_id, program_id) VALUES ($1,$2)
     ON CONFLICT (customer_id, program_id) DO UPDATE SET updated_at=${NOW}
     RETURNING id`, [customerId, programId]))[0]
  return row.id
}

export async function ledgerOf(accountId: number): Promise<(LoyaltyTx & { id: number; note: string | null })[]> {
  return await pgQuery<LoyaltyTx & { id: number; note: string | null }>(
    `SELECT id, kind, points::float AS points, ref_type AS "refType", ref_id AS "refId",
            note, created_at AS "createdAt"
     FROM loyalty_transactions WHERE account_id=$1 ORDER BY id DESC`, [accountId])
}

/**
 * THE only way points move.
 *
 * Appends a signed row, then recomputes balance/earned/spent and the tier from
 * the ledger. The cached columns are a read optimisation; if they ever
 * disagreed with the ledger, the ledger wins by construction.
 */
export async function postTransaction(
  accountId: number,
  kind: LoyaltyTxKind,
  points: number,
  opts: { refType?: string; refId?: number; note?: string; userId?: string } = {},
): Promise<{ id: number; balance: number; tierId: number | null }> {
  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO loyalty_transactions (account_id, kind, points, ref_type, ref_id, note, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [accountId, kind, points, opts.refType ?? null, opts.refId ?? null, opts.note ?? null, opts.userId ?? null],
  ))[0]

  const txs = await ledgerOf(accountId)
  const balance = balanceOf(txs)
  const prog = (await pgQuery<{ program_id: number }>(
    `SELECT program_id FROM loyalty_accounts WHERE id=$1`, [accountId]))[0]
  const tier = prog ? tierFor(balance, await tiersOf(prog.program_id)) : null

  await pgQuery(
    `UPDATE loyalty_accounts SET balance=$2, total_earned=$3, total_spent=$4, tier_id=$5, updated_at=${NOW}
     WHERE id=$1`,
    [accountId, balance, totalEarned(txs), totalSpent(txs), tier?.id ?? null])

  return { id: row.id, balance, tierId: tier?.id ?? null }
}

/**
 * Award points for a confirmed invoice. Idempotent: a second call for the same
 * invoice finds the existing `earn` row and does nothing, so re-confirming or a
 * retried webhook cannot mint points twice.
 */
export async function earnForInvoice(
  invoiceId: number, userId?: string,
): Promise<{ awarded: number; skipped?: string }> {
  const prog = await activeProgram()
  if (!prog) return { awarded: 0, skipped: 'no active programme' }

  const inv = (await pgQuery<{ id: number; customer_id: number | null; total: number; status: string }>(
    `SELECT id, customer_id, total::float AS total, status FROM sales_documents
     WHERE id=$1 AND doc_type='invoice'`, [invoiceId]))[0]
  if (!inv || !inv.customer_id) return { awarded: 0, skipped: 'invoice or customer missing' }

  const points = pointsForInvoice(inv.total, prog.earnRate, inv.status)
  if (points <= 0) return { awarded: 0, skipped: `status ${inv.status} does not earn` }

  const accountId = await accountFor(inv.customer_id, prog.id)
  const already = (await pgQuery<{ id: number }>(
    `SELECT id FROM loyalty_transactions
     WHERE account_id=$1 AND kind='earn' AND ref_type='sales_invoice' AND ref_id=$2`,
    [accountId, invoiceId]))[0]
  if (already) return { awarded: 0, skipped: 'already awarded' }

  await postTransaction(accountId, 'earn', points,
    { refType: 'sales_invoice', refId: invoiceId, note: 'Invoice confirmed', userId })
  return { awarded: points }
}

/**
 * Reverse the points an invoice earned, when it is returned or voided.
 *
 * Mirrors `reverseEntry` in the GL: the original `earn` row stays posted and a
 * compensating `reversal` row is appended, so both sides remain visible and the
 * net is zero. Idempotent — reversing twice does not double-subtract.
 */
export async function reverseForInvoice(
  invoiceId: number, userId?: string,
): Promise<{ reversed: number; skipped?: string }> {
  const earn = (await pgQuery<{ id: number; account_id: number; points: number }>(
    `SELECT id, account_id, points::float AS points FROM loyalty_transactions
     WHERE kind='earn' AND ref_type='sales_invoice' AND ref_id=$1`, [invoiceId]))[0]
  if (!earn) return { reversed: 0, skipped: 'nothing was earned for this invoice' }

  const already = (await pgQuery<{ id: number }>(
    `SELECT id FROM loyalty_transactions
     WHERE account_id=$1 AND kind='reversal' AND ref_type='sales_invoice' AND ref_id=$2`,
    [earn.account_id, invoiceId]))[0]
  if (already) return { reversed: 0, skipped: 'already reversed' }

  const delta = reversalFor(earn.points)
  await postTransaction(earn.account_id, 'reversal', delta,
    { refType: 'sales_invoice', refId: invoiceId, note: 'Invoice returned/voided', userId })
  return { reversed: Math.abs(delta) }
}

/** Redeem points. Refuses (never clamps) when the balance is short. */
export async function redeemPoints(
  customerId: number, points: number, opts: { refType?: string; refId?: number; userId?: string } = {},
): Promise<{ ok: boolean; error?: string; value?: number; balance?: number }> {
  const prog = await activeProgram()
  if (!prog) return { ok: false, error: 'No active loyalty programme' }
  const accountId = await accountFor(customerId, prog.id)
  const balance = balanceOf(await ledgerOf(accountId))

  const check = canRedeem(balance, points, prog.redeemRate)
  if (!check.ok) {
    return { ok: false, error: check.reason === 'insufficient' ? 'Insufficient points' : 'Invalid amount' }
  }
  const r = await postTransaction(accountId, 'redeem', -points,
    { refType: opts.refType, refId: opts.refId, note: 'Points redeemed', userId: opts.userId })
  return { ok: true, value: check.value, balance: r.balance }
}

/** Expire stale points — writes an `expire` movement, never a silent deletion. */
export async function expirePoints(userId?: string): Promise<{ accounts: number; points: number }> {
  const prog = await activeProgram()
  if (!prog?.pointsExpireDays) return { accounts: 0, points: 0 }
  const accounts = await pgQuery<{ id: number }>(
    `SELECT id FROM loyalty_accounts WHERE program_id=$1 AND balance > 0`, [prog.id])
  let touched = 0, total = 0
  for (const a of accounts) {
    const amount = expiredPoints(await ledgerOf(a.id), prog.pointsExpireDays)
    if (amount <= 0) continue
    await postTransaction(a.id, 'expire', -amount, { note: 'Points expired', userId })
    touched++; total += amount
  }
  return { accounts: touched, points: total }
}

/** The loyalty panel for one customer — used by Customer 360 and the portal. */
export async function customerLoyalty(customerId: number) {
  const prog = await activeProgram()
  if (!prog) return { program: null, account: null, ledger: [], tier: null, tiers: [] }
  const accountId = await accountFor(customerId, prog.id)
  const ledger = await ledgerOf(accountId)
  const balance = balanceOf(ledger)
  const tiers = await tiersOf(prog.id)
  return {
    program: prog,
    account: {
      id: accountId, balance,
      totalEarned: totalEarned(ledger), totalSpent: totalSpent(ledger),
      value: balance * prog.redeemRate,
    },
    tier: tierFor(balance, tiers),
    tiers,
    ledger,
  }
}

// ── Coupons ─────────────────────────────────────────────────────────────────

export async function listCoupons(): Promise<(Coupon & { redemptions: number })[]> {
  return await pgQuery<Coupon & { redemptions: number }>(
    `SELECT c.id, c.code, c.kind, c.value::float AS value,
            c.min_order_total::float AS "minOrderTotal", c.max_redemptions AS "maxRedemptions",
            c.max_per_customer AS "maxPerCustomer", c.valid_from AS "validFrom",
            c.valid_until AS "validUntil", c.active::boolean AS active,
            (SELECT count(*) FROM coupon_redemptions r WHERE r.coupon_id=c.id)::int AS redemptions
     FROM coupons c ORDER BY c.id DESC`)
}

/**
 * Validate a coupon for a specific customer and order.
 *
 * All limits are counted from the database here — the client's copy of the
 * coupon is never trusted, so a tampered form cannot spend an expired code.
 */
export async function validateCoupon(
  code: string, customerId: number | null, orderTotal: number,
): Promise<{ ok: boolean; reason?: string; discount: number; couponId?: number }> {
  const c = (await pgQuery<Coupon>(
    `SELECT id, code, kind, value::float AS value, min_order_total::float AS "minOrderTotal",
            max_redemptions AS "maxRedemptions", max_per_customer AS "maxPerCustomer",
            valid_from AS "validFrom", valid_until AS "validUntil", active::boolean AS active
     FROM coupons WHERE upper(code)=upper($1)`, [code]))[0]

  const totalRedemptions = c
    ? Number((await pgQuery<{ n: string }>(
      `SELECT count(*)::text AS n FROM coupon_redemptions WHERE coupon_id=$1`, [c.id]))[0]?.n ?? 0)
    : 0
  const customerRedemptions = c && customerId
    ? Number((await pgQuery<{ n: string }>(
      `SELECT count(*)::text AS n FROM coupon_redemptions WHERE coupon_id=$1 AND customer_id=$2`,
      [c.id, customerId]))[0]?.n ?? 0)
    : 0

  const r = checkCoupon(c ?? null, { orderTotal, totalRedemptions, customerRedemptions })
  return { ok: r.ok, reason: r.reason, discount: r.discount, couponId: c?.id }
}

/** Record a redemption. The caller wraps this in `runOnce` (26.32). */
export async function redeemCoupon(
  couponId: number, customerId: number | null, salesDocumentId: number | null, discount: number,
) {
  await pgQuery(
    `INSERT INTO coupon_redemptions (coupon_id, customer_id, sales_document_id, discount_amount)
     VALUES ($1,$2,$3,$4)`, [couponId, customerId, salesDocumentId, discount])
}

/** Club-wide figures for the CRM dashboard (بند۴). */
export async function loyaltyOverview() {
  const prog = await activeProgram()
  if (!prog) return { program: null, pointsOutstanding: 0, members: 0, tierDistribution: [], couponRedemptions: 0, couponDiscount: 0 }
  const agg = (await pgQuery<{ members: string; outstanding: string }>(
    `SELECT count(*)::text AS members, COALESCE(SUM(balance),0)::text AS outstanding
     FROM loyalty_accounts WHERE program_id=$1`, [prog.id]))[0]
  const tierDistribution = await pgQuery<{ tier: string; count: number }>(
    `SELECT COALESCE(t.name_fa,'—') AS tier, count(*)::int AS count
     FROM loyalty_accounts a LEFT JOIN loyalty_tiers t ON t.id=a.tier_id
     WHERE a.program_id=$1 GROUP BY t.name_fa ORDER BY count DESC`, [prog.id])
  const cp = (await pgQuery<{ n: string; total: string }>(
    `SELECT count(*)::text AS n, COALESCE(SUM(discount_amount),0)::text AS total FROM coupon_redemptions`))[0]
  return {
    program: prog,
    members: Number(agg?.members ?? 0),
    // Points outstanding × redeem rate is the company's open liability.
    pointsOutstanding: Number(agg?.outstanding ?? 0),
    liabilityValue: Number(agg?.outstanding ?? 0) * prog.redeemRate,
    tierDistribution,
    couponRedemptions: Number(cp?.n ?? 0),
    couponDiscount: Number(cp?.total ?? 0),
  }
}
