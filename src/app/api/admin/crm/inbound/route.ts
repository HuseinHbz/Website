/**
 * Inbound-quarantine review queue (Phase 26.25b بند ۰.۶). Anonymous inbound
 * webhook messages land here as pending_review; an operator confirms (→ CRM lead)
 * or rejects. Nothing here enters the funnel/CAC until confirmed.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { clientIp } from '@/lib/api/clientIp'
import { listQuarantine, confirmInbound, rejectInbound } from '@/lib/crm/inboundData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    const status = req.nextUrl.searchParams.get('status') || 'pending_review'
    return NextResponse.json({ messages: await listQuarantine(status) })
  } catch (e) { return apiError(e, 'Failed to load inbound queue') }
}

const body = z.object({ action: z.enum(['confirm', 'reject']), id: z.number().int().positive() })

export async function POST(req: NextRequest) {
  const auth = await requireAdmin('edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, body)
  if ('error' in parsed) return parsed.error
  const { action, id } = parsed.data
  try {
    const ip = clientIp(req)
    if (action === 'confirm') {
      const res = await confirmInbound(id)
      await logAction(auth.user, 'INBOUND_CONFIRM', 'crm_inbound_messages', id, null, { leadId: res.leadId }, ip)
      return NextResponse.json(res)
    }
    await rejectInbound(id)
    await logAction(auth.user, 'INBOUND_REJECT', 'crm_inbound_messages', id, null, null, ip)
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e, 'Failed to update inbound message') }
}
