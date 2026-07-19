import { NextRequest, NextResponse } from 'next/server'
import { apiError, requireAdmin } from '@/lib/api/respond'
import { scanLedgerIntegrity } from '@/lib/erp/accountingValidationData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — Accounting Validation Engine (Phase 26.15.1): read-only auditor scan of
// the General Ledger for unbalanced/one-sided/missing-account/zero-total entries.
// ?status=all includes drafts; default scans posted entries only.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    const status = req.nextUrl.searchParams.get('status') === 'all' ? 'all' : 'posted'
    const limit = Number(req.nextUrl.searchParams.get('limit')) || undefined
    const summary = await scanLedgerIntegrity({ status, limit })
    return NextResponse.json({ summary })
  } catch (e) { return apiError(e, 'Ledger validation failed') }
}
