/**
 * Operations snapshot — the real data source for the Operations Center.
 *
 * Replaces the module's former mock numbers with genuine, in-process telemetry:
 * OS/runtime facts, live CPU/memory/disk, a database probe, log-derived request
 * and error rates, backup-engine + scheduler state, a subsystem health matrix,
 * and SRE (SLI/SLO/error-budget) figures. Everything degrades gracefully and
 * never throws; subsystems that are not configured report `offline`/`n/a`
 * honestly rather than faking a value.
 */
import os from 'os'
import { statfs } from 'fs/promises'
import { pgQuery } from '@/lib/db'

export type Health = 'healthy' | 'warning' | 'critical' | 'offline'
export interface Subsystem { name: string; status: Health; detail: string }

function pct(n: number): number { return Math.round(n * 1000) / 10 }

export interface OpsSnapshot {
  infra: {
    hostname: string; platform: string; release: string; arch: string
    node: string; dbVersion: string | null; cpuModel: string; cpuCount: number
    uptimeSec: number; processUptimeSec: number; env: string
  }
  metrics: {
    cpuLoad1: number; cpuLoadPct: number
    memUsedMb: number; memTotalMb: number; memPct: number
    rssMb: number; heapUsedMb: number
    diskUsedPct: number | null; diskFreeGb: number | null; diskTotalGb: number | null
    dbLatencyMs: number | null; dbSizeMb: number | null
    requestsPerMin: number; errorRatePct: number; successRatePct: number
    logs24h: number; errors24h: number
  }
  subsystems: Subsystem[]
  recentErrors: { ts: string; source: string; service: string; message: string }[]
  sre: { availabilityPct: number; sloTarget: number; errorBudgetPct: number; latencyBudgetOk: boolean }
  generatedAt: string
}

