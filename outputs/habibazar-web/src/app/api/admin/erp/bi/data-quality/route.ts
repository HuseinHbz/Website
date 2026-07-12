import { NextResponse } from 'next/server'
import { requireAdmin, apiError } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { runDataQuality } from '@/lib/bi/dataQualityData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try { const r = await runDataQuality(); await logAction(auth.user, 'data_quality.run', 'data_quality_checks', '', null, { score: r.score }); return NextResponse.json(r) }
  catch (e) { return apiError(e, 'Data quality run failed') }
}
