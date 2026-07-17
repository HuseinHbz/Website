import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"
const isTableId = (s: string) => /^[a-z0-9:_-]+$/i.test(s) && s.length <= 60

// Per-user column layout (order/width/visibility/pin + density/pageSize) for one
// table. Stored as an opaque JSON blob validated shape-wise by the client engine.
const prefsSchema = z.object({
  columnOrder: z.array(z.string().max(60)).max(200).optional(),
  columnWidths: z.record(z.string(), z.number().min(20).max(2000)).optional(),
  hidden: z.array(z.string().max(60)).max(200).optional(),
  pinned: z.record(z.string(), z.enum(['start', 'end'])).optional(),
  density: z.enum(['comfortable', 'compact']).optional(),
  pageSize: z.number().int().min(5).max(1000).optional(),
  // 26.23: per-user CRM view mode (table / kanban) rides the same prefs blob.
  viewMode: z.enum(['table', 'kanban']).optional(),
}).strict()

const putSchema = z.object({ tableId: z.string().max(60), prefs: prefsSchema })

// GET ?tableId=… → the caller's saved layout for that table (or {}).
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const tableId = req.nextUrl.searchParams.get('tableId') ?? ''
  if (!isTableId(tableId)) return NextResponse.json({ prefs: {} })
  try {
    const r = (await pgQuery<{ prefs: string }>(`SELECT prefs FROM table_prefs WHERE user_id=$1 AND table_id=$2`, [auth.user.id, tableId]))[0]
    let prefs: unknown = {}
    try { prefs = JSON.parse(r?.prefs ?? '{}') } catch { prefs = {} }
    return NextResponse.json({ prefs })
  } catch (e) { return apiError(e, 'Failed to load table prefs') }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, putSchema)
  if ('error' in parsed) return parsed.error
  if (!isTableId(parsed.data.tableId)) return NextResponse.json({ error: 'Invalid tableId' }, { status: 400 })
  try {
    await pgQuery(
      `INSERT INTO table_prefs (user_id, table_id, prefs, updated_at) VALUES ($1,$2,$3,${NOW})
       ON CONFLICT (user_id, table_id) DO UPDATE SET prefs=EXCLUDED.prefs, updated_at=${NOW}`,
      [auth.user.id, parsed.data.tableId, JSON.stringify(parsed.data.prefs)])
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e, 'Failed to save table prefs') }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const tableId = req.nextUrl.searchParams.get('tableId') ?? ''
  if (!isTableId(tableId)) return NextResponse.json({ error: 'Invalid tableId' }, { status: 400 })
  try {
    await pgQuery(`DELETE FROM table_prefs WHERE user_id=$1 AND table_id=$2`, [auth.user.id, tableId])
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e, 'Failed to reset table prefs') }
}
