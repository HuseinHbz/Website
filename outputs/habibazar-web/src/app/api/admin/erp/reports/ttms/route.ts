import { NextRequest, NextResponse } from 'next/server'
import { apiError, requireAdmin } from '@/lib/api/respond'
import { ttmsReport, ttmsCsv } from '@/lib/erp/ttms'
import { jalaliQuarter } from '@/lib/erp/jalali'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — گزارش معاملات فصلی for ?jYear=&quarter= (defaults to the current
// Persian quarter). ?format=csv streams the tax-portal importable file.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    const now = jalaliQuarter(new Date().toISOString())
    const jYear = Number(req.nextUrl.searchParams.get('jYear')) || now.jYear
    const quarter = (Number(req.nextUrl.searchParams.get('quarter')) || now.quarter) as 1 | 2 | 3 | 4
    if (quarter < 1 || quarter > 4) return NextResponse.json({ error: 'quarter must be 1..4' }, { status: 400 })
    const report = await ttmsReport(jYear, quarter)
    if (req.nextUrl.searchParams.get('format') === 'csv') {
      return new NextResponse(ttmsCsv(report), {
        headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="ttms-${jYear}-Q${quarter}.csv"` },
      })
    }
    return NextResponse.json({ report })
  } catch (e) { return apiError(e, 'Failed to build TTMS report') }
}
