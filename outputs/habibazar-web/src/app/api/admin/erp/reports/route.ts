import { NextResponse } from 'next/server'
import { apiError, badRequest, requireAdmin } from '@/lib/api/respond'
import { REPORTS, runReport } from '@/lib/reports/reportData'
import { toCsv } from '@/lib/reports/pivot'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — without `id`: the report catalog. With `id`: run that report and return
// its columns/rows/summary as JSON, or as a CSV download when `format=csv`.
export async function GET(req: Request) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  const format = url.searchParams.get('format')
  try {
    if (!id) return NextResponse.json({ reports: REPORTS })
    const def = REPORTS.find(r => r.id === id)
    if (!def) return badRequest('Unknown report')
    const out = await runReport(id)
    if (!out) return badRequest('Unknown report')
    if (format === 'csv') {
      const csv = toCsv(out.columns, out.rows)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${id}.csv"`,
        },
      })
    }
    return NextResponse.json({ def, ...out })
  } catch (e) { return apiError(e, 'Failed to run report') }
}
