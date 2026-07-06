import { NextResponse } from 'next/server'
import { apiError, requireAdmin } from '@/lib/api/respond'
import { financeReports } from '@/lib/erp/ledgerData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — trial balance + income statement + balance sheet (from posted entries).
export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    return NextResponse.json(await financeReports())
  } catch (e) { return apiError(e, 'Failed to build reports') }
}
