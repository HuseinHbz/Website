import { NextResponse } from 'next/server'
import { apiError, requirePermission } from '@/lib/api/respond'
import { inventoryOverview } from '@/lib/erp/inventoryData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — inventory dashboard: KPIs, low-stock, recent moves, per-warehouse, top value.
export async function GET() {
  const auth = await requirePermission('erp.inventory', 'read')
  if ('error' in auth) return auth.error
  try {
    const data = await inventoryOverview()
    // 26.28 بند ۳ — sensitive-field cover: without erp.inventory:cost_view the
    // cost/valuation figures are REMOVED from the payload (products route does
    // the same; hiding in CSS is forbidden).
    const { sensitiveFieldVisible, stripFields } = await import('@/lib/rbac/data')
    if (!(await sensitiveFieldVisible(auth.user.id, 'erp.inventory:cost_view'))) {
      const kpis = { ...(data.kpis as unknown as Record<string, unknown>) }
      delete kpis.totalValue
      return NextResponse.json({
        ...data,
        kpis,
        lowStock: stripFields(data.lowStock as unknown as Record<string, unknown>[], ['value', 'avgCost']),
        recentMoves: stripFields(data.recentMoves as unknown as Record<string, unknown>[], ['unitCost']),
        topValue: [],   // the whole widget IS the sensitive figure
        costMasked: true,
      })
    }
    return NextResponse.json(data)
  } catch (e) { return apiError(e, 'Failed to load inventory overview') }
}
