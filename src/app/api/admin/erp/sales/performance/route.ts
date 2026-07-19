import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { performanceData, setTarget } from '@/lib/erp/salesData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Sales performance: monthly invoiced vs target, commission, trend forecast. */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    const months = Math.min(24, Math.max(3, Number(req.nextUrl.searchParams.get('months')) || 12))
    return NextResponse.json(await performanceData(months))
  } catch (e) { return apiError(e, 'Failed to load sales performance') }
}

const schema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, 'period must be YYYY-MM'),
  target: z.number().min(0),
  commissionPct: z.number().min(0).max(100).default(0),
})

/** Set/replace the monthly sales target + commission rate. */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin('edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    await setTarget(d.period, d.target, d.commissionPct, auth.user.id)
    await logAction(auth.user, 'erp.sales.target.set', 'sales_targets', d.period, { target: d.target, commissionPct: d.commissionPct })
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e, 'Failed to save sales target') }
}
