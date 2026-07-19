import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import { loadTallies, listCompanies, bookIntercompany } from '@/lib/erp/ledgerData'
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

const legal = { regNo: z.string().max(60).optional(), nationalId: z.string().max(60).optional(), economicCode: z.string().max(60).optional(), taxNo: z.string().max(60).optional(), address: z.string().max(400).optional(), phone: z.string().max(40).optional() }
const companyCreate = z.object({ action: z.literal('company.create'), code: z.string().min(1).max(20).regex(/^[A-Za-z0-9-]+$/), nameEn: z.string().min(1).max(120), nameFa: z.string().min(1).max(120), ...legal })
const icTransfer = z.object({ action: z.literal('intercompany.transfer'), kind: z.enum(['transfer', 'settle']).default('transfer'), fromCompanyId: z.number().int(), toCompanyId: z.number().int(), amount: z.number().positive(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), memo: z.string().max(300).optional() })
const body = z.discriminatedUnion('action', [companyCreate, icTransfer])

// POST — register a company/branch for branch accounting. RBAC + audit.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin('edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, body)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    if (d.action === 'intercompany.transfer') {
      // Books two POSTED entries — an accounting action, administrator only.
      if (!['super_admin', 'administrator'].includes(auth.user.role)) return NextResponse.json({ error: 'Intercompany posting requires an administrator' }, { status: 403 })
      if (d.fromCompanyId === d.toCompanyId) return NextResponse.json({ error: 'Pick two different companies' }, { status: 400 })
      const r = await bookIntercompany(d, auth.user.id)
      await logAction(auth.user, 'erp.intercompany.transfer', 'gl_journal_entries', r.entryIds.join(','), { kind: d.kind, amount: d.amount, from: d.fromCompanyId, to: d.toCompanyId })
      return NextResponse.json(r)
    }
    const dup = await pgQuery(`SELECT 1 FROM erp_companies WHERE code=$1`, [d.code.toUpperCase()])
    if (dup.length) return NextResponse.json({ error: 'Code already exists' }, { status: 409 })
    const row = (await pgQuery<{ id: number }>(
      `INSERT INTO erp_companies (code, name_en, name_fa, reg_no, national_id, economic_code, tax_no, address, phone, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,${NOW}) RETURNING id`,
      [d.code.toUpperCase(), d.nameEn, d.nameFa, d.regNo ?? null, d.nationalId ?? null, d.economicCode ?? null, d.taxNo ?? null, d.address ?? null, d.phone ?? null]))[0]
    await logAction(auth.user, 'erp.company.create', 'erp_companies', String(row.id), { code: d.code })
    return NextResponse.json({ id: row.id })
  } catch (e) { return apiError(e, 'Failed to update companies') }
}
