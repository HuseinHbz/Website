import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson, badRequest } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import { clientIp } from '@/lib/api/clientIp'
import { loadCustomers, customerStatement } from '@/lib/erp/salesData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    const statementId = Number(req.nextUrl.searchParams.get('statement'))
    if (statementId) {
      const st = await customerStatement(statementId)
      return st ? NextResponse.json(st) : NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }
    return NextResponse.json({ customers: await loadCustomers() })
  } catch (e) { return apiError(e, 'Failed to load customers') }
}

const schema = z.object({
  id: z.number().int().positive().optional(),
  code: z.string().min(1).max(40),
  name: z.string().min(1).max(200),
  email: z.string().max(160).optional().nullable(),
  phone: z.string().max(60).optional().nullable(),
  company: z.string().max(200).optional().nullable(),
  taxId: z.string().max(60).optional().nullable(),
  kind: z.enum(['individual', 'company']).default('company'),
  nationalId: z.string().max(60).optional().nullable(),
  regNo: z.string().max(60).optional().nullable(),
  economicCode: z.string().max(60).optional().nullable(),
  creditLimit: z.number().min(0).default(0),
  address: z.string().max(400).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  active: z.boolean().default(true),
})

export async function POST(req: NextRequest) {
  const auth = await requireAdmin('edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    if (!d.id) {
      const dup = (await pgQuery(`SELECT id FROM sales_customers WHERE code=$1`, [d.code]))[0]
      if (dup) return badRequest('A customer with this code already exists')
      const row = (await pgQuery(
        `INSERT INTO sales_customers (code, name, email, phone, company, tax_id, credit_limit, address, notes, active, kind, national_id, reg_no, economic_code, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, to_char(now(),'YYYY-MM-DD HH24:MI:SS')) RETURNING id`,
        [d.code, d.name, d.email ?? null, d.phone ?? null, d.company ?? null, d.taxId ?? null, d.creditLimit, d.address ?? null, d.notes ?? null, d.active ? 1 : 0, d.kind, d.nationalId ?? null, d.regNo ?? null, d.economicCode ?? null]))[0] as { id: number }
      await logAction(auth.user, 'sales.customer.create', 'sales_customer', row.id, null, { code: d.code, name: d.name }, clientIp(req))
      return NextResponse.json({ id: row.id })
    }
    const before = (await pgQuery(`SELECT code, name, email, kind, credit_limit AS "creditLimit" FROM sales_customers WHERE id=$1`, [d.id]))[0] ?? null
    await pgQuery(
      `UPDATE sales_customers SET code=$2, name=$3, email=$4, phone=$5, company=$6, tax_id=$7, credit_limit=$8, address=$9, notes=$10, active=$11, kind=$12, national_id=$13, reg_no=$14, economic_code=$15, updated_at=to_char(now(),'YYYY-MM-DD HH24:MI:SS') WHERE id=$1`,
      [d.id, d.code, d.name, d.email ?? null, d.phone ?? null, d.company ?? null, d.taxId ?? null, d.creditLimit, d.address ?? null, d.notes ?? null, d.active ? 1 : 0, d.kind, d.nationalId ?? null, d.regNo ?? null, d.economicCode ?? null])
    await logAction(auth.user, 'sales.customer.update', 'sales_customer', d.id, before, { code: d.code, name: d.name, kind: d.kind, creditLimit: d.creditLimit }, clientIp(req))
    return NextResponse.json({ id: d.id })
  } catch (e) { return apiError(e, 'Failed to save customer') }
}
export const PUT = POST

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin('delete')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, z.object({ id: z.number().int().positive() }))
  if ('error' in parsed) return parsed.error
  try {
    const used = (await pgQuery(`SELECT 1 FROM sales_documents WHERE customer_id=$1 LIMIT 1`, [parsed.data.id]))[0]
    if (used) return badRequest('Customer has documents; deactivate instead of deleting')
    const before = (await pgQuery(`SELECT code, name FROM sales_customers WHERE id=$1`, [parsed.data.id]))[0] ?? null
    await pgQuery(`DELETE FROM sales_customers WHERE id=$1`, [parsed.data.id])
    await logAction(auth.user, 'sales.customer.delete', 'sales_customer', parsed.data.id, before, null, clientIp(req))
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e, 'Failed to delete customer') }
}
