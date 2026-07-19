/**
 * Application-level backup scheduler — the cron-free replacement.
 *
 * Runs entirely inside the Node process (started from instrumentation.ts). A
 * single low-frequency tick evaluates each retention bucket against its cadence
 * using the last successful backup time from the catalog, so restarts never miss
 * or double-fire. Also wires the event-driven triggers:
 *   - data-change: debounced, fired by admin mutations (via audit.logAction)
 *   - fs-change:   debounced, fired by writes under public/uploads
 *
 * Idempotent + guarded so only one scheduler runs per process. Disable entirely
 * with BACKUP_SCHEDULER_DISABLED=1.
 */
import fs from 'fs'
import path from 'path'
import { pgQuery } from '@/lib/db'
import { logBus } from '@/lib/logs/bus'
import { backupEngine, type Bucket } from './engine'

const TICK_MS = 60_000 // evaluate cadences once a minute
const CADENCE_MS: Record<Bucket, number> = {
  hourly: 3_600_000,
  daily: 86_400_000,
  weekly: 604_800_000,
  monthly: 2_592_000_000,
  yearly: 31_536_000_000,
}
const DATA_CHANGE_DEBOUNCE_MS = Number(process.env.BACKUP_DATA_DEBOUNCE_MS || 5 * 60_000)

async function lastSuccess(bucket: Bucket): Promise<number> {
  try {
    const row = (await pgQuery(
      `SELECT max(started_at) t FROM backups WHERE bucket=$1 AND status='success'`,
      [bucket],
    ))[0] as { t: string | null } | undefined
    return row?.t ? new Date(row.t).getTime() : 0
  } catch { return 0 }
}

class Scheduler {
  private timer: NodeJS.Timeout | null = null
  private dataChangeTimer: NodeJS.Timeout | null = null
  private started = false

  start() {
    if (this.started || process.env.BACKUP_SCHEDULER_DISABLED === '1') return
    this.started = true
    logBus.publish({ level: 'info', source: 'backup', service: 'scheduler', message: 'scheduler_started', meta: { tickMs: TICK_MS } })
    // First tick shortly after boot, then on the interval.
    this.timer = setInterval(() => this.tick(), TICK_MS)
    if (this.timer.unref) this.timer.unref()
    setTimeout(() => this.tick(), 15_000)
    this.watchUploads()
  }

  private async tick() {
    if (backupEngine.isRunning) return
    const now = Date.now()
    // Fire the most-granular bucket that is due (one backup per tick).
    const order: Bucket[] = ['yearly', 'monthly', 'weekly', 'daily', 'hourly']
    for (const bucket of order) {
      const last = Math.max(await lastSuccess(bucket), backupEngine.lastRun(bucket))
      if (now - last >= CADENCE_MS[bucket]) {
        void backupEngine.run('scheduled', bucket)
        return
      }
    }
  }

  /** Debounced trigger for DB mutations — coalesces bursts into one backup. */
  notifyDataChange(trigger: 'data-change' | 'fs-change' = 'data-change') {
    if (process.env.BACKUP_SCHEDULER_DISABLED === '1') return
    if (this.dataChangeTimer) clearTimeout(this.dataChangeTimer)
    this.dataChangeTimer = setTimeout(() => {
      if (!backupEngine.isRunning) void backupEngine.run(trigger)
    }, DATA_CHANGE_DEBOUNCE_MS)
    if (this.dataChangeTimer.unref) this.dataChangeTimer.unref()
  }

  private watchUploads() {
    const dir = path.join(process.cwd(), 'public', 'uploads')
    try {
      if (!fs.existsSync(dir)) return
      const watcher = fs.watch(dir, { recursive: true }, () => this.notifyDataChange('fs-change'))
      watcher.on('error', () => {})
    } catch { /* fs.watch recursive not supported everywhere — non-fatal */ }
  }
}

const g = globalThis as unknown as { __hbzScheduler?: Scheduler }
export const scheduler: Scheduler = g.__hbzScheduler ?? (g.__hbzScheduler = new Scheduler())
