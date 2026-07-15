/**
 * Inbound message handling (Phase 26.25s بند ۴.۵). An inbound WhatsApp/Telegram
 * message from an unknown sender auto-creates a CRM lead sourced to that channel.
 * If the sender already maps to a customer channel, no lead is created.
 */
import { pgQuery } from '@/lib/db'
import type { Channel } from '@/lib/messaging/provider'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

export async function autoLeadFromInbound(channel: Channel, address: string, text?: string): Promise<{ leadId?: number; customerId?: number }> {
  const known = (await pgQuery<{ customer_id: number }>(
    `SELECT customer_id FROM crm_customer_channels WHERE channel=$1 AND address=$2 LIMIT 1`, [channel, address]))[0]
  if (known) return { customerId: known.customer_id }

  const existingLead = (await pgQuery<{ id: number }>(
    `SELECT id FROM crm_leads WHERE source=$1 AND (phone=$2 OR email=$2) LIMIT 1`, [`inbound_${channel}`, address]))[0]
  if (existingLead) return { leadId: existingLead.id }

  const isPhone = channel === 'sms' || channel === 'whatsapp'
  const lead = (await pgQuery<{ id: number }>(
    `INSERT INTO crm_leads (name, ${isPhone ? 'phone' : 'email'}, source, status, score, value, notes, updated_at)
     VALUES ($1,$2,$3,'new',10,0,$4,${NOW}) RETURNING id`,
    [`Inbound ${channel} ${address}`, address, `inbound_${channel}`, (text ?? '').slice(0, 500)]))[0]
  return { leadId: lead.id }
}
