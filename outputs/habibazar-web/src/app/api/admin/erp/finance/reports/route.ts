import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import { loadTallies, listCompanies } from '@/lib/erp/ledgerData'
import { trialBalance, incomeStatement, balanceSheet } from '@/lib/erp/ledger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

// GET — trial balance + income statement + balance sheet from posted entries.
// ?company=<id> scopes to one company; omitted/all = consolidated group books.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    const raw = req.nextUrl.searchParams.get('company')
    const companyId = raw && raw !== 'all' ? Number(raw) : undefined
    const tallies = await loadTallies(companyId)
    return NextResponse.json({
      trialBalance: trialBalance(tallies),
      incomeStatement: incomeStatement(tallies),
      balanceSheet: balanceSheet(tallies),
      companies: await listCompanies(),
      scope: companyId ?? 'all',
    })
  } catch (e) { return apiError(e, 'Failed to build reports') }
}

const companyCreate = z.object({ action: z.literal('company.create'), code: z.string().min(1).max(20).regex(/^[A-Za-z0-9-]+$/), nameEn: z.string().min(1).max(120), nameFa: z.string().min(1).max(120) })
const body = z.discriminatedUnion('action', [companyCreate])

// POST — register a company/branch for branch accounting. RBAC + audit.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin('edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, body)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    const dup = await pgQuery(`SELECT 1 FROM erp_companies WHERE code=$1`, [d.code.toUpperCase()])
    if (dup.length) return NextResponse.json({ error: 'Code already exists' }, { status: 409 })
    const row = (await pgQuery<{ id: number }>(
      `INSERT INTO erp_companies (code, name_en, name_fa, created_at) VALUES ($1,$2,$3,${NOW}) RETURNING id`,
      [d.code.toUpperCase(), d.nameEn, d.nameFa]))[0]
    await logAction(auth.user, 'erp.company.create', 'erp_companies', String(row.id), { code: d.code })
    return NextResponse.json({ id: row.id })
  } catch (e) { return apiError(e, 'Failed to create company') }
}
