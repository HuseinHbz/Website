import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson, badRequest } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import { entryBalanced } from '@/lib/erp/ledger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

// GET — list entries, or one entry with its lines (?id=).
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    const id = Number(req.nextUrl.searchParams.get('id'))
    if (id) {
      const entry = (await pgQuery(
        `SELECT id, entry_no AS "entryNo", date, memo, reference, status, total::float AS total, posted_at AS "postedAt"
         FROM gl_journal_entries WHERE id=$1`, [id]))[0]
      if (!entry) return badRequest('Not found')
      const lines = await pgQuery(
        `SELECT l.id, l.account_id AS "accountId", a.code, a.name_en AS "accountEn", a.name_fa AS "accountFa",
                l.debit::float AS debit, l.credit::float AS credit, l.memo
         FROM gl_journal_lines l JOIN gl_accounts a ON a.id=l.account_id
         WHERE l.entry_id=$1 ORDER BY l.line_no, l.id`, [id])
      return NextResponse.json({ entry, lines })
    }
    const entries = await pgQuery(
      `SELECT id, entry_no AS "entryNo", date, memo, status, total::float AS total, created_at AS "createdAt", posted_at AS "postedAt"
       FROM gl_journal_entries ORDER BY date DESC, id DESC LIMIT 200`, [])
    return NextResponse.json({ entries })
  } catch (e) { return apiError(e, 'Failed to load journal') }
}

const createSchema = z.object({
  date: z.string().min(1).max(30),
  memo: z.string().max(500).optional(),
  reference: z.string().max(120).optional(),
  post: z.boolean().default(false),
  lines: z.array(z.object({
    accountId: z.number().int().positive(),
    debit: z.number().min(0).default(0),
    credit: z.number().min(0).default(0),
    memo: z.string().max(240).optional(),
  })).min(2).max(200),
})

// POST — create a journal entry (draft or immediately posted). Server-side
// double-entry validation: debits must equal credits.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin('edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, createSchema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  const check = entryBalanced(d.lines)
  if (!check.ok) return badRequest(`Unbalanced entry: ${check.reason}`)
  try {
    const entryNo = `JE-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`
    const status = d.post ? 'posted' : 'draft'
    const entry = (await pgQuery(
      `INSERT INTO gl_journal_entries (entry_no, date, memo, reference, status, total, created_by, posted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,${d.post ? NOW : 'NULL'}) RETURNING id`,
      [entryNo, d.date, d.memo ?? null, d.reference ?? null, status, check.totalDebit, auth.user.id]))[0] as { id: number }
    for (let i = 0; i < d.lines.length; i++) {
      const l = d.lines[i]
      await pgQuery(`INSERT INTO gl_journal_lines (entry_id, account_id, debit, credit, memo, line_no) VALUES ($1,$2,$3,$4,$5,$6)`,
        [entry.id, l.accountId, l.debit || 0, l.credit || 0, l.memo ?? null, i])
    }
    await logAction(auth.user, d.post ? 'gl.entry.post' : 'gl.entry.create', 'gl_journal_entry', entry.id, null, { entryNo, total: check.totalDebit })
    return NextResponse.json({ id: entry.id, entryNo })
  } catch (e) { return apiError(e, 'Failed to create entry') }
}

const opSchema = z.object({ id: z.number().int().positive(), op: z.enum(['post', 'void']) })

// PUT — post a draft or void a posted entry.
export async function PUT(req: NextRequest) {
  const auth = await requireAdmin('edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, opSchema)
  if ('error' in parsed) return parsed.error
  const { id, op } = parsed.data
  try {
    const e = (await pgQuery(`SELECT status FROM gl_journal_entries WHERE id=$1`, [id]))[0] as { status: string } | undefined
    if (!e) return badRequest('Not found')
    if (op === 'post') {
      if (e.status !== 'draft') return badRequest('Only draft entries can be posted')
      // Re-verify balance from the stored lines before posting.
      const lines = (await pgQuery(`SELECT debit::float AS debit, credit::float AS credit, account_id AS "accountId" FROM gl_journal_lines WHERE entry_id=$1`, [id])) as { debit: number; credit: number; accountId: number }[]
      if (!entryBalanced(lines).ok) return badRequest('Entry is not balanced')
      await pgQuery(`UPDATE gl_journal_entries SET status='posted', posted_at=${NOW} WHERE id=$1`, [id])
      await logAction(auth.user, 'gl.entry.post', 'gl_journal_entry', id)
    } else {
      if (e.status !== 'posted') return badRequest('Only posted entries can be voided')
      await pgQuery(`UPDATE gl_journal_entries SET status='void' WHERE id=$1`, [id])
      await logAction(auth.user, 'gl.entry.void', 'gl_journal_entry', id)
    }
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e, 'Operation failed') }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin('delete')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, z.object({ id: z.number().int().positive() }))
  if ('error' in parsed) return parsed.error
  try {
    const e = (await pgQuery(`SELECT status FROM gl_journal_entries WHERE id=$1`, [parsed.data.id]))[0] as { status: string } | undefined
    if (e?.status === 'posted') return badRequest('Void the entry before deleting')
    await pgQuery(`DELETE FROM gl_journal_entries WHERE id=$1`, [parsed.data.id])
    await logAction(auth.user, 'gl.entry.delete', 'gl_journal_entry', parsed.data.id)
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e, 'Failed to delete entry') }
}