export async function opsSnapshot(): Promise<OpsSnapshot> {
  const cpus = os.cpus()
  const load1 = os.loadavg()[0]
  const cpuLoadPct = pct(Math.min(1, cpus.length ? load1 / cpus.length : 0))
  const mem = process.memoryUsage()
  const memTotal = os.totalmem()
  const memFree = os.freemem()
  const memUsed = memTotal - memFree

  // Disk (filesystem backing the working dir).
  let diskUsedPct: number | null = null, diskFreeGb: number | null = null, diskTotalGb: number | null = null
  try {
    const fs = await statfs(process.cwd())
    const total = fs.blocks * fs.bsize, free = fs.bfree * fs.bsize
    diskTotalGb = Math.round(total / 1e9 * 10) / 10
    diskFreeGb = Math.round(free / 1e9 * 10) / 10
    diskUsedPct = total ? pct(1 - free / total) : null
  } catch { /* not available */ }

  // DB probe + size.
  let dbLatencyMs: number | null = null, dbSizeMb: number | null = null, pgVer: string | null = null
  let dbOk = false
  try {
    const t = Date.now(); await pgQuery('SELECT 1'); dbLatencyMs = Date.now() - t; dbOk = true
    const sizeRow = (await pgQuery('SELECT pg_database_size(current_database())::bigint AS bytes'))[0] as { bytes: string } | undefined
    if (sizeRow) dbSizeMb = Math.round(Number(sizeRow.bytes) / 1e6 * 10) / 10
    pgVer = ((await pgQuery('SHOW server_version'))[0] as { server_version: string } | undefined)?.server_version ?? null
  } catch { /* probe failed */ }

  // Log-derived rates.
  let requestsPerMin = 0, logs24h = 0, errors24h = 0
  let recentErrors: OpsSnapshot['recentErrors'] = []
  if (dbOk) {
    const minAgo = new Date(Date.now() - 60_000).toISOString()
    const dayAgo = new Date(Date.now() - 86_400_000).toISOString()
    try {
      requestsPerMin = Number(((await pgQuery(`SELECT count(*) c FROM system_logs WHERE source='http' AND ts>=$1`, [minAgo]))[0] as { c: number }).c)
      logs24h = Number(((await pgQuery(`SELECT count(*) c FROM system_logs WHERE ts>=$1`, [dayAgo]))[0] as { c: number }).c)
      errors24h = Number(((await pgQuery(`SELECT count(*) c FROM system_logs WHERE level='error' AND ts>=$1`, [dayAgo]))[0] as { c: number }).c)
      recentErrors = (await pgQuery(
        `SELECT ts, source, service, message FROM system_logs WHERE level='error' ORDER BY id DESC LIMIT 8`
      ) as OpsSnapshot['recentErrors'])
    } catch { /* logs table not ready */ }
  }
  const errorRatePct = logs24h ? pct(errors24h / logs24h) : 0
  const successRatePct = Math.round((100 - errorRatePct) * 10) / 10

  // Backup + settings-derived config.
  let backupStatus: Health = 'offline', backupDetail = 'no backups yet'
  if (dbOk) {
    try {
      const last = (await pgQuery(`SELECT status, started_at FROM backups ORDER BY started_at DESC LIMIT 1`))[0] as { status: string; started_at: string } | undefined
      if (last) {
        backupStatus = last.status === 'success' ? 'healthy' : last.status === 'started' ? 'warning' : 'critical'
        backupDetail = `last ${last.status} · ${new Date(last.started_at).toLocaleString()}`
      }
    } catch { /* ignore */ }
  }
  const setting = async (key: string): Promise<string | null> => {
    try { return ((await pgQuery(`SELECT value FROM site_settings WHERE key=$1`, [key]))[0] as { value: string } | undefined)?.value ?? null } catch { return null }
  }
  const emailConfigured = !!((await setting('smtp_host')) || process.env.SMTP_HOST)
  const aiConfigured = !!((await setting('ai_api_key')) || (await setting('ai_provider')) || process.env.OPENAI_API_KEY)

  const dbHealth: Health = dbLatencyMs == null ? 'critical' : dbLatencyMs > 200 ? 'warning' : 'healthy'
  const diskHealth: Health = diskUsedPct == null ? 'offline' : diskUsedPct >= 90 ? 'critical' : diskUsedPct >= 80 ? 'warning' : 'healthy'
  const memHealth: Health = memUsed / memTotal >= 0.9 ? 'critical' : memUsed / memTotal >= 0.8 ? 'warning' : 'healthy'

  const subsystems: Subsystem[] = [
    { name: 'Application', status: 'healthy', detail: `up ${Math.round(process.uptime())}s · ${process.env.NODE_ENV}` },
    { name: 'Database', status: dbHealth, detail: dbLatencyMs == null ? 'unreachable' : `SELECT 1 in ${dbLatencyMs}ms` },
    { name: 'Backup Engine', status: backupStatus, detail: backupDetail },
    { name: 'Scheduler', status: process.env.BACKUP_SCHEDULER_DISABLED === '1' ? 'offline' : 'healthy', detail: process.env.BACKUP_SCHEDULER_DISABLED === '1' ? 'disabled' : 'app-level (cron-free)' },
    { name: 'Logging', status: dbOk ? 'healthy' : 'critical', detail: `${logs24h} logs/24h` },
    { name: 'Memory', status: memHealth, detail: `${Math.round(memUsed / 1e6)}/${Math.round(memTotal / 1e6)} MB` },
    { name: 'Storage', status: diskHealth, detail: diskUsedPct == null ? 'n/a' : `${diskUsedPct}% used` },
    { name: 'Email (SMTP)', status: emailConfigured ? 'healthy' : 'offline', detail: emailConfigured ? 'configured' : 'not configured' },
    { name: 'AI Service', status: aiConfigured ? 'healthy' : 'offline', detail: aiConfigured ? 'configured' : 'not configured' },
    { name: 'Cache / Redis', status: 'offline', detail: 'not configured (single-node)' },
    { name: 'Queue / Workers', status: 'offline', detail: 'not configured (in-process)' },
  ]

  // SRE: availability from the share of non-offline critical subsystems being
  // healthy; error budget against a 99.9% SLO / <1% error-rate target.
  const core = subsystems.filter((s) => ['Application', 'Database', 'Backup Engine', 'Scheduler', 'Logging'].includes(s.name))
  const healthyCore = core.filter((s) => s.status === 'healthy').length
  const availabilityPct = Math.round((healthyCore / core.length) * 1000) / 10
  const sloTarget = 99.9
  const errorBudgetPct = Math.max(0, Math.round((1 - errorRatePct / 1) * 1000) / 10) // budget = how much of the 1% error allowance remains

  return {
    infra: {
      hostname: os.hostname(), platform: os.platform(), release: os.release(), arch: os.arch(),
      node: process.version, dbVersion: pgVer, cpuModel: cpus[0]?.model?.trim() ?? 'unknown', cpuCount: cpus.length,
      uptimeSec: Math.round(os.uptime()), processUptimeSec: Math.round(process.uptime()), env: process.env.NODE_ENV ?? 'development',
    },
    metrics: {
      cpuLoad1: Math.round(load1 * 100) / 100, cpuLoadPct,
      memUsedMb: Math.round(memUsed / 1e6), memTotalMb: Math.round(memTotal / 1e6), memPct: pct(memUsed / memTotal),
      rssMb: Math.round(mem.rss / 1e6), heapUsedMb: Math.round(mem.heapUsed / 1e6),
      diskUsedPct, diskFreeGb, diskTotalGb,
      dbLatencyMs, dbSizeMb,
      requestsPerMin, errorRatePct, successRatePct, logs24h, errors24h,
    },
    subsystems,
    recentErrors,
    sre: { availabilityPct, sloTarget, errorBudgetPct, latencyBudgetOk: dbLatencyMs == null ? false : dbLatencyMs < 200 },
    generatedAt: new Date().toISOString(),
  }
}
