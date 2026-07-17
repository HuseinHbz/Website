import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { analyzeApprovalProcess, analyzeDocProcess, snapshotProcess } from '@/lib/bi/processData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    const p = req.nextUrl.searchParams.get('process') ?? 'approval'
    if (p === 'sales' || p === 'purchase') return NextResponse.json(await analyzeDocProcess(p))
    return NextResponse.json(await analyzeApprovalProcess())
  } catch (e) { return apiError(e, 'Process analysis failed') }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin('edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, z.object({ action: z.literal('snapshot'), period: z.string().min(4).max(7) }))
  if ('error' in parsed) return parsed.error
  try { const r = await snapshotProcess(parsed.data.period); await logAction(auth.user, 'process.snapshot', 'process_metrics', '', null, r); return NextResponse.json(r) }
  catch (e) { return apiError(e, 'Snapshot failed') }
}
