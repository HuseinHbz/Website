import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, requirePermission } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { clientIp } from '@/lib/api/clientIp'
import { pgQuery } from '@/lib/db'
import { createCampaign, enqueueRecipients, dispatchCampaign, campaignAnalytics } from '@/lib/crm/campaignData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const CH = z.enum(['sms', 'email', 'whatsapp', 'telegram'])

export async function GET(req: NextRequest) {
  const auth = await requirePermission('crm.crm', 'read')
  if ('error' in auth) return auth.error
  try {
    const id = Number(req.nextUrl.searchParams.get('analytics'))
    if (id) return NextResponse.json(await campaignAnalytics(id))
    const rows = await pgQuery(
      `SELECT id, name, channels, status, budget::float AS budget, cost::float AS cost, created_at AS "createdAt" FROM crm_campaigns ORDER BY id DESC LIMIT 200`)
    return NextResponse.json({ campaigns: rows })
  } catch (e) { return apiError(e, 'Failed to load campaigns') }
}

const create = z.object({
  action: z.literal('create'), name: z.string().min(1).max(160),
  channels: z.array(CH).min(1), fallbackChain: z.array(CH).default([]),
  templates: z.record(z.string(), z.object({ text: z.string().max(2000).optional(), subject: z.string().max(200).optional(), html: z.string().max(20000).optional(), waTemplate: z.object({ name: z.string(), language: z.string() }).optional() })),
  budget: z.number().min(0).default(0), utmSource: z.string().max(80).optional(), utmMedium: z.string().max(80).optional(), utmCampaign: z.string().max(80).optional(),
})
const enqueue = z.object({ action: z.literal('enqueue'), id: z.number().int(), customerIds: z.array(z.number().int()).optional() })
const send = z.object({ action: z.literal('dispatch'), id: z.number().int(), limit: z.number().int().min(1).max(500).optional() })
const body = z.discriminatedUnion('action', [create, enqueue, send])

export async function POST(req: NextRequest) {
  const auth = await requirePermission('crm.crm', 'write', 'edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, body)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    if (d.action === 'create') {
      const id = await createCampaign(d, auth.user.id)
      await logAction(auth.user, 'crm.campaign.create', 'crm_campaigns', String(id), null, { channels: d.channels }, clientIp(req))
      return NextResponse.json({ id })
    }
    if (d.action === 'enqueue') {
      const r = await enqueueRecipients(d.id, d.customerIds)
      await logAction(auth.user, 'crm.campaign.enqueue', 'crm_campaigns', String(d.id), null, r, clientIp(req))
      return NextResponse.json(r)
    }
    const r = await dispatchCampaign(d.id, d.limit)
    await logAction(auth.user, 'crm.campaign.dispatch', 'crm_campaigns', String(d.id), null, r, clientIp(req))
    return NextResponse.json(r)
  } catch (e) { return apiError(e, 'Campaign action failed') }
}
