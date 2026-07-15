/**
 * Portal tickets (Phase 26.25b بند ۱). A customer's OWN tickets only — the
 * customerId is bound from the server session, never the client. Create + list.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePortal } from '@/lib/portal/guard'
import { readJson } from '@/lib/api/respond'
import { limiters } from '@/lib/rateLimit'
import { clientIp } from '@/lib/api/clientIp'
import { listCustomerTickets, createTicket } from '@/lib/crm/ticketData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = await requirePortal(req)
  if ('error' in auth) return auth.error
  return NextResponse.json({ tickets: await listCustomerTickets(auth.identity.customerId) })
}

const schema = z.object({
  subject: z.string().min(3).max(300),
  body: z.string().min(1).max(5000),
  category: z.string().max(60).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  attachmentUrl: z.string().max(500).optional(),
})

export async function POST(req: NextRequest) {
  const auth = await requirePortal(req)
  if ('error' in auth) return auth.error
  // Reuse the public-API limiter to bound portal ticket spam.
  if (!limiters.api(clientIp(req) ?? 'ip').allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  const t = await createTicket({
    customerId: auth.identity.customerId, subject: d.subject, body: d.body,
    category: d.category, priority: d.priority, attachmentUrl: d.attachmentUrl,
    authorKind: 'customer', source: 'portal',
  })
  return NextResponse.json(t)
}
