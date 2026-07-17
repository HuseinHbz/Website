import { NextResponse } from 'next/server'
import { apiError, requireAdmin } from '@/lib/api/respond'
import { inventoryOverview } from '@/lib/erp/inventoryData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — inventory dashboard: KPIs, low-stock, recent moves, per-warehouse, top value.
export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    return NextResponse.json(await inventoryOverview())
  } catch (e) { return apiError(e, 'Failed to load inventory overview') }
}
