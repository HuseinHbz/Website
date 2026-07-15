import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { readJson } from '@/lib/api/respond'
import { requirePortal } from '@/lib/portal/guard'
import { setChannelOptIn, portalChannels } from '@/lib/portal/portalData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const schema = z.object({ channelId: z.number().int().positive(), optIn: z.boolean() })

export async function PUT(req: NextRequest) {
  const auth = await requirePortal(req)
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const ok = await setChannelOptIn(auth.identity.customerId, parsed.data.channelId, parsed.data.optIn)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true, channels: await portalChannels(auth.identity.customerId) })
}
