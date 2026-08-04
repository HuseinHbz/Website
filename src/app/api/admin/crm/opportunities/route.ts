/**
 * Phase 27 بند۱ — opportunity API.
 *
 * Follows the rules the earlier phases paid for: `requirePermission` with a
 * registry key (26.27), row scope enforced in the WHERE with an out-of-scope
 * record answering 404 rather than 403 (26.28), `runOnce` on create so a
 * double-click cannot produce two deals (26.32), a partial-friendly update
 * schema (26.30 BUG-206), and errors that name the field (26.29).
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, badRequest, guardJson, requirePermission, notFound } from '@/lib/api/respond'
import { runOnce } from '@/lib/api/idempotency'
import { logAction } from '@/lib/admin/audit'
import { OPPORTUNITY_STAGES, requiresReason, STAGE_DEFAULT_PROBABILITY } from '@/lib/crm/opportunities'
import {
  overview, createOpportunity, updateOpportunity, deleteOpportunity,
  convertToSalesDocument, itemsOf, setItems, lossReasons, customerOpportunities,
} from '@/lib/crm/opportunityData'
import { pgQuery } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  amount: z.number().min(0).max(1_000_000_000_000).optional(),
  currency: z.string().trim().max(8).optional(),
  probability: z.number().int().min(0).max(100).optional(),
  stage: z.enum(OPPORTUNITY_STAGES).optional(),
  expectedCloseDate: z.string().trim().max(24).optional().nullable(),
  customerId: z.number().int().positive().optional().nullable(),
  leadId: z.number().int().positive().optional().nullable(),
  ownerId: z.string().max(64).optional().nullable(),
  outcomeReason: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
})

// 26.30 BUG-206: an update must not demand fields it is not changing — the
// kanban moves a deal by sending only `{id, stage}`.
const updateSchema = createSchema.partial().extend({ id: z.number().int().positive() })

const itemsSchema = z.object({
  id: z.number().int().positive(),
  items: z.array(z.object({
    description: z.string().trim().min(1).max(300),
    qty: z.number().min(0),
    unitPrice: z.number().min(0),
    discountPct: z.number().min(0).max(100).optional(),
    taxPct: z.number().min(0).max(100).optional(),
    productId: z.number().int().positive().optional().nullable(),
  })).max(200),
})

const convertSchema = z.object({
  id: z.number().int().positive(),
  docType: z.enum(['quote', 'invoice']),
})

/** Row scope for opportunities, applied in the WHERE (never as a UI filter). */
async function scopeFor(userId: string) {
  const { rowScopeSql } = await import('@/lib/rbac/data')
  return await rowScopeSql(userId, 'crm.crm', 'o.owner_id', 1)
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission('crm.crm', 'read')
    if ('error' in auth) return auth.error
    const sp = req.nextUrl.searchParams
    const sc = await scopeFor(auth.user.id)

    if (sp.get('view') === 'lossReasons') {
      return NextResponse.json({ reasons: await lossReasons() })
    }
    if (sp.get('customerId')) {
      return NextResponse.json(await customerOpportunities(Number(sp.get('customerId'))))
    }
    if (sp.get('items')) {
      return NextResponse.json({ items: await itemsOf(Number(sp.get('items'))) })
    }
    return NextResponse.json(await overview(sc.clause, sc.params))
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission('crm.crm', 'write', 'edit')
    if ('error' in auth) return auth.error
    const parsed = await readJson(req, createSchema)
    if ('error' in parsed) return parsed.error
    const d = parsed.data
    // A deal closed as lost at creation still owes a reason.
    if (d.stage && requiresReason(d.stage) && !d.outcomeReason) {
      return badRequest('outcomeReason: required when the stage is lost')
    }
    const body = {
      ...d,
      probability: d.probability ?? STAGE_DEFAULT_PROBABILITY[d.stage ?? 'identified'],
    }
    // 26.32: the concurrent twin awaits the same promise, so a double-click
    // cannot create two opportunities for the same deal.
    const id = await runOnce(auth.user.id, 'crm/opportunities', body,
      () => createOpportunity(body, auth.user.id))
    await logAction(auth.user, 'CREATE', 'crm_opportunities', id, null, body)
    return NextResponse.json({ id }, { status: 201 })
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requirePermission('crm.crm', 'write', 'edit')
    if ('error' in auth) return auth.error

    const body = await req.clone().json().catch(() => ({})) as { action?: string }

    // ── convert to a sales document ──────────────────────────────────────────
    if (body.action === 'convert') {
      const parsed = await readJson(req, convertSchema)
      if ('error' in parsed) return parsed.error
      const existing = (await pgQuery<{ owner_id: string | null }>(
        `SELECT owner_id FROM crm_opportunities WHERE id=$1`, [parsed.data.id]))[0]
      if (!existing) return notFound()
      const { rowInScope } = await import('@/lib/rbac/data')
      if (!(await rowInScope(auth.user.id, 'crm.crm', existing.owner_id))) return notFound()

      const r = await convertToSalesDocument(parsed.data.id, parsed.data.docType, auth.user.id)
      if (!r.ok) return badRequest(r.error ?? 'Conversion failed')
      await logAction(auth.user, 'CONVERT', 'crm_opportunities', parsed.data.id, null,
        { docType: parsed.data.docType, documentId: r.documentId, alreadyConverted: r.alreadyConverted })
      return NextResponse.json(r)
    }

    // ── set proposed items ───────────────────────────────────────────────────
    if (body.action === 'items') {
      const parsed = await readJson(req, itemsSchema)
      if ('error' in parsed) return parsed.error
      await setItems(parsed.data.id, parsed.data.items)
      await logAction(auth.user, 'UPDATE', 'crm_opportunity_items', parsed.data.id, null, { count: parsed.data.items.length })
      return NextResponse.json({ ok: true })
    }

    // ── ordinary (possibly partial) update ───────────────────────────────────
    const parsed = await readJson(req, updateSchema)
    if ('error' in parsed) return parsed.error
    const d = parsed.data
    const existing = (await pgQuery<{ owner_id: string | null; stage: string; outcome_reason: string | null }>(
      `SELECT owner_id, stage, outcome_reason FROM crm_opportunities WHERE id=$1`, [d.id]))[0]
    if (!existing) return notFound()
    const { rowInScope } = await import('@/lib/rbac/data')
    if (!(await rowInScope(auth.user.id, 'crm.crm', existing.owner_id))) return notFound()

    // A loss without a reason leaves the loss analysis with nothing to read.
    if (d.stage && requiresReason(d.stage) && !(d.outcomeReason ?? existing.outcome_reason)) {
      return badRequest('outcomeReason: required when the stage is lost')
    }
    await updateOpportunity(d.id, d)
    await logAction(auth.user, 'UPDATE', 'crm_opportunities', d.id, existing, d)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission('crm.crm', 'write', 'delete')
    if ('error' in auth) return auth.error
    const { id } = await guardJson(req).catch(() => ({ id: undefined })) as { id?: number }
    if (!id || typeof id !== 'number') return badRequest('id required')
    const existing = (await pgQuery<{ owner_id: string | null }>(
      `SELECT owner_id FROM crm_opportunities WHERE id=$1`, [id]))[0]
    if (!existing) return notFound()
    const { rowInScope } = await import('@/lib/rbac/data')
    if (!(await rowInScope(auth.user.id, 'crm.crm', existing.owner_id))) return notFound()
    await deleteOpportunity(id)
    await logAction(auth.user, 'DELETE', 'crm_opportunities', id)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return apiError(e)
  }
}
