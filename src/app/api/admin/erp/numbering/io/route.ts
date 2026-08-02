import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, badRequest, requirePermission } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { exportFormats, exportCsv, importFormats } from '@/lib/numbering/io'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — export format definitions. ?format=json (default) | csv (download).
export async function GET(req: NextRequest) {
  const auth = await requirePermission('system.numbering', 'read')
  if ('error' in auth) return auth.error
  try {
    if (req.nextUrl.searchParams.get('format') === 'csv') {
      const csv = await exportCsv()
      return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="numbering-formats.csv"' } })
    }
    const formats = await exportFormats()
    return new NextResponse(JSON.stringify({ formats }, null, 2), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="numbering-formats.json"' },
    })
  } catch (e) { return apiError(e, 'Export failed') }
}

const importSchema = z.object({ formats: z.array(z.record(z.string(), z.unknown())).max(500) })

// POST — import (upsert) format definitions from a JSON payload. Counters
// untouched. Importing config is administrator-only (manage_settings).
export async function POST(req: NextRequest) {
  const auth = await requirePermission('system.numbering', 'write', 'manage_settings')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, importSchema)
  if ('error' in parsed) return parsed.error
  if (parsed.data.formats.length === 0) return badRequest('No formats to import')
  try {
    const report = await importFormats(parsed.data.formats)
    await logAction(auth.user, 'import', 'numbering_format', 'bulk', null, { imported: report.imported, updated: report.updated, skipped: report.skipped.length })
    return NextResponse.json(report)
  } catch (e) { return apiError(e, 'Import failed') }
}
