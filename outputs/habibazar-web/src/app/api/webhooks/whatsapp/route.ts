import { NextRequest, NextResponse } from 'next/server'
import { pgQuery } from '@/lib/db'
import { limiters } from '@/lib/rateLimit'
import { clientIp } from '@/lib/api/clientIp'
import { verifyWhatsappSignature, whatsappChallenge } from '@/lib/messaging/webhookVerify'
import { updateDeliveryStatus } from '@/lib/crm/campaignData'
import { recordInbound } from '@/lib/crm/channelData'
import { autoLeadFromInbound } from '@/lib/crm/inboundData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function setting(key: string): Promise<string> {
  return (await pgQuery<{ value: string }>(`SELECT value FROM erp_settings WHERE key=$1`, [key]))[0]?.value
    || process.env[key.toUpperCase()] || ''
}

// GET — Meta verification challenge (echoes hub.challenge iff the token matches).
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const verifyToken = await setting('whatsapp_verify_token')
  const challenge = whatsappChallenge(sp.get('hub.mode'), sp.get('hub.verify_token'), sp.get('hub.challenge'), verifyToken)
  if (challenge === null) return new NextResponse('forbidden', { status: 403 })
  return new NextResponse(challenge, { status: 200 })
}

// POST — delivery/read receipts + inbound messages. Signature is verified over
// the RAW body BEFORE any processing; the body is never trusted until then.
export async function POST(req: NextRequest) {
  if (!limiters.api(clientIp(req) ?? "ip").allowed) return NextResponse.json({ error: 'rate limited' }, { status: 429 })
  const raw = await req.text()
  const appSecret = await setting('whatsapp_app_secret')
  if (!verifyWhatsappSignature(raw, req.headers.get('x-hub-signature-256'), appSecret))
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  try {
    const body = JSON.parse(raw)
    for (const entry of body?.entry ?? []) {
      for (const ch of entry?.changes ?? []) {
        const v = ch?.value ?? {}
        for (const st of v.statuses ?? []) {
          if (st.id && (st.status === 'delivered' || st.status === 'read')) await updateDeliveryStatus(String(st.id), st.status)
        }
        for (const msg of v.messages ?? []) {
          const from = String(msg.from ?? '')
          if (!from) continue
          await recordInbound('whatsapp', from)
          await autoLeadFromInbound('whatsapp', from, msg.text?.body)
        }
      }
    }
    return NextResponse.json({ ok: true })
  } catch { return NextResponse.json({ ok: true }) }
}
