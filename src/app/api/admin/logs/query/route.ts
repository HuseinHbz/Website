import { NextRequest, NextResponse } from 'next/server'
import { apiError, requirePermission } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'

// Historical log query for the Logs & Monitoring module: filter by level /
// source / service / date range, full-text-ish search, pagination, and optional
// error grouping (deduplication by fingerprint).
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Rewrite sequential '?' placeholders to positional pg '$n'.
function toPg(sql: string): string { let i = 0; return sql.replace(/\?/g, () => `$${++i}`) }

interface Filters { level?: string; source?: string; service?: string; q?: string; from?: string; to?: string }

function where(f: Filters): { sql: string; params: unknown[] } {
  const clauses: string[] = []
  const params: unknown[] = []
  if (f.level && f.level !== 'all') { clauses.push('level = ?'); params.push(f.level) }
  if (f.source && f.source !== 'all') { clauses.push('source = ?'); params.push(f.source) }
  if (f.service && f.service !== 'all') { clauses.push('service = ?'); params.push(f.service) }
  if (f.q) { clauses.push('(message ILIKE ? OR stacktrace ILIKE ?)'); params.push(`%${f.q}%`, `%${f.q}%`) }
  if (f.from) { clauses.push('ts >= ?'); params.push(f.from) }
  if (f.to) { clauses.push('ts <= ?'); params.push(f.to) }
  return { sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission('operations.logs-monitoring', 'read', 'manage_settings')
    if ('error' in auth) return auth.error
    const sp = req.nextUrl.searchParams
    const f: Filters = {
      level: sp.get('level') ?? undefined, source: sp.get('source') ?? undefined,
      service: sp.get('service') ?? undefined, q: sp.get('q') ?? undefined,
      from: sp.get('from') ?? undefined, to: sp.get('to') ?? undefined,
    }
    const limit = Math.min(Math.max(Number(sp.get('limit')) || 200, 1), 1000)
    const offset = Math.max(Number(sp.get('offset')) || 0, 0)
    const w = where(f)

    if (sp.get('group') === '1') {
      // Error grouping: dedupe by fingerprint, most frequent first.
      // PostgreSQL requires non-aggregated selected columns to be grouped or
      // aggregated (SQLite allowed bare columns) — aggregate level/source/service.
      const groups = await pgQuery(
        toPg(`SELECT fingerprint, max(level) level, max(source) source, max(service) service, count(*) count, max(ts) lastTs, max(message) message
         FROM system_logs ${w.sql} GROUP BY fingerprint ORDER BY count DESC LIMIT ?`),
        [...w.params, limit],
      )
      return NextResponse.json({ groups })
    }

    const total = Number(((await pgQuery(toPg(`SELECT count(*) c FROM system_logs ${w.sql}`), w.params))[0] as { c: number }).c)
    const rows = await pgQuery(
      toPg(`SELECT id, ts, level, source, service, message, stacktrace, request_id AS "requestId", user_id AS "userId", fingerprint, meta
       FROM system_logs ${w.sql} ORDER BY id DESC LIMIT ? OFFSET ?`),
      [...w.params, limit, offset],
    ) as Record<string, unknown>[]

    const sources = (await pgQuery(`SELECT DISTINCT source FROM system_logs WHERE source IS NOT NULL`) as { source: string }[]).map((r) => r.source)
    const services = (await pgQuery(`SELECT DISTINCT service FROM system_logs WHERE service IS NOT NULL`) as { service: string }[]).map((r) => r.service)
    return NextResponse.json({ entries: rows, total, limit, offset, facets: { sources, services } })
  } catch (e: unknown) {
    return apiError(e)
  }
}
