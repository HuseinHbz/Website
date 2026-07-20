import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, badRequest, requirePermission } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { clientIp } from '@/lib/api/clientIp'
import { masterDataOverview, detectDuplicates, relationIntegrity, mergeCustomers } from '@/lib/masterdata/masterDataData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — Master-Data Governance (Phase 26.16): per-domain completeness score,
// duplicate record groups, and cross-module relation integrity. Read-only.
export async function GET(req: NextRequest) {
  const auth = await requirePermission('erp.master-data', 'read')
  if ('error' in auth) return auth.error
  try {
    const view = req.nextUrl.searchParams.get('view') ?? 'overview'
    if (view === 'duplicates') return NextResponse.json(await detectDuplicates())
    if (view === 'integrity') return NextResponse.json({ integrity: await relationIntegrity() })
    return NextResponse.json({ overview: await masterDataOverview() })
  } catch (e) { return apiError(e, 'Failed to load master-data governance') }
}

const mergeSchema = z.object({
  action: z.literal('merge'),
  primaryId: z.number().int().positive(),
  duplicateId: z.number().int().positive(),
})

// POST — merge a duplicate customer into a primary (administrator only, audited).
export async function POST(req: NextRequest) {
  const auth = await requirePermission('erp.master-data', 'write', 'edit')
  if ('error' in auth) return auth.error
  if (!['administrator', 'super_admin'].includes(auth.user.role)) return badRequest('Only administrators can merge master-data records')
  const parsed = await readJson(req, mergeSchema)
  if ('error' in parsed) return parsed.error
  const { primaryId, duplicateId } = parsed.data
  try {
    const res = await mergeCustomers(primaryId, duplicateId)
    await logAction(auth.user, 'masterdata.customer.merge', 'sales_customer', primaryId, { duplicateId }, res, clientIp(req))
    return NextResponse.json({ ok: true, ...res })
  } catch (e) { return apiError(e, 'Merge failed') }
}
