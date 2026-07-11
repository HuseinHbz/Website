import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson, badRequest } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import { ACCOUNT_TYPES } from '@/lib/erp/ledger'
import { chartOfAccounts } from '@/lib/erp/accountingData'
import { isCyclicParent } from '@/lib/erp/accountingCore'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — the chart of accounts with each account's posted balance.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    if (req.nextUrl.searchParams.get('tree') === '1') return NextResponse.json(await chartOfAccounts())
    const accounts = await pgQuery(
      `SELECT a.id, a.code, a.name_en AS "nameEn", a.name_fa AS "nameFa", a.type, a.active,
              COALESCE(SUM(CASE WHEN e.status='posted' THEN l.debit ELSE 0 END),0)::float AS debit,
              a.parent_id AS "parentId",
              COALESCE(SUM(CASE WHEN e.status='posted' THEN l.credit ELSE 0 END),0)::float AS credit
       FROM gl_accounts a
       LEFT JOIN gl_journal_lines l ON l.account_id=a.id
       LEFT JOIN gl_journal_entries e ON e.id=l.entry_id
       GROUP BY a.id, a.code, a.name_en, a.name_fa, a.type, a.active, a.parent_id
       ORDER BY a.code`, [])
    return NextResponse.json({ accounts })
  } catch (e) { return apiError(e, 'Failed to load accounts') }
}

const schema = z.object({
  id: z.number().int().positive().optional(),
  code: z.string().min(1).max(20).regex(/^[0-9.]+$/, 'numeric account code'),
  nameEn: z.string().min(1).max(160),
  nameFa: z.string().max(160).optional(),
  type: z.enum(ACCOUNT_TYPES),
  parentId: z.number().int().positive().nullable().optional(),
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
      const dup = (await pgQuery(`SELECT id FROM gl_accounts WHERE code=$1`, [d.code]))[0]
      if (dup) return badRequest('An account with this code already exists')
      const row = (await pgQuery(
        `INSERT INTO gl_accounts (code, name_en, name_fa, type, parent_id, active) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [d.code, d.nameEn, d.nameFa ?? null, d.type, d.parentId ?? null, d.active ? 1 : 0]))[0] as { id: number }
      await logAction(auth.user, 'gl.account.create', 'gl_account', row.id)
      return NextResponse.json({ id: row.id })
    }
    if (d.parentId != null) {
      const all = (await pgQuery(`SELECT id, code, type, parent_id AS "parentId" FROM gl_accounts`)) as unknown as { id: number; code: string; type: typeof ACCOUNT_TYPES[number]; parentId: number | null; nameEn: string }[]
      if (isCyclicParent(all.map(a => ({ ...a, nameEn: a.code })), d.id, d.parentId)) return badRequest('That parent would create a cycle in the chart of accounts')
    }
    await pgQuery(`UPDATE gl_accounts SET code=$2, name_en=$3, name_fa=$4, type=$5, parent_id=$6, active=$7 WHERE id=$1`,
      [d.id, d.code, d.nameEn, d.nameFa ?? null, d.type, d.parentId ?? null, d.active ? 1 : 0])
    await logAction(auth.user, 'gl.account.update', 'gl_account', d.id)
    return NextResponse.json({ id: d.id })
  } catch (e) { return apiError(e, 'Failed to save account') }
}
export const PUT = POST

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin('delete')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, z.object({ id: z.number().int().positive() }))
  if ('error' in parsed) return parsed.error
  try {
    const used = (await pgQuery(`SELECT 1 FROM gl_journal_lines WHERE account_id=$1 LIMIT 1`, [parsed.data.id]))[0]
    if (used) return badRequest('Account has journal lines; deactivate it instead of deleting')
    await pgQuery(`DELETE FROM gl_accounts WHERE id=$1`, [parsed.data.id])
    await logAction(auth.user, 'gl.account.delete', 'gl_account', parsed.data.id)
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e, 'Failed to delete account') }
}
