import { NextResponse } from 'next/server'
import type Database from 'better-sqlite3'
import { stat } from 'fs/promises'
import path from 'path'
import { apiError, requireAdmin } from '@/lib/api/respond'
import { getDb } from '@/lib/db'

// Database Health / Center — read-only diagnostics for the admin panel:
// integrity, FK consistency, WAL/journal, size & free pages, table/index census,
// row counts, and schema validation of the critical tables. Never mutates data.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'habibazar.db')

// Critical tables the app depends on — used for lightweight schema validation.
const CRITICAL = ['users', 'admin_sessions', 'site_settings', 'audit_logs', 'system_logs', 'backups', 'projects', 'blog_posts']

function client(): Database.Database {
  return (getDb() as unknown as { $client: Database.Database }).$client
}
async function sizeOf(p: string): Promise<number> {
  try { return (await stat(p)).size } catch { return 0 }
}

export async function GET() {
  try {
    const auth = await requireAdmin('manage_settings')
    if ('error' in auth) return auth.error
    const db = client()

    // ── Integrity & consistency ──────────────────────────────────────────────
    const integrity = db.pragma('integrity_check', { simple: true }) as string
    const quick = db.pragma('quick_check', { simple: true }) as string
    const fkViolations = (db.pragma('foreign_key_check') as unknown[]).length
    const fkEnabled = (db.pragma('foreign_keys', { simple: true }) as number) === 1

    // ── Storage / WAL ────────────────────────────────────────────────────────
    const pageSize = db.pragma('page_size', { simple: true }) as number
    const pageCount = db.pragma('page_count', { simple: true }) as number
    const freelist = db.pragma('freelist_count', { simple: true }) as number
    const journalMode = db.pragma('journal_mode', { simple: true }) as string
    const dbBytes = pageSize * pageCount
    const freeBytes = pageSize * freelist
    const fileBytes = await sizeOf(DB_PATH)
    const walBytes = await sizeOf(`${DB_PATH}-wal`)

    // ── Census: tables + indexes ─────────────────────────────────────────────
    const tables = (db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
    ).all() as { name: string }[]).map((r) => r.name)
    const indexCount = (db.prepare(
      `SELECT count(*) c FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'`
    ).get() as { c: number }).c

    // Row counts per table (cheap COUNT(*) — SQLite is fast on local file).
    let totalRows = 0
    const rowCounts = tables.map((t) => {
      let rows = 0
      try { rows = (db.prepare(`SELECT count(*) c FROM "${t}"`).get() as { c: number }).c } catch { rows = -1 }
      if (rows > 0) totalRows += rows
      return { table: t, rows }
    }).sort((a, b) => b.rows - a.rows)

    // ── Schema validation of critical tables ─────────────────────────────────
    const missingCritical = CRITICAL.filter((t) => !tables.includes(t))

    // ── Health scoring ───────────────────────────────────────────────────────
    const checks = {
      integrity: integrity === 'ok',
      quickCheck: quick === 'ok',
      foreignKeys: fkViolations === 0 && fkEnabled,
      walMode: journalMode.toLowerCase() === 'wal',
      schema: missingCritical.length === 0,
      bloat: dbBytes === 0 ? true : freeBytes / dbBytes < 0.25, // <25% free pages
    }
    const passed = Object.values(checks).filter(Boolean).length
    const score = Math.round((passed / Object.keys(checks).length) * 100)

    return NextResponse.json({
      path: DB_PATH,
      driver: 'better-sqlite3',
      health: { score, status: score === 100 ? 'healthy' : score >= 80 ? 'warning' : 'critical', checks },
      integrity: { integrity, quick, fkEnabled, fkViolations },
      storage: {
        journalMode, pageSize, pageCount, freelistPages: freelist,
        logicalBytes: dbBytes, freeBytes, fileBytes, walBytes,
        fragmentationPct: dbBytes ? Math.round((freeBytes / dbBytes) * 1000) / 10 : 0,
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
