import { NextResponse } from 'next/server'
import { apiError, requireAdmin } from '@/lib/api/respond'
import { financeOverview } from '@/lib/erp/ledgerData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — finance dashboard: KPIs (assets/liabilities/equity/revenue/expenses/
// net income/cash), income + balance summary, recent entries, status counts.
export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    return NextResponse.json(await financeOverview())
  } catch (e) { return apiError(e, 'Failed to load finance overview') }
}
