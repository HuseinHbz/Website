import { NextRequest, NextResponse } from 'next/server'
import { pgQuery } from '@/lib/db'
import { limiters } from '@/lib/rateLimit'
import { clientIp } from '@/lib/api/clientIp'
import { verifyTelegramSecret } from '@/lib/messaging/webhookVerify'
import { linkTelegramChat } from '@/lib/crm/channelData'
import { autoLeadFromInbound } from '@/lib/crm/inboundData'
import { dispatch } from '@/lib/messaging/manager'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function setting(key: string): Promise<string> {
  return (await pgQuery<{ value: string }>(`SELECT value FROM erp_settings WHERE key=$1`, [key]))[0]?.value
    || process.env[key.toUpperCase()] || ''
}

// POST — Telegram update. The `X-Telegram-Bot-Api-Secret-Token` header is
// verified before any processing. `/start <code>` links a chat_id to a customer;
// other inbound messages from unknown senders auto-create a lead.
export async function POST(req: NextRequest) {
  if (!limiters.api(clientIp(req) ?? "ip").allowed) return NextResponse.json({ error: 'rate limited' }, { status: 429 })
  const secret = await setting('telegram_webhook_secret')
  if (!verifyTelegramSecret(req.headers.get('x-telegram-bot-api-secret-token'), secret))
    return NextResponse.json({ error: 'invalid secret' }, { status: 401 })
  try {
    const body = await req.json()
    const msg = body?.message
    const chatId = msg?.chat?.id != null ? String(msg.chat.id) : ''
    const text = String(msg?.text ?? '')
    if (!chatId) return NextResponse.json({ ok: true })

    if (text.startsWith('/start')) {
      // /start <connectCode> → link this chat to the customer that owns the code.
      const code = text.split(/\s+/)[1] ?? ''
      if (code) {
        const cust = (await pgQuery<{ id: number }>(
          `SELECT id FROM sales_customers WHERE code=$1 OR CAST(id AS TEXT)=$1 LIMIT 1`, [code]))[0]
        if (cust) {
          await linkTelegramChat(cust.id, chatId)
          const botToken = await setting('telegram_bot_token')
          if (botToken) await dispatch('telegram', { to: chatId, text: 'حساب شما با موفقیت متصل شد. ✅' })
          return NextResponse.json({ ok: true, linked: true })
        }
      }
    } else if (text === '/stop') {
      await pgQuery(`UPDATE crm_customer_channels SET opt_in=0, opt_out_at=to_char(now(),'YYYY-MM-DD HH24:MI:SS') WHERE channel='telegram' AND address=$1`, [chatId])
      await pgQuery(`INSERT INTO crm_optouts (channel, target, reason, created_at) VALUES ('telegram',$1,'user /stop',to_char(now(),'YYYY-MM-DD HH24:MI:SS')) ON CONFLICT (channel, target) DO NOTHING`, [chatId])
      return NextResponse.json({ ok: true, optedOut: true })
    } else {
      await autoLeadFromInbound('telegram', chatId, text)
    }
    return NextResponse.json({ ok: true })
  } catch { return NextResponse.json({ ok: true }) }
}
