import { NextResponse } from 'next/server'
import { apiError, requireAdmin } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { previewRevaluation, bookRevaluation, revaluationHistory } from '@/lib/erp/revaluationData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Preview FX positions, exposure and the delta a booking run would post. */
export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    return NextResponse.json({ ...(await previewRevaluation()), history: await revaluationHistory() })
  } catch (e) { return apiError(e, 'Failed to preview revaluation') }
}

/** Book the revaluation delta as a posted journal entry — administrator only. */
export async function POST() {
  const auth = await requireAdmin('edit')
  if ('error' in auth) return auth.error
  if (!['super_admin', 'administrator'].includes(auth.user.role)) {
    return NextResponse.json({ error: 'Booking a revaluation requires an administrator' }, { status: 403 })
  }
  try {
    const r = await bookRevaluation(auth.user.id)
    if (!r.booked) return NextResponse.json({ error: 'Nothing to book — positions are already at current rates' }, { status: 400 })
    await logAction(auth.user, 'erp.currency.revaluation', 'gl_journal_entries', String(r.entryId), { entryNo: r.entryNo, delta: r.delta })
    return NextResponse.json(r)
  } catch (e) { return apiError(e, 'Failed to book revaluation') }
}
