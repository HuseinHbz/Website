import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, requirePermission, requireOp } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { clientIp } from '@/lib/api/clientIp'
import { listPeriods, createPeriod, transitionPeriod, postOpeningBalance, runYearEndClosing, chartOfAccounts } from '@/lib/erp/accountingData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — fiscal periods (+ chart-of-accounts tree for the opening/closing forms).
export async function GET(req: NextRequest) {
  const auth = await requirePermission('erp.finance', 'read')
  if ('error' in auth) return auth.error
  try {
    if (req.nextUrl.searchParams.get('view') === 'accounts') return NextResponse.json(await chartOfAccounts())
    return NextResponse.json({ periods: await listPeriods() })
  } catch (e) { return apiError(e, 'Failed to load fiscal periods') }
}

const periodCreate = z.object({ action: z.literal('period.create'), name: z.string().min(1).max(60), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), kind: z.enum(['year', 'period']).default('period'), parentId: z.number().int().optional() })
const periodTransition = z.object({ action: z.literal('period.transition'), id: z.number().int(), to: z.enum(['open', 'closed', 'locked']) })
const openingPost = z.object({ action: z.literal('opening.post'), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), entries: z.array(z.object({ accountId: z.number().int(), amount: z.number() })).min(2).max(500) })
const closingRun = z.object({ action: z.literal('closing.run'), fiscalPeriodId: z.number().int() })
const body = z.discriminatedUnion('action', [periodCreate, periodTransition, openingPost, closingRun])

export async function POST(req: NextRequest) {
  const auth = await requirePermission('erp.finance', 'write', 'manage_settings') // accounting-core actions are admin-only
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, body)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  const ip = clientIp(req)
  try {
    switch (d.action) {
      case 'period.create': {
        const id = await createPeriod(d)
        await logAction(auth.user, 'gl.period.create', 'gl_fiscal_period', id, null, { name: d.name, kind: d.kind }, ip)
        return NextResponse.json({ id })
      }
      case 'period.transition': {
        { const opKey = d.to === 'open' ? 'erp.finance:reopen_period' : 'erp.finance:close_period'
          const deny = await requireOp(auth.user, opKey, 'manage_settings'); if (deny) return deny }
        const r = await transitionPeriod(d.id, d.to, auth.user.id)
        if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
        await logAction(auth.user, 'gl.period.transition', 'gl_fiscal_period', d.id, null, { to: d.to }, ip)
        return NextResponse.json({ ok: true })
      }
      case 'opening.post': {
        const r = await postOpeningBalance(d, auth.user.id)
        await logAction(auth.user, 'gl.opening.post', 'gl_journal_entry', r.entryId, null, { date: d.date, lines: d.entries.length }, ip)
        return NextResponse.json(r)
      }
      case 'closing.run': {
        const r = await runYearEndClosing(d.fiscalPeriodId, auth.user.id)
        if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
        await logAction(auth.user, 'gl.yearend.close', 'gl_journal_entry', r.entryId!, null, { fiscalPeriodId: d.fiscalPeriodId, netIncome: r.netIncome }, ip)
        return NextResponse.json(r)
      }
    }
  } catch (e) { return apiError(e, 'Accounting action failed') }
}
