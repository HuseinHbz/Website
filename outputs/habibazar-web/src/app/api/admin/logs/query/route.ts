import { NextRequest, NextResponse } from 'next/server'
import type Database from 'better-sqlite3'
import { apiError, requireAdmin } from '@/lib/api/respond'
import { getDb } from '@/lib/db'

// Historical log query for the Logs & Monitoring module: filter by level /
// source / service / date range, full-text-ish search, pagination, and optional
// error grouping (deduplication by fingerprint).
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function client(): Database.Database {
  return (getDb() as unknown as { $client: Database.Database }).$client
}

interface Filters { level?: string; source?: string; service?: string; q?: string; from?: string; to?: string }

function where(f: Filters): { sql: string; params: unknown[] } {
  const clauses: string[] = []
  const params: unknown[] = []
  if (f.level && f.level !== 'all') { clauses.push('level = ?'); params.push(f.level) }
  if (f.source && f.source !== 'all') { clauses.push('source = ?'); params.push(f.source) }
  if (f.service && f.service !== 'all') { clauses.push('service = ?'); params.push(f.service) }
  if (f.q) { clauses.push('(message LIKE ? OR stacktrace LIKE ?)'); params.push(`%${f.q}%`, `%${f.q}%`) }
  if (f.from) { clauses.push('ts >= ?'); params.push(f.from) }
  if (f.to) { clauses.push('ts <= ?'); params.push(f.to) }
  return { sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin('manage_settings')
    if ('error' in auth) return auth.error
    const sp = req.nextUrl.searchParams
    const f: Filters = {
      level: sp.get('level') ?? undefined, source: sp.get('source') ?? undefined,
      service: sp.get('service') ?? undefined, q: sp.get('q') ?? undefined,
      from: sp.get('from') ?? undefined, to: sp.get('to') ?? undefined,
    }
    const limit = Math.min(Math.max(Number(sp.get('limit')) || 200, 1), 1000)
    const offset = Math.max(Number(sp.get('offset')) || 0, 0)
    const db = client()
    const w = where(f)

    if (sp.get('group') === '1') {
      // Error grouping: dedupe by fingerprint, most frequent first.
      const groups = db.prepare(
        `SELECT fingerprint, level, source, service, count(*) count, max(ts) lastTs, max(message) message
         FROM system_logs ${w.sql} GROUP BY fingerprint ORDER BY count DESC LIMIT ?`
      ).all(...w.params, limit)
      return NextResponse.json({ groups })
    }

    const total = (db.prepare(`SELECT count(*) c FROM system_logs ${w.sql}`).get(...w.params) as { c: number }).c
    const rows = db.prepare(
      `SELECT id, ts, level, source, service, message, stacktrace, request_id AS requestId, user_id AS userId, fingerprint, meta
       FROM system_logs ${w.sql} ORDER BY id DESC LIMIT ? OFFSET ?`
    ).all(...w.params, limit, offset) as Record<string, unknown>[]

    const sources = (db.prepare(`SELECT DISTINCT source FROM system_logs WHERE source IS NOT NULL`).all() as { source: string }[]).map((r) => r.source)
    const services = (db.prepare(`SELECT DISTINCT service FROM system_logs WHERE service IS NOT NULL`).all() as { service: string }[]).map((r) => r.service)
    return NextResponse.json({ entries: rows, total, limit, offset, facets: { sources, services } })
  } catch (e: unknown) {
    return apiError(e)
  }
}
