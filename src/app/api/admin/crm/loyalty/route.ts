/**
 * Phase 27 بند۲ — loyalty API.
 *
 * Points move only through the ledger, so every write here delegates to
 * `postTransaction`/`earnForInvoice`/`reverseForInvoice` rather than touching a
 * balance column. Coupon limits are counted from the database on every call —
 * the client's copy of a coupon is never the authority.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, badRequest, guardJson, requirePermission, notFound } from '@/lib/api/respond'
import { runOnce } from '@/lib/api/idempotency'
import { logAction } from '@/lib/admin/audit'
import { refusalMessage, type CouponRefusal } from '@/lib/crm/loyalty'
import {
  listPrograms, tiersOf, customerLoyalty, postTransaction, accountFor, activeProgram,
  redeemPoints, earnForInvoice, reverseForInvoice, expirePoints,
  listCoupons, validateCoupon, redeemCoupon, loyaltyOverview,
} from '@/lib/crm/loyaltyData'
import { pgQuery } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const programSchema = z.object({
  nameEn: z.string().trim().min(1).max(120),
  nameFa: z.string().trim().min(1).max(120),
  kind: z.enum(['points', 'tier', 'hybrid']).optional(),
  earnRate: z.number().min(0).max(1000).optional(),
  redeemRate: z.number().min(0).max(1_000_000).optional(),
  pointsExpireDays: z.number().int().min(0).max(3650).optional().nullable(),
  active: z.boolean().optional(),
})

const tierSchema = z.object({
  programId: z.number().int().positive(),
  nameEn: z.string().trim().min(1).max(80),
  nameFa: z.string().trim().min(1).max(80),
  threshold: z.number().min(0),
  discountPct: z.number().min(0).max(100).optional(),
})

const couponSchema = z.object({
  code: z.string().trim().min(2).max(40),
  kind: z.enum(['percent', 'amount']),
  value: z.number().min(0),
  minOrderTotal: z.number().min(0).optional(),
  maxRedemptions: z.number().int().min(1).optional().nullable(),
  maxPerCustomer: z.number().int().min(1).optional(),
  validFrom: z.string().trim().max(24).optional().nullable(),
  validUntil: z.string().trim().max(24).optional().nullable(),
  active: z.boolean().optional(),
})

const actionSchema = z.object({
  action: z.enum(['adjust', 'redeem', 'earnInvoice', 'reverseInvoice', 'expire', 'validateCoupon', 'redeemCoupon']),
  customerId: z.number().int().positive().optional(),
  invoiceId: z.number().int().positive().optional(),
  points: z.number().optional(),
  note: z.string().trim().max(300).optional(),
  code: z.string().trim().max(40).optional(),
  orderTotal: z.number().min(0).optional(),
  salesDocumentId: z.number().int().positive().optional(),
})

const isFa = (req: NextRequest) => (req.headers.get('accept-language') ?? '').startsWith('fa')

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission('crm.crm', 'read')
    if ('error' in auth) return auth.error
    const sp = req.nextUrl.searchParams

    if (sp.get('customerId')) {
      return NextResponse.json(await customerLoyalty(Number(sp.get('customerId'))))
    }
    if (sp.get('view') === 'coupons') {
      return NextResponse.json({ coupons: await listCoupons() })
    }
    const programs = await listPrograms()
    const active = programs.find(p => p.active) ?? programs[0]
    return NextResponse.json({
      programs,
      tiers: active ? await tiersOf(active.id) : [],
      coupons: await listCoupons(),
      overview: await loyaltyOverview(),
    })
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission('crm.crm', 'write', 'edit')
    if ('error' in auth) return auth.error
    const raw = await req.clone().json().catch(() => ({})) as { entity?: string }

    if (raw.entity === 'tier') {
      const parsed = await readJson(req, tierSchema)
      if ('error' in parsed) return parsed.error
      const d = parsed.data
      const id = await runOnce(auth.user.id, 'loyalty/tier', d, async () => (await pgQuery<{ id: number }>(
        `INSERT INTO loyalty_tiers (program_id, name_en, name_fa, threshold, discount_pct)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [d.programId, d.nameEn, d.nameFa, d.threshold, d.discountPct ?? 0]))[0].id)
      await logAction(auth.user, 'CREATE', 'loyalty_tiers', id, null, d)
      return NextResponse.json({ id }, { status: 201 })
    }

    if (raw.entity === 'coupon') {
      const parsed = await readJson(req, couponSchema)
      if ('error' in parsed) return parsed.error
      const d = parsed.data
      const id = await runOnce(auth.user.id, 'loyalty/coupon', d, async () => (await pgQuery<{ id: number }>(
        `INSERT INTO coupons (code, kind, value, min_order_total, max_redemptions, max_per_customer,
                              valid_from, valid_until, active, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [d.code.toUpperCase(), d.kind, d.value, d.minOrderTotal ?? 0, d.maxRedemptions ?? null,
          d.maxPerCustomer ?? 1, d.validFrom ?? null, d.validUntil ?? null,
          d.active === false ? 0 : 1, auth.user.id]))[0].id)
      await logAction(auth.user, 'CREATE', 'coupons', id, null, d)
      return NextResponse.json({ id }, { status: 201 })
    }

    const parsed = await readJson(req, programSchema)
    if ('error' in parsed) return parsed.error
    const d = parsed.data
    const id = await runOnce(auth.user.id, 'loyalty/program', d, async () => (await pgQuery<{ id: number }>(
      `INSERT INTO loyalty_programs (name_en, name_fa, kind, earn_rate, redeem_rate, points_expire_days, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [d.nameEn, d.nameFa, d.kind ?? 'points', d.earnRate ?? 0.001, d.redeemRate ?? 1,
        d.pointsExpireDays ?? null, d.active === false ? 0 : 1]))[0].id)
    await logAction(auth.user, 'CREATE', 'loyalty_programs', id, null, d)
    return NextResponse.json({ id }, { status: 201 })
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requirePermission('crm.crm', 'write', 'edit')
    if ('error' in auth) return auth.error
    const parsed = await readJson(req, actionSchema)
    if ('error' in parsed) return parsed.error
    const d = parsed.data
    const fa = isFa(req)

    switch (d.action) {
      case 'validateCoupon': {
        if (!d.code) return badRequest('code: Required')
        const r = await validateCoupon(d.code, d.customerId ?? null, d.orderTotal ?? 0)
        // A refusal explains itself in the reader's language (26.33).
        return NextResponse.json({
          ...r,
          message: r.ok ? null : refusalMessage((r.reason ?? 'not_found') as CouponRefusal, fa),
        })
      }
      case 'redeemCoupon': {
        if (!d.code) return badRequest('code: Required')
        const check = await validateCoupon(d.code, d.customerId ?? null, d.orderTotal ?? 0)
        if (!check.ok || !check.couponId) {
          return badRequest(refusalMessage((check.reason ?? 'not_found') as CouponRefusal, fa))
        }
        // 26.32: a double-click must consume the coupon once, not twice.
        await runOnce(auth.user.id, 'loyalty/redeemCoupon', d,
          () => redeemCoupon(check.couponId!, d.customerId ?? null, d.salesDocumentId ?? null, check.discount))
        await logAction(auth.user, 'REDEEM', 'coupons', check.couponId, null, { code: d.code, discount: check.discount })
        return NextResponse.json({ ok: true, discount: check.discount })
      }
      case 'redeem': {
        if (!d.customerId || !d.points) return badRequest('customerId and points are required')
        const r = await redeemPoints(d.customerId, d.points, { userId: auth.user.id })
        if (!r.ok) return badRequest(r.error ?? 'Redemption refused')
        await logAction(auth.user, 'REDEEM', 'loyalty_transactions', d.customerId, null, { points: d.points })
        return NextResponse.json(r)
      }
      case 'adjust': {
        // A manual correction is still a ledger movement — never a balance write.
        if (!d.customerId || d.points === undefined) return badRequest('customerId and points are required')
        const prog = await activeProgram()
        if (!prog) return badRequest('No active loyalty programme')
        const accountId = await accountFor(d.customerId, prog.id)
        const r = await postTransaction(accountId, 'adjust', d.points,
          { note: d.note ?? 'Manual adjustment', userId: auth.user.id })
        await logAction(auth.user, 'ADJUST', 'loyalty_transactions', accountId, null, { points: d.points, note: d.note })
        return NextResponse.json(r)
      }
      case 'earnInvoice': {
        if (!d.invoiceId) return badRequest('invoiceId: Required')
        const r = await earnForInvoice(d.invoiceId, auth.user.id)
        return NextResponse.json(r)
      }
      case 'reverseInvoice': {
        if (!d.invoiceId) return badRequest('invoiceId: Required')
        const r = await reverseForInvoice(d.invoiceId, auth.user.id)
        await logAction(auth.user, 'REVERSE', 'loyalty_transactions', d.invoiceId, null, r)
        return NextResponse.json(r)
      }
      case 'expire': {
        const r = await expirePoints(auth.user.id)
        await logAction(auth.user, 'EXPIRE', 'loyalty_transactions', 0, null, r)
        return NextResponse.json(r)
      }
    }
    return badRequest('Unknown action')
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission('crm.crm', 'write', 'delete')
    if ('error' in auth) return auth.error
    const { id, entity } = await guardJson(req).catch(() => ({ id: undefined, entity: undefined })) as
      { id?: number; entity?: string }
    if (!id || typeof id !== 'number') return badRequest('id required')

    const table = entity === 'coupon' ? 'coupons' : entity === 'tier' ? 'loyalty_tiers' : 'loyalty_programs'
    const existing = (await pgQuery(`SELECT id FROM ${table} WHERE id=$1`, [id]))[0]
    if (!existing) return notFound()
    await pgQuery(`DELETE FROM ${table} WHERE id=$1`, [id])
    await logAction(auth.user, 'DELETE', table, id)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return apiError(e)
  }
}
