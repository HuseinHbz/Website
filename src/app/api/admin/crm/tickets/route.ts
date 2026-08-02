/**
 * Admin support-ticket queue (Phase 26.25b بند ۱). List/detail + reply (with
 * internal notes) + assign + status/priority + SLA scan. RBAC + zod + audit.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, requirePermission } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { clientIp } from '@/lib/api/clientIp'
import {
  listTickets, getTicket, addTicketMessage, setTicketStatus, assignTicket, setTicketPriority, scanTicketSla,
} from '@/lib/crm/ticketData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = await requirePermission('crm.crm.tickets', 'read')
  if ('error' in auth) return auth.error
  try {
    const sp = req.nextUrl.searchParams
    const id = Number(sp.get('id'))
    if (id) {
      const t = await getTicket(id, { includeInternal: true })   // admin sees internal notes
      if (!t) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json(t)
    }
    return NextResponse.json({
      tickets: await listTickets({
        status: sp.get('status') || undefined, priority: sp.get('priority') || undefined,
        ownerId: sp.get('owner') || undefined, customerId: Number(sp.get('customer')) || undefined,
      }),
    })
  } catch (e) { return apiError(e, 'Failed to load tickets') }
}

const reply = z.object({ action: z.literal('reply'), id: z.number().int(), body: z.string().min(1).max(5000), internal: z.boolean().optional(), attachmentUrl: z.string().max(500).optional() })
const status = z.object({ action: z.literal('status'), id: z.number().int(), status: z.enum(['new', 'open', 'pending', 'resolved', 'closed']) })
const assign = z.object({ action: z.literal('assign'), id: z.number().int(), ownerId: z.string().nullable() })
const priority = z.object({ action: z.literal('priority'), id: z.number().int(), priority: z.enum(['low', 'normal', 'high', 'urgent']) })
const scan = z.object({ action: z.literal('scan') })
const body = z.discriminatedUnion('action', [reply, status, assign, priority, scan])

export async function POST(req: NextRequest) {
  const auth = await requirePermission('crm.crm.tickets', 'write', 'edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, body)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  const ip = clientIp(req)
  try {
    if (d.action === 'reply') {
      const r = await addTicketMessage(d.id, { authorKind: 'agent', authorId: auth.user.id, body: d.body, internal: d.internal, attachmentUrl: d.attachmentUrl })
      await logAction(auth.user, d.internal ? 'TICKET_NOTE' : 'TICKET_REPLY', 'crm_tickets', d.id, null, null, ip)
      return NextResponse.json(r)
    }
    if (d.action === 'status') {
      const r = await setTicketStatus(d.id, d.status, auth.user.id)
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
      await logAction(auth.user, 'TICKET_STATUS', 'crm_tickets', d.id, null, { status: d.status }, ip)
      return NextResponse.json(r)
    }
    if (d.action === 'assign') {
      const r = await assignTicket(d.id, d.ownerId)
      await logAction(auth.user, 'TICKET_ASSIGN', 'crm_tickets', d.id, null, { ownerId: d.ownerId }, ip)
      return NextResponse.json(r)
    }
    if (d.action === 'priority') {
      const r = await setTicketPriority(d.id, d.priority)
      await logAction(auth.user, 'TICKET_PRIORITY', 'crm_tickets', d.id, null, { priority: d.priority }, ip)
      return NextResponse.json(r)
    }
    // scan
    const r = await scanTicketSla()
    return NextResponse.json(r)
  } catch (e) { return apiError(e, 'Failed to update ticket') }
}
