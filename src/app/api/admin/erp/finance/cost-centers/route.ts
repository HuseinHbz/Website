import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, requirePermission } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { CC_KINDS } from '@/lib/erp/costCenter'
import { listCostCenters, createCostCenter, updateCostCenter, deleteCostCenter, costCenterOverview } from '@/lib/erp/costCenterData'
import { scopedCostCenterIds } from '@/lib/erp/financeRbac'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — cost centers (?view=overview → live revenue/cost/profit roll-up).
export async function GET(req: NextRequest) {
  const auth = await requirePermission('erp.finance', 'read')
  if ('error' in auth) return auth.error
  try {
    const scope = await scopedCostCenterIds(auth.user)
    if (req.nextUrl.searchParams.get('view') === 'overview') return NextResponse.json(await costCenterOverview(scope ?? undefined))
    const all = await listCostCenters()
    return NextResponse.json({ costCenters: scope ? all.filter(c => scope.includes(c.id)) : all })
  } catch (e) { return apiError(e, 'Failed to load cost centers') }
}

const kind = z.enum(CC_KINDS)
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), code: z.string().min(1).max(40), nameEn: z.string().min(1).max(120), nameFa: z.string().max(120).optional(), kind, parentId: z.number().int().positive().nullable().optional(), managerUserId: z.string().max(60).nullable().optional(), companyId: z.number().int().positive().nullable().optional() }),
  z.object({ action: z.literal('update'), id: z.number().int().positive(), nameEn: z.string().max(120).optional(), nameFa: z.string().max(120).optional(), kind: kind.optional(), parentId: z.number().int().positive().nullable().optional(), managerUserId: z.string().max(60).nullable().optional(), active: z.number().int().min(0).max(1).optional() }),
  z.object({ action: z.literal('delete'), id: z.number().int().positive() }),
])

export async function POST(req: NextRequest) {
  const auth = await requirePermission('erp.finance', 'write', 'edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    if (d.action === 'create') { const r = await createCostCenter(d); await logAction(auth.user, 'cost_center.create', 'erp_cost_centers', r.id, null, { code: d.code }); return NextResponse.json(r) }
    if (d.action === 'update') { await updateCostCenter(d.id, d); await logAction(auth.user, 'cost_center.update', 'erp_cost_centers', d.id); return NextResponse.json({ ok: true }) }
    if (!auth.user || !['super_admin', 'administrator'].includes(auth.user.role)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
    await deleteCostCenter(d.id); await logAction(auth.user, 'cost_center.delete', 'erp_cost_centers', d.id)
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e, 'Cost center operation failed') }
}
