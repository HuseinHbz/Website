import { NextRequest, NextResponse } from 'next/server'
import { apiError, badRequest, requirePermission } from '@/lib/api/respond'
import { accountStatement } from '@/lib/erp/accountingData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — the general ledger (account statement) for one account with a running balance.
export async function GET(req: NextRequest) {
  const auth = await requirePermission('erp.finance', 'read')
  if ('error' in auth) return auth.error
  const sp = req.nextUrl.searchParams
  const accountId = Number(sp.get('account'))
  if (!accountId) return badRequest('account is required')
  try {
    const st = await accountStatement(accountId, sp.get('from') || undefined, sp.get('to') || undefined)
    return st ? NextResponse.json(st) : NextResponse.json({ error: 'Account not found' }, { status: 404 })
  } catch (e) { return apiError(e, 'Failed to load account statement') }
}
