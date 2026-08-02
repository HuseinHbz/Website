import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, badRequest, requirePermission, requireOp } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { clientIp } from '@/lib/api/clientIp'
import { enqueueInvoice, submitQueued, moadianQueue, moadianStats, loadMoadianConfig, isMoadianLive } from '@/lib/erp/moadian/moadianData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — مودیان queue + stats + live/sandbox mode.
export async function GET(req: NextRequest) {
  const auth = await requirePermission('erp.moadian', 'read')
  if ('error' in auth) return auth.error
  try {
    const status = req.nextUrl.searchParams.get('status') ?? undefined
    const [queue, stats, cfg] = await Promise.all([moadianQueue(status), moadianStats(), loadMoadianConfig()])
    return NextResponse.json({ queue, stats, mode: isMoadianLive(cfg) ? 'live' : 'sandbox' })
  } catch (e) { return apiError(e, 'Failed to load مودیان queue') }
}

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('enqueue'), documentId: z.number().int().positive(), pattern: z.enum(['1', '2']).default('1') }),
  z.object({ action: z.literal('submit'), queueId: z.number().int().positive() }),
  z.object({ action: z.literal('retryFailed') }),
])

// POST — enqueue a sales invoice, submit a queued item, or retry all failed.
export async function POST(req: NextRequest) {
  const auth = await requirePermission('erp.moadian', 'write', 'edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    if (d.action === 'enqueue') {
      const res = await enqueueInvoice(d.documentId, d.pattern, auth.user.id)
      await logAction(auth.user, 'moadian.enqueue', 'moadian_queue', res.queueId, null, { documentId: d.documentId, taxId: res.taxId }, clientIp(req))
      return NextResponse.json(res)
    }
    if (d.action === 'submit') {
      { const deny = await requireOp(auth.user, 'erp.moadian:submit', 'edit'); if (deny) return deny }
      if (!['administrator', 'super_admin'].includes(auth.user.role)) return badRequest('Only administrators can submit to مودیان')
      const res = await submitQueued(d.queueId)
      await logAction(auth.user, 'moadian.submit', 'moadian_queue', d.queueId, null, res, clientIp(req))
      return NextResponse.json(res)
    }
    // retryFailed
    if (!['administrator', 'super_admin'].includes(auth.user.role)) return badRequest('Only administrators can submit to مودیان')
    const failed = await moadianQueue('failed') as { id: number }[]
    let retried = 0
    for (const q of failed) { try { await submitQueued(q.id); retried++ } catch { /* keep going */ } }
    await logAction(auth.user, 'moadian.retryFailed', 'moadian_queue', '', null, { retried }, clientIp(req))
    return NextResponse.json({ retried })
  } catch (e) { return apiError(e, 'مودیان operation failed') }
}
