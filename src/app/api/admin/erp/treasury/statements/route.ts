import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, requirePermission } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { importStatement, listStatementLines } from '@/lib/treasury/bankOpsData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = await requirePermission('erp.treasury', 'read'); if ('error' in auth) return auth.error
  const id = Number(req.nextUrl.searchParams.get('accountId')); if (!id) return NextResponse.json({ error: 'accountId required' }, { status: 400 })
  try { return NextResponse.json({ lines: await listStatementLines(id, req.nextUrl.searchParams.get('status') ?? 'unmatched') }) }
  catch (e) { return apiError(e, 'Failed to load lines') }
}
const schema = z.object({ accountId: z.number().int().positive(), format: z.enum(['csv','excel','mt940','camt053']), content: z.string().min(1).max(2_000_000), mapping: z.object({ date: z.string(), amount: z.string().optional(), debit: z.string().optional(), credit: z.string().optional(), description: z.string().optional(), reference: z.string().optional() }).optional() })
export async function POST(req: NextRequest) {
  const auth = await requirePermission('erp.treasury', 'write', 'edit'); if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema); if ('error' in parsed) return parsed.error
  const d = parsed.data
  try { const r = await importStatement(d.accountId, d.format === 'excel' ? 'csv' : d.format, d.content, auth.user.id, d.mapping); await logAction(auth.user, 'treasury.statement.import', 'bank_statements', r.statementId, null, { imported: r.imported, duplicates: r.duplicates }); return NextResponse.json(r) }
  catch (e) { return apiError(e, 'Import failed') }
}
