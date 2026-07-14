import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson, badRequest } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import { clientIp } from '@/lib/api/clientIp'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

const schema = z.object({ leadId: z.number().int().positive() })

// POST — بند ۵.۳: convert a qualified/proposal/won lead into a sales customer.
// Duplicate detection by email/phone links to the existing customer instead of
// creating a twin; the lead records converted_customer_id (idempotent).
export async function POST(req: NextRequest) {
  const auth = await requireAdmin('edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  try {
    const lead = (await pgQuery<{ id: number; name: string; email: string | null; phone: string | null; company: string | null; status: string; converted_customer_id: number | null }>(
      `SELECT id, name, email, phone, company, status, converted_customer_id FROM crm_leads WHERE id=$1`, [parsed.data.leadId]))[0]
    if (!lead) return badRequest('Lead not found')
    if (lead.converted_customer_id) return NextResponse.json({ customerId: lead.converted_customer_id, linkedExisting: true, alreadyConverted: true })
    if (!['qualified', 'proposal', 'won'].includes(lead.status)) return badRequest('Only qualified/proposal/won leads can be converted')

    // Duplicate detection: an active customer sharing the lead's email or phone.
    let customerId: number | null = null
    let linkedExisting = false
    if (lead.email || lead.phone) {
      const existing = (await pgQuery<{ id: number }>(
        `SELECT id FROM sales_customers WHERE active=1 AND ((email IS NOT NULL AND email=$1) OR (phone IS NOT NULL AND phone=$2)) LIMIT 1`,
        [lead.email, lead.phone]))[0]
      if (existing) { customerId = existing.id; linkedExisting = true }
    }
    if (!customerId) {
      const code = `C-${String((await pgQuery<{ m: number }>(`SELECT COALESCE(MAX(id),0)::int AS m FROM sales_customers`))[0].m + 1).padStart(4, '0')}`
      customerId = (await pgQuery<{ id: number }>(
        `INSERT INTO sales_customers (code, name, kind, email, phone, notes, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,${NOW}) RETURNING id`,
        [code, lead.company || lead.name, lead.company ? 'company' : 'individual', lead.email, lead.phone, `Converted from CRM lead #${lead.id}`]))[0].id
    }
    await pgQuery(`UPDATE crm_leads SET converted_customer_id=$2, status=CASE WHEN status='won' THEN status ELSE 'won' END, updated_at=${NOW} WHERE id=$1`, [lead.id, customerId])
    await logAction(auth.user, 'crm.lead.convert', 'crm_leads', lead.id, { status: lead.status }, { customerId, linkedExisting }, clientIp(req))
    return NextResponse.json({ customerId, linkedExisting })
  } catch (e) { return apiError(e, 'Conversion failed') }
}
