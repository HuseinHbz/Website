import { NextResponse } from 'next/server'
import type Database from 'better-sqlite3'
import { apiError, requireAdmin } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { backupEngine, BACKUP_ROOT, BACKUP_ENV } from '@/lib/backup/engine'
import { usingDedicatedKey } from '@/lib/backup/crypto'

// Status of the internal BackupEngine: catalog, 3-2-1 posture, verification and
// live alerts — for the Backup section of the admin panel.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function client(): Database.Database {
  return (getDb() as unknown as { $client: Database.Database }).$client
}

interface CatalogRow {
  id: string; version: string; trigger: string; bucket: string | null; status: string
  size: number; checksum: string | null; verified: number; verify_detail: string | null
  attempts: number; error: string | null; started_at: string; finished_at: string | null; copies: string | null
}

export async function GET() {
  try {
    const auth = await requireAdmin('manage_settings')
    if ('error' in auth) return auth.error
    const db = client()

    const catalog = db.prepare(
      `SELECT id, version, trigger, bucket, status, size, checksum, verified, verify_detail,
              attempts, error, started_at, finished_at, copies
       FROM backups ORDER BY started_at DESC LIMIT 50`
    ).all() as CatalogRow[]

    const latest = catalog[0] ?? null
    const totals = db.prepare(
      `SELECT count(*) total, coalesce(sum(size),0) size,
              sum(CASE WHEN status='success' THEN 1 ELSE 0 END) ok,
              sum(CASE WHEN status IN ('failed','invalid') THEN 1 ELSE 0 END) failed,
              sum(CASE WHEN verified=1 THEN 1 ELSE 0 END) verified
       FROM backups`
    ).get() as { total: number; size: number; ok: number; failed: number; verified: number }

    // 3-2-1 posture from configured adapters + the latest backup's copies.
    const mirror = !!process.env.BACKUP_MIRROR_DIR
    const offsite = !!process.env.BACKUP_REMOTE
    const latestCopies = latest?.copies ? (JSON.parse(latest.copies) as { kind: string }[]) : []
    const storageTypes = 1 + (mirror ? 1 : 0) + (offsite ? 1 : 0)
    const rule321Met = (latestCopies.length >= 3 || totals.ok >= 3) && offsite && storageTypes >= 2

    // Live alerts from the log stream (last 24h).
    const since = new Date(Date.now() - 86_400_000).toISOString()
    const alertRows = db.prepare(
      `SELECT message, count(*) count, max(ts) lastTs, level FROM system_logs
       WHERE ts >= ? AND (
         (source='backup' AND level IN ('warn','error')) OR
         (source='system' AND level='error') OR
         message LIKE '%storage_unreachable%'
       ) GROUP BY message ORDER BY lastTs DESC LIMIT 20`
    ).all(since) as { message: string; count: number; lastTs: string; level: string }[]

    const dbErrors = (db.prepare(
      `SELECT count(*) c FROM system_logs WHERE ts >= ? AND level='error' AND (message LIKE '%database%' OR message LIKE '%SQLITE%' OR service='db')`
    ).get(since) as { c: number }).c

    const alerts: { level: string; message: string; count: number; at: string }[] = alertRows.map((a) => ({
      level: a.level === 'error' ? 'critical' : 'warning', message: a.message, count: a.count, at: a.lastTs,
    }))
    if (dbErrors >= 5) alerts.unshift({ level: 'critical', message: `Repeated database errors (${dbErrors} in 24h)`, count: dbErrors, at: new Date().toISOString() })

    return NextResponse.json({
      root: BACKUP_ROOT,
      env: BACKUP_ENV,
      running: backupEngine.isRunning,
      encryption: { algo: 'AES-256', dedicatedKey: usingDedicatedKey() },
      strategy: {
        storageTypes, mirror, offsite, rule321Met,
        copiesLatest: latestCopies.length,
        adapters: ['local', ...(mirror ? ['mirror'] : []), ...(offsite ? ['offsite'] : [])],
      },
      totals,
      latest,
      catalog,
      alerts,
      generatedAt: new Date().toISOString(),
    })
  } catch (e: unknown) {
    return apiError(e)
  }
}
