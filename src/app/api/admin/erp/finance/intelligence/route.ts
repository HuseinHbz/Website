import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, requirePermission } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { cfoDashboard, departmentDashboard, assembleKpis, saveKpiSnapshot, listKpiSnapshots } from '@/lib/erp/financialIntelligenceData'
import { canSeeConsolidated, scopedCostCenterIds } from '@/lib/erp/financeRbac'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET ?view=cfo|department|kpis|snapshots — CFO dashboard requires consolidated
// access; department dashboard is scoped to the user's cost centers.
export async function GET(req: NextRequest) {
  const auth = await requirePermission('erp.finance', 'read')
  if ('error' in auth) return auth.error
  const view = req.nextUrl.searchParams.get('view') ?? 'kpis'
  try {
    if (view === 'cfo') {
      if (!(await canSeeConsolidated(auth.user))) return NextResponse.json({ error: 'Consolidated financials require CFO/CEO/Finance access' }, { status: 403 })
      return NextResponse.json(await cfoDashboard())
    }
    if (view === 'department') return NextResponse.json(await departmentDashboard(await scopedCostCenterIds(auth.user)))
    if (view === 'snapshots') return NextResponse.json({ snapshots: await listKpiSnapshots() })
    return NextResponse.json(await assembleKpis())
  } catch (e) { return apiError(e, 'Failed to load financial intelligence') }
}

const schema = z.object({ action: z.literal('snapshot'), currency: z.string().max(8).optional() })

export async function POST(req: NextRequest) {
  const auth = await requirePermission('erp.finance', 'write', 'edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  try {
    const r = await saveKpiSnapshot(auth.user.id, parsed.data.currency)
    await logAction(auth.user, 'finance.kpi.snapshot', 'erp_kpi_snapshots', r.id)
    return NextResponse.json(r)
  } catch (e) { return apiError(e, 'Snapshot failed') }
}
