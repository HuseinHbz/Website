import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, requirePermission } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import {
  listAccounts, createAccount, importStatement, statementLines, autoMatch, setLineStatus, reconSummary,
  listCheques, createCheque, transitionCheque, chequeOverview,
  listPetty, addPetty, pettyOverview, cashFlow,
} from '@/lib/erp/bankingData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — ?view=accounts | cheques | petty | statement&account= (+ summaries)
export async function GET(req: NextRequest) {
  const auth = await requirePermission('erp.finance', 'read')
  if ('error' in auth) return auth.error
  try {
    const sp = req.nextUrl.searchParams
    const view = sp.get('view')
    if (view === 'accounts') return NextResponse.json({ accounts: await listAccounts() })
    if (view === 'cheques') return NextResponse.json({ cheques: await listCheques(), kpis: await chequeOverview() })
    if (view === 'petty') return NextResponse.json({ entries: await listPetty(), summary: await pettyOverview() })
    if (view === 'cashflow') return NextResponse.json(await cashFlow())
    if (view === 'statement') {
      const accountId = Number(sp.get('account'))
      if (!accountId) return NextResponse.json({ error: 'account required' }, { status: 400 })
      return NextResponse.json({ lines: await statementLines(accountId), summary: await reconSummary(accountId) })
    }
    return NextResponse.json({ accounts: await listAccounts() })
  } catch (e) { return apiError(e, 'Failed to load banking data') }
}

const accountCreate = z.object({ action: z.literal('account.create'), name: z.string().min(1).max(120), bank: z.string().max(80).optional(), iban: z.string().max(40).optional(), accountNo: z.string().max(40).optional(), currency: z.string().max(4).optional(), openingBalance: z.number().optional() })
const stmtImport = z.object({
  action: z.literal('statement.import'), accountId: z.number().int(),
  lines: z.array(z.object({ date: z.string().max(20), amount: z.number(), description: z.string().max(300).optional(), reference: z.string().max(80).optional() })).min(1).max(2000),
})
const stmtAuto = z.object({ action: z.literal('statement.auto'), accountId: z.number().int() })
const stmtSet = z.object({ action: z.literal('statement.set'), lineId: z.number().int(), status: z.enum(['unmatched', 'matched', 'excluded']), matchedRef: z.string().max(80).optional() })
const chequeCreate = z.object({ action: z.literal('cheque.create'), direction: z.enum(['issued', 'received']), number: z.string().min(1).max(60), party: z.string().min(1).max(160), amount: z.number().positive(), currency: z.string().max(4).optional(), dueDate: z.string().max(20).optional(), bankAccountId: z.number().int().optional(), note: z.string().max(300).optional() })
const chequeMove = z.object({ action: z.literal('cheque.transition'), id: z.number().int(), to: z.enum(['issued', 'received', 'deposited', 'presented', 'cleared', 'bounced', 'cancelled']) })
const pettyAdd = z.object({ action: z.literal('petty.add'), kind: z.enum(['float', 'expense', 'replenish']), date: z.string().max(20), amount: z.number().positive(), category: z.string().max(60).optional(), note: z.string().max(300).optional() })
const body = z.discriminatedUnion('action', [accountCreate, stmtImport, stmtAuto, stmtSet, chequeCreate, chequeMove, pettyAdd])

export async function POST(req: NextRequest) {
  const auth = await requirePermission('erp.finance', 'write', 'edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, body)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    switch (d.action) {
      case 'account.create': { const id = await createAccount(d); await logAction(auth.user, 'erp.bank.account.create', 'bank_accounts', String(id), { name: d.name }); return NextResponse.json({ id }) }
      case 'statement.import': { const n = await importStatement(d.accountId, d.lines); await logAction(auth.user, 'erp.bank.statement.import', 'bank_statement_lines', String(d.accountId), { imported: n }); return NextResponse.json({ imported: n }) }
      case 'statement.auto': { const r = await autoMatch(d.accountId); await logAction(auth.user, 'erp.bank.statement.auto', 'bank_statement_lines', String(d.accountId), r); return NextResponse.json(r) }
      case 'statement.set': { await setLineStatus(d.lineId, d.status, d.matchedRef); await logAction(auth.user, 'erp.bank.statement.set', 'bank_statement_lines', String(d.lineId), { status: d.status }); return NextResponse.json({ ok: true }) }
      case 'cheque.create': { const id = await createCheque(d, auth.user.id); await logAction(auth.user, 'erp.cheque.create', 'cheques', String(id), { direction: d.direction, amount: d.amount }); return NextResponse.json({ id }) }
      case 'cheque.transition': {
        const r = await transitionCheque(d.id, d.to)
        if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
        await logAction(auth.user, 'erp.cheque.transition', 'cheques', String(d.id), { to: d.to })
        return NextResponse.json({ ok: true })
      }
      case 'petty.add': { const id = await addPetty(d, auth.user.id); await logAction(auth.user, 'erp.petty.add', 'petty_cash_entries', String(id), { kind: d.kind, amount: d.amount }); return NextResponse.json({ id }) }
    }
  } catch (e) { return apiError(e, 'Failed to update banking') }
}
