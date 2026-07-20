import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, requirePermission } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { listBanks, bankBalances, upsertBank } from '@/lib/treasury/bankOpsData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = await requirePermission('erp.treasury', 'read'); if ('error' in auth) return auth.error
  try { if (req.nextUrl.searchParams.get('view') === 'balances') return NextResponse.json({ balances: await bankBalances() }); return NextResponse.json({ banks: await listBanks() }) }
  catch (e) { return apiError(e, 'Failed to load banks') }
}
const schema = z.object({ id: z.number().int().positive().optional(), name: z.string().min(1).max(120), bank: z.string().max(120).optional(), iban: z.string().max(40).optional(), accountNo: z.string().max(40).optional(), swift: z.string().max(20).optional(), branch: z.string().max(120).optional(), country: z.string().max(60).optional(), accountType: z.enum(['current','saving','foreign','petty_cash','clearing']).optional(), currency: z.string().max(8).optional(), companyId: z.number().int().positive().nullable().optional(), openingBalance: z.number().optional(), status: z.enum(['active','inactive','closed']).optional() })
export async function POST(req: NextRequest) {
  const auth = await requirePermission('erp.treasury', 'write', 'edit'); if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema); if ('error' in parsed) return parsed.error
  try { const r = await upsertBank(parsed.data); await logAction(auth.user, 'treasury.bank.save', 'bank_accounts', r.id, null, { name: parsed.data.name }); return NextResponse.json(r) }
  catch (e) { return apiError(e, 'Bank save failed') }
}
