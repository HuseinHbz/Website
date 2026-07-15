/**
 * Portal ticket detail + reply (Phase 26.25b بند ۱). IDOR-safe: getTicket/
 * addTicketMessage are called with the SESSION customerId, so another customer's
 * ticket returns 404 and internal notes are NEVER included (includeInternal:false).
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePortal } from '@/lib/portal/guard'
import { readJson } from '@/lib/api/respond'
import { getTicket, addTicketMessage } from '@/lib/crm/ticketData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePortal(req)
  if ('error' in auth) return auth.error
  const id = Number((await params).id)
  const t = await getTicket(id, { includeInternal: false, customerId: auth.identity.customerId })
  if (!t) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(t)
}

const schema = z.object({ body: z.string().min(1).max(5000), attachmentUrl: z.string().max(500).optional() })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePortal(req)
  if ('error' in auth) return auth.error
  const id = Number((await params).id)
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  // internal is impossible for a customer author (enforced in the data layer too).
  const r = await addTicketMessage(id, { authorKind: 'customer', body: parsed.data.body, attachmentUrl: parsed.data.attachmentUrl, customerId: auth.identity.customerId })
  if (!r.ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(r)
}
