import { NextRequest, NextResponse } from 'next/server'
import { apiError, badRequest, requireAdmin } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'

// Export filtered logs as JSON or CSV for the Logs & Monitoring module.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function toPg(sql: string): string { let i = 0; return sql.replace(/\?/g, () => `$${++i}`) }

const COLS = ['ts', 'level', 'source', 'service', 'message', 'stacktrace', 'request_id', 'user_id'] as const

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin('manage_settings')
    if ('error' in auth) return auth.error
    const sp = req.nextUrl.searchParams
    const format = (sp.get('format') || 'json').toLowerCase()
    if (format !== 'json' && format !== 'csv') return badRequest('format must be json or csv')

    const clauses: string[] = []
    const params: unknown[] = []
    const add = (key: string, col: string) => { const v = sp.get(key); if (v && v !== 'all') { clauses.push(`${col} = ?`); params.push(v) } }
    add('level', 'level'); add('source', 'source'); add('service', 'service')
    const q = sp.get('q'); if (q) { clauses.push('(message LIKE ? OR stacktrace LIKE ?)'); params.push(`%${q}%`, `%${q}%`) }
    const from = sp.get('from'); if (from) { clauses.push('ts >= ?'); params.push(from) }
    const to = sp.get('to'); if (to) { clauses.push('ts <= ?'); params.push(to) }
    const w = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

    const rows = await pgQuery(
      toPg(`SELECT ${COLS.join(', ')} FROM system_logs ${w} ORDER BY id DESC LIMIT 50000`),
      params,
    ) as Record<string, unknown>[]

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    if (format === 'csv') {
      const header = COLS.join(',')
      const body = rows.map((r) => COLS.map((c) => csvCell(r[c])).join(',')).join('\n')
      return new NextResponse(`${header}\n${body}\n`, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="hbz-logs-${stamp}.csv"`,
        },
      })
    }
    return new NextResponse(JSON.stringify(rows, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="hbz-logs-${stamp}.json"`,
      },
    })
  } catch (e: unknown) {
    return apiError(e)
  }
}
