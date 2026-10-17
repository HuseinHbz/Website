import { NextRequest, NextResponse } from 'next/server'
import { apiError, requirePermission, requireOp } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { postDepreciationRun, depreciationReconciliation } from '@/lib/erp/assetData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * ERPFIX-5 (BUG-ERP-09). GET previews a period (dry-run, no write) and also
 * returns the book-value reconciliation; POST books it as a posted journal
 * entry — a sensitive accounting op, separate from generic finance write.
 */
export async function GET(req: NextRequest) {
  const auth = await requirePermission('erp.finance', 'read')
  if ('error' in auth) return auth.error
  try {
    const periodKey = req.nextUrl.searchParams.get('period') ?? new Date().toISOString().slice(0, 7)
    const preview = await postDepreciationRun(periodKey, undefined, true)
    const reconciliation = await depreciationReconciliation()
    return NextResponse.json({ preview, reconciliation })
  } catch (e) { return apiError(e, 'Failed to preview depreciation') }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission('erp.finance', 'write', 'edit')
  if ('error' in auth) return auth.error
  { const deny = await requireOp(auth.user, 'erp.finance:post_depreciation', 'edit'); if (deny) return deny }
  try {
    const body = await req.json().catch(() => ({}))
    const periodKey = typeof body?.period === 'string' ? body.period : new Date().toISOString().slice(0, 7)
    const r = await postDepreciationRun(periodKey, auth.user.id, false)
    await logAction(auth.user, 'erp.finance.postDepreciation', 'gl_journal_entries', String(r.entryId ?? ''), { periodKey, total: r.total, posted: r.posted.length, skipped: r.skipped.length })
    return NextResponse.json(r)
  } catch (e) { return apiError(e, 'Failed to post depreciation') }
}
