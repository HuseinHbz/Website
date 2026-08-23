import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, badRequest, requirePermission, requireOp } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import { rialRateFor } from '@/lib/erp/currencyData'
import { businessError, toApiResponse } from '@/lib/errors'
import { assertPostable } from '@/lib/erp/accountingData'
import { clientIp } from '@/lib/api/clientIp'
import { entryBalanced, isJournalEntryDeletable } from '@/lib/erp/ledger'
import { reverseEntry, postEntryById } from '@/lib/erp/glPosting'
import { nextNumber } from '@/lib/numbering/integrate'
import { createApprovalRequest } from '@/lib/erp/approvalData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

// GET — list entries, one entry with lines (?id=), or saved templates (?templates=1).
export async function GET(req: NextRequest) {
  const auth = await requirePermission('erp.finance', 'read')
  if ('error' in auth) return auth.error
  try {
    if (req.nextUrl.searchParams.get('pendingApprovals')) {
      const pending = await pgQuery(
        `SELECT r.id, r.ref_id AS "entryId", r.title, r.amount::float AS amount, r.created_at AS "createdAt", u.name AS "createdByName"
         FROM approval_requests r LEFT JOIN users u ON u.id=r.created_by
         WHERE r.doc_type='journal_entry' AND r.status='pending' ORDER BY r.id DESC LIMIT 50`)
      return NextResponse.json({ pending })
    }
    if (req.nextUrl.searchParams.get('templates')) {
      const templates = await pgQuery(
        `SELECT id, name, memo, lines, created_at AS "createdAt" FROM gl_entry_templates ORDER BY id DESC LIMIT 100`)
      return NextResponse.json({ templates })
    }
    const id = Number(req.nextUrl.searchParams.get('id'))
    if (id) {
      const entry = (await pgQuery(
        `SELECT id, entry_no AS "entryNo", date, memo, reference, status, total::float AS total, posted_at AS "postedAt",
                reversal_of AS "reversalOf", reversed_by AS "reversedBy", created_by AS "createdBy"
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
      `SELECT id, entry_no AS "entryNo", date, memo, status, total::float AS total, created_at AS "createdAt", posted_at AS "postedAt",
              reversal_of AS "reversalOf", reversed_by AS "reversedBy"
       FROM gl_journal_entries ORDER BY date DESC, id DESC LIMIT 200`, [])
    return NextResponse.json({ entries })
  } catch (e) { return apiError(e, 'Failed to load journal') }
}

const lineSchema = z.object({
  accountId: z.number().int().positive(),
  debit: z.number().min(0).default(0),
  credit: z.number().min(0).default(0),
  memo: z.string().max(240).optional(),
})
const createSchema = z.object({
  currency: z.enum(['IRR', 'IRT', 'USD', 'EUR']).default('IRR'),
  date: z.string().min(1).max(30),
  memo: z.string().max(500).optional(),
  reference: z.string().max(120).optional(),
  post: z.boolean().default(false),
  companyId: z.number().int().positive().optional(),
  saveTemplate: z.string().max(120).optional(), // بند ۳.۳: also store as a reusable template
  lines: z.array(lineSchema).min(2).max(200),
})

/** Maker/checker gate (بند ۴): when on and over-threshold, posting goes through
 * the approval matrix instead of happening inline. Returns the request id. */
async function makerCheckerGate(entryId: number, total: number, userId: string): Promise<number | null> {
  const st = new Map((await pgQuery<{ key: string; value: string }>(
    `SELECT key, value FROM erp_settings WHERE key IN ('gl_posting_approval','gl_posting_approval_threshold')`)).map(r => [r.key, r.value]))
  if ((st.get('gl_posting_approval') ?? 'off') !== 'on') return null
  const threshold = Number(st.get('gl_posting_approval_threshold') ?? 0)
  if (total < threshold) return null
  const e = (await pgQuery<{ entry_no: string }>(`SELECT entry_no FROM gl_journal_entries WHERE id=$1`, [entryId]))[0]
  const r = await createApprovalRequest(
    { docType: 'journal_entry', refType: 'gl_journal_entries', refId: entryId, title: `Post journal ${e?.entry_no ?? entryId}`, amount: total },
    userId)
  return r.autoApproved ? null : r.id
}

// POST — create a journal entry (draft or posted). Numbered by the Numbering
// Engine (gapless yearly JE format, بند ۳.۱); optional template save (۳.۳).
export async function POST(req: NextRequest) {
  const auth = await requirePermission('erp.finance', 'write', 'edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, createSchema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  const check = entryBalanced(d.lines)
  if (!check.ok) return toApiResponse(businessError('ERP-FINANCE-JOURNAL-UNBALANCED', { reason: check.reason ?? '' }))
  try {
    const rate = await rialRateFor(d.currency)
    if (rate == null) return badRequest(`No exchange rate configured for ${d.currency} — set one in Finance → Currency`)
    // 26.27: create-and-post is the same sensitive op as posting — same gate
    if (d.post) { const deny = await requireOp(auth.user, 'erp.finance:post', 'edit'); if (deny) return deny }
    if (d.post) { const gate = await assertPostable(d.date); if (!gate.ok) return badRequest(gate.error!) }
    const entryNo = await nextNumber('journal', { legacyPrefix: 'JE', userId: auth.user.id })
    const entry = (await pgQuery(
      `INSERT INTO gl_journal_entries (entry_no, date, memo, reference, status, total, created_by, company_id, currency, exchange_rate, posted_at)
       VALUES ($1,$2,$3,$4,'draft',$5,$6,$7,$8,$9,NULL) RETURNING id`,
      [entryNo, d.date, d.memo ?? null, d.reference ?? null, check.totalDebit, auth.user.id, d.companyId ?? null, d.currency, rate]))[0] as { id: number }
    for (let i = 0; i < d.lines.length; i++) {
      const l = d.lines[i]
      await pgQuery(`INSERT INTO gl_journal_lines (entry_id, account_id, debit, credit, memo, line_no) VALUES ($1,$2,$3,$4,$5,$6)`,
        [entry.id, l.accountId, l.debit || 0, l.credit || 0, l.memo ?? null, i])
    }
    if (d.saveTemplate) {
      await pgQuery(`INSERT INTO gl_entry_templates (name, memo, lines, created_by) VALUES ($1,$2,$3,$4)`,
        [d.saveTemplate, d.memo ?? null, JSON.stringify(d.lines), auth.user.id])
    }
    let pendingApproval: number | null = null
    if (d.post) {
      pendingApproval = await makerCheckerGate(entry.id, check.totalDebit, auth.user.id)
      if (!pendingApproval) {
        const res = await postEntryById(entry.id)
        if (!res.ok) return badRequest(res.error!)
      }
    }
    await logAction(auth.user, d.post ? 'gl.entry.post' : 'gl.entry.create', 'gl_journal_entry', entry.id, null, { entryNo, total: check.totalDebit, pendingApproval }, clientIp(req))
    return NextResponse.json({ id: entry.id, entryNo, pendingApproval })
  } catch (e) { return apiError(e, 'Failed to create entry') }
}

const opSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('post'), id: z.number().int().positive() }),
  z.object({ op: z.literal('void'), id: z.number().int().positive() }),
  z.object({
    // بند ۳.۲: edit a DRAFT entry only — header + full line replacement.
    op: z.literal('update'), id: z.number().int().positive(),
    date: z.string().min(1).max(30), memo: z.string().max(500).optional(),
    reference: z.string().max(120).optional(), lines: z.array(lineSchema).min(2).max(200),
  }),
])

// PUT — post (maker/checker-aware), void (reversal entry), or update a draft.
export async function PUT(req: NextRequest) {
  const auth = await requirePermission('erp.finance', 'write', 'edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, opSchema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    const e = (await pgQuery(`SELECT status, date, total::float AS total, created_by AS "createdBy", entry_no AS "entryNo", reversed_by AS "reversedBy", reversal_of AS "reversalOf" FROM gl_journal_entries WHERE id=$1`, [d.id]))[0] as { status: string; date: string; total: number; createdBy: string | null; entryNo: string; reversedBy: number | null; reversalOf: number | null } | undefined
    if (!e) return badRequest('Not found')
    const ip = clientIp(req)

    if (d.op === 'update') {
      if (e.status !== 'draft') return badRequest('Only draft entries can be edited')
      const check = entryBalanced(d.lines)
      if (!check.ok) return toApiResponse(businessError('ERP-FINANCE-JOURNAL-UNBALANCED', { reason: check.reason ?? '' }))
      const before = await pgQuery(`SELECT account_id, debit::float AS debit, credit::float AS credit FROM gl_journal_lines WHERE entry_id=$1 ORDER BY line_no`, [d.id])
      await pgQuery(`UPDATE gl_journal_entries SET date=$2, memo=$3, reference=$4, total=$5 WHERE id=$1`,
        [d.id, d.date, d.memo ?? null, d.reference ?? null, check.totalDebit])
      await pgQuery(`DELETE FROM gl_journal_lines WHERE entry_id=$1`, [d.id])
      for (let i = 0; i < d.lines.length; i++) {
        const l = d.lines[i]
        await pgQuery(`INSERT INTO gl_journal_lines (entry_id, account_id, debit, credit, memo, line_no) VALUES ($1,$2,$3,$4,$5,$6)`,
          [d.id, l.accountId, l.debit || 0, l.credit || 0, l.memo ?? null, i])
      }
      await logAction(auth.user, 'gl.entry.update', 'gl_journal_entry', d.id, { lines: before }, { lines: d.lines, total: check.totalDebit }, ip)
      return NextResponse.json({ ok: true })
    }

    if (d.op === 'post') {
      const deny = await requireOp(auth.user, 'erp.finance:post', 'edit')
      if (deny) return deny
      if (e.status !== 'draft') return badRequest('Only draft entries can be posted')
      // بند ۴: separation of duties — over-threshold posts go to the approval
      // queue; the maker can never approve their own entry (enforced in approvals).
      const pendingApproval = await makerCheckerGate(d.id, e.total, auth.user.id)
      if (pendingApproval) {
        await logAction(auth.user, 'gl.entry.post.pending', 'gl_journal_entry', d.id, { status: 'draft' }, { approvalRequest: pendingApproval }, ip)
        return NextResponse.json({ ok: true, pendingApproval })
      }
      const res = await postEntryById(d.id)
      if (!res.ok) return badRequest(res.error!)
      await logAction(auth.user, 'gl.entry.post', 'gl_journal_entry', d.id, { status: e.status }, { status: 'posted' }, ip)
      return NextResponse.json({ ok: true })
    }

    { const deny = await requireOp(auth.user, 'erp.finance:void', 'edit')
      if (deny) return deny }
    // op === 'void' — بند ۲.۱: a posted entry is neutralised by a REVERSAL entry.
    if (e.status !== 'posted') return badRequest('Only posted entries can be voided')
    // 26.26c بند ۱.۲ re-void guard: an already-reversed entry must not be reversed
    // again (a second reversal would double-negate the balances), and a reversal
    // entry itself must not be reversed (that would un-reverse the original).
    if (e.reversedBy) return badRequest('This entry has already been reversed')
    if (e.reversalOf) return badRequest('A reversal entry cannot itself be voided')
    const rev = await reverseEntry(d.id, auth.user.id)
    await logAction(auth.user, 'gl.entry.void', 'gl_journal_entry', d.id, { status: 'posted' }, { status: 'void', reversalId: rev.reversalId }, ip)
    return NextResponse.json({ ok: true, reversalId: rev.reversalId })
  } catch (e) { return apiError(e, 'Operation failed') }
}

// DELETE — بند ۲.۲: ONLY drafts are physically deletable. A voided entry was
// posted once and stays forever (its reversal is the correction).
export async function DELETE(req: NextRequest) {
  const auth = await requirePermission('erp.finance', 'write', 'delete')
  if ('error' in auth) return auth.error
  { const deny = await requireOp(auth.user, 'erp.finance:delete', 'delete'); if (deny) return deny }
  const parsed = await readJson(req, z.object({ id: z.number().int().positive() }))
  if ('error' in parsed) return parsed.error
  try {
    const e = (await pgQuery(`SELECT status, entry_no AS "entryNo" FROM gl_journal_entries WHERE id=$1`, [parsed.data.id]))[0] as { status: string; entryNo: string } | undefined
    if (!e) return badRequest('Not found')
    if (!isJournalEntryDeletable(e.status)) return toApiResponse(businessError('ERP-FINANCE-POSTED-ENTRY-IMMUTABLE', undefined))
    await pgQuery(`DELETE FROM gl_journal_entries WHERE id=$1`, [parsed.data.id])
    await logAction(auth.user, 'gl.entry.delete', 'gl_journal_entry', parsed.data.id, e, null, clientIp(req))
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e, 'Failed to delete entry') }
}
