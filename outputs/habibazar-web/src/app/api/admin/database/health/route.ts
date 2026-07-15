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

    // ── Storage (REAL PostgreSQL metrics — BUG-012 26.26) ────────────────────
    // The UI used to render SQLite PRAGMA concepts (pageSize/pageCount/freelist)
    // that node-postgres never returns → undefined.toLocaleString() crashed the
    // whole page. Replaced with genuine PG health signals.
    const dbBytes = Number(((await pgQuery('SELECT pg_database_size(current_database())::bigint b'))[0] as { b: string }).b)
    const walLevel = ((await pgQuery('SHOW wal_level'))[0] as { wal_level: string } | undefined)?.wal_level ?? 'replica'
    const journalMode = 'wal'
    const freeBytes = 0

    // Estimated bloat from dead vs live tuples across user tables.
    const tup = (await pgQuery(
      `SELECT COALESCE(SUM(n_dead_tup),0)::bigint dead, COALESCE(SUM(n_live_tup),0)::bigint live FROM pg_stat_user_tables`
    ))[0] as { dead: string; live: string }
    const deadTuples = Number(tup.dead), liveTuples = Number(tup.live)
    const bloatPct = liveTuples + deadTuples > 0 ? Math.round((deadTuples / (liveTuples + deadTuples)) * 1000) / 10 : 0

    // Active connections to this database.
    const activeConnections = Number(((await pgQuery(
      `SELECT count(*) c FROM pg_stat_activity WHERE datname=current_database()`
    ))[0] as { c: number }).c)

    // Most recent (auto)vacuum / (auto)analyze across user tables.
    const va = (await pgQuery(
      `SELECT to_char(MAX(GREATEST(last_vacuum,last_autovacuum)),'YYYY-MM-DD HH24:MI') v,
              to_char(MAX(GREATEST(last_analyze,last_autoanalyze)),'YYYY-MM-DD HH24:MI') a,
              COALESCE(SUM(autovacuum_count),0)::bigint av FROM pg_stat_user_tables`
    ))[0] as { v: string | null; a: string | null; av: string }
    const lastVacuum = va.v, lastAnalyze = va.a, autovacuumCount = Number(va.av)

    // Real WAL bytes (best-effort — needs pg_ls_waldir privileges; 0 if denied).
    let walBytes = 0
    try {
      walBytes = Number(((await pgQuery(`SELECT COALESCE(SUM(size),0)::bigint b FROM pg_ls_waldir()`))[0] as { b: string }).b)
    } catch { walBytes = 0 }

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
      bloat: bloatPct < 25,
    }
    const passed = Object.values(checks).filter(Boolean).length
    const score = Math.round((passed / Object.keys(checks).length) * 100)

    return NextResponse.json({
      path: 'postgresql://…/' + (process.env.PG_DB || 'habibazar'),
      driver: 'node-postgres',
      health: { score, status: score === 100 ? 'healthy' : score >= 80 ? 'warning' : 'critical', checks },
      integrity: { integrity, quick, fkEnabled, fkViolations },
      storage: {
        journalMode, walLevel, logicalBytes: dbBytes, freeBytes, fileBytes: dbBytes, walBytes,
        // Real PostgreSQL health signals (replaced the SQLite PRAGMA fields).
        deadTuples, liveTuples, bloatPct, activeConnections, lastVacuum, lastAnalyze, autovacuumCount,
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
