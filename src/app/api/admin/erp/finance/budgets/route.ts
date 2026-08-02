import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, requirePermission } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { BUDGET_TYPES, BUDGET_STATUSES } from '@/lib/erp/budget'
import {
  listBudgets, getBudget, createBudget, updateBudget, transitionBudget,
  deleteBudget, budgetAnalysis, listBudgetVersions, budgetPortfolio,
} from '@/lib/erp/budgetData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — list / ?id= detail / ?analysis= budget-vs-actual / ?portfolio=1 / ?versions=
export async function GET(req: NextRequest) {
  const auth = await requirePermission('erp.finance', 'read')
  if ('error' in auth) return auth.error
  const sp = req.nextUrl.searchParams
  try {
    if (sp.get('portfolio')) return NextResponse.json({ portfolio: await budgetPortfolio() })
    const analysisId = Number(sp.get('analysis'))
    if (analysisId) { const a = await budgetAnalysis(analysisId); return a ? NextResponse.json(a) : NextResponse.json({ error: 'Not found' }, { status: 404 }) }
    const versionsId = Number(sp.get('versions'))
    if (versionsId) return NextResponse.json({ versions: await listBudgetVersions(versionsId) })
    const id = Number(sp.get('id'))
    if (id) { const b = await getBudget(id); return b ? NextResponse.json(b) : NextResponse.json({ error: 'Not found' }, { status: 404 }) }
    return NextResponse.json({ budgets: await listBudgets() })
  } catch (e) { return apiError(e, 'Failed to load budgets') }
}

const lineSchema = z.object({
  category: z.string().min(1).max(120), costCenterId: z.number().int().positive().nullable().optional(),
  accountId: z.number().int().positive().nullable().optional(), period: z.string().max(7).nullable().optional(),
  amount: z.number(), notes: z.string().max(400).optional(),
})
const budgetFields = {
  code: z.string().max(40).optional(), nameEn: z.string().min(1).max(120), nameFa: z.string().max(120).optional(),
  budgetType: z.enum(BUDGET_TYPES), fiscalYear: z.number().int().min(1300).max(3000), currency: z.string().max(8).optional(),
  companyId: z.number().int().positive().nullable().optional(), costCenterId: z.number().int().positive().nullable().optional(),
  notes: z.string().max(1000).optional(), lines: z.array(lineSchema).max(500).optional(),
}
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), ...budgetFields }),
  z.object({ action: z.literal('update'), id: z.number().int().positive(), ...budgetFields, nameEn: z.string().max(120).optional(), budgetType: z.enum(BUDGET_TYPES).optional(), fiscalYear: z.number().int().min(1300).max(3000).optional() }),
  z.object({ action: z.literal('transition'), id: z.number().int().positive(), to: z.enum(BUDGET_STATUSES), note: z.string().max(400).optional() }),
  z.object({ action: z.literal('delete'), id: z.number().int().positive() }),
])

export async function POST(req: NextRequest) {
  const auth = await requirePermission('erp.finance', 'write', 'edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    if (d.action === 'create') { const r = await createBudget(d, auth.user.id); await logAction(auth.user, 'budget.create', 'erp_budgets', r.id, null, { name: d.nameEn, fy: d.fiscalYear }); return NextResponse.json(r) }
    if (d.action === 'update') { await updateBudget(d.id, d, auth.user.id); await logAction(auth.user, 'budget.update', 'erp_budgets', d.id); return NextResponse.json({ ok: true }) }
    if (d.action === 'transition') {
      // Approve/lock require an administrator (governance gate).
      if ((d.to === 'approved' || d.to === 'locked') && !['super_admin', 'administrator'].includes(auth.user.role))
        return NextResponse.json({ error: 'Approving or locking a budget requires an administrator' }, { status: 403 })
      await transitionBudget(d.id, d.to, auth.user.id, d.note)
      await logAction(auth.user, `budget.${d.to}`, 'erp_budgets', d.id, null, { to: d.to })
      return NextResponse.json({ ok: true })
    }
    if (!['super_admin', 'administrator'].includes(auth.user.role)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
    await deleteBudget(d.id); await logAction(auth.user, 'budget.delete', 'erp_budgets', d.id)
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e, 'Budget operation failed') }
}
