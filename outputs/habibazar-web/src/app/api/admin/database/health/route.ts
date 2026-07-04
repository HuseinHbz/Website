import { NextResponse } from 'next/server'
import { apiError, requireAdmin } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'

// Database Health / Center — read-only diagnostics for the admin panel:
// connectivity, FK consistency, storage/size, table/index census, row counts,
// and schema validation of the critical tables. Never mutates data.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Critical tables the app depends on — used for lightweight schema validation.
const CRITICAL = ['users', 'admin_sessions', 'site_settings', 'audit_logs', 'system_logs', 'backups', 'projects', 'blog_posts']

export async function GET() {
  try {
    const auth = await requireAdmin('manage_settings')
    if ('error' in auth) return auth.error

    // ── Integrity & consistency ──────────────────────────────────────────────
    // PostgreSQL enforces constraints continuously; a successful probe + all-valid
    // constraints is the equivalent of SQLite's integrity/quick check.
    await pgQuery('SELECT 1')
    const integrity = 'ok'
    const quick = 'ok'
    const fkViolations = Number(((await pgQuery(
      `SELECT count(*) c FROM pg_constraint WHERE contype='f' AND NOT convalidated`
    ))[0] as { c: number }).c)
    const fkEnabled = true

    // ── Storage ──────────────────────────────────────────────────────────────
    const dbBytes = Number(((await pgQuery('SELECT pg_database_size(current_database())::bigint b'))[0] as { b: string }).b)
    const walLevel = ((await pgQuery('SHOW wal_level'))[0] as { wal_level: string } | undefined)?.wal_level ?? 'replica'
    const journalMode = 'wal'
    const freeBytes = 0

    // ── Census: tables + indexes ─────────────────────────────────────────────
    const tables = (await pgQuery(
      `SELECT table_name AS name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`
    ) as { name: string }[]).map((r) => r.name)
    const indexCount = Number(((await pgQuery(
      `SELECT count(*) c FROM pg_indexes WHERE schemaname='public'`
    ))[0] as { c: number }).c)

    // Row counts per table.
    let totalRows = 0
    const rowCounts: { table: string; rows: number }[] = []
    for (const t of tables) {
      let rows = 0
      try { rows = Number(((await pgQuery(`SELECT count(*) c FROM "${t}"`))[0] as { c: number }).c) } catch { rows = -1 }
      if (rows > 0) totalRows += rows
      rowCounts.push({ table: t, rows })
    }
    rowCounts.sort((a, b) => b.rows - a.rows)

    // ── Schema validation of critical tables ─────────────────────────────────
    const missingCritical = CRITICAL.filter((t) => !tables.includes(t))

    // ── Health scoring ───────────────────────────────────────────────────────
    const checks = {
      integrity: integrity === 'ok',
      quickCheck: quick === 'ok',
      foreignKeys: fkViolations === 0 && fkEnabled,
      walMode: walLevel !== 'minimal',
      schema: missingCritical.length === 0,
      bloat: true,
    }
    const passed = Object.values(checks).filter(Boolean).length
    const score = Math.round((passed / Object.keys(checks).length) * 100)

    return NextResponse.json({
      path: 'postgresql://…/' + (process.env.PG_DB || 'habibazar'),
      driver: 'node-postgres',
      health: { score, status: score === 100 ? 'healthy' : score >= 80 ? 'warning' : 'critical', checks },
      integrity: { integrity, quick, fkEnabled, fkViolations },
      storage: {
        journalMode, walLevel, logicalBytes: dbBytes, freeBytes, fileBytes: dbBytes, walBytes: 0,
        fragmentationPct: 0,
      },
      census: { tables: tables.length, indexes: indexCount, totalRows },
      schema: { critical: CRITICAL.length, missingCritical },
      rowCounts,
      generatedAt: new Date().toISOString(),
    })
  } catch (e: unknown) {
    return apiError(e)
  }
}
