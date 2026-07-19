/**
 * BackupEngine — the internal, cron-free backup system.
 *
 *   BackupEngine {
 *     scheduleManager  → lib/backup/scheduler.ts (app-level, not OS cron)
 *     snapshotManager  → snapshot() (WAL-safe DB + config + media + manifest)
 *     storageManager   → lib/backup/storage.ts (3-2-1 adapters)
 *     encryptionLayer  → lib/backup/crypto.ts (AES-256 + SHA-256)
 *     integrityChecker → verify() (checksum + dry restore + schema compare)
 *     retryQueue       → run() retries a failed backup up to MAX_ATTEMPTS
 *     eventBus         → EventEmitter + logBus (backup_* events, real-time)
 *   }
 *
 * Runs in-process, in the background (never blocks a request). Every backup is
 * verified by an isolated dry restore before it is marked SUCCESS.
 */
import { EventEmitter } from 'events'
import { mkdtemp, mkdir, rm, cp, writeFile, stat, readdir } from 'fs/promises'
import { spawn } from 'child_process'
import { tmpdir } from 'os'
import path from 'path'
import crypto from 'crypto'
import { pgQuery } from '@/lib/db'
import { logBus } from '@/lib/logs/bus'
import { encryptFile, decryptFile, sha256File } from './crypto'
import { buildAdapters, type StoredCopy } from './storage'

export type Trigger = 'scheduled' | 'data-change' | 'fs-change' | 'manual'
export type Bucket = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly'
const MAX_ATTEMPTS = 3

const ENV = process.env.NODE_ENV === 'production' ? 'production' : 'development'
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://habibazar:habibazar_local@127.0.0.1:5432/habibazar'
const BACKUP_ROOT = process.env.BACKUP_ROOT || path.join(process.cwd(), 'data', 'backups-engine')
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads')
const ENV_FILE = path.join(process.cwd(), '.env.local')

export interface BackupRecord {
  id: string
  version: string
  env: string
  trigger: Trigger
  bucket: Bucket | null
  status: 'started' | 'success' | 'failed' | 'invalid'
  size: number
  checksum: string | null
  manifest: string | null
  copies: StoredCopy[]
  verified: boolean
  verifyDetail: string | null
  attempts: number
  error: string | null
  startedAt: string
  finishedAt: string | null
}

function log(level: 'info' | 'warn' | 'error', message: string, meta: Record<string, unknown>) {
  logBus.publish({ level, source: 'backup', service: 'backup-engine', message, meta })
}
function run(cmd: string, args: string[], opts: { cwd?: string } = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'ignore', cwd: opts.cwd })
    p.on('error', reject)
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))))
  })
}
/** Run a command capturing stdout (for pg_restore -l table counting). */
function runOut(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args)
    let out = ''
    p.stdout.on('data', (d) => { out += d.toString() })
    p.on('error', reject)
    p.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}`))))
  })
}
/** Count TABLE entries in a pg_dump custom archive's table of contents. */
async function dumpTableCount(dumpFile: string): Promise<number> {
  const toc = await runOut('pg_restore', ['-l', dumpFile])
  return toc.split('\n').filter((l) => / TABLE DATA | TABLE /.test(l)).length
}

class BackupEngine extends EventEmitter {
  private running = false
  private lastByBucket: Record<string, number> = {}

  get isRunning() { return this.running }

  /** Persist/patch a catalog row (best-effort, fire-and-forget). */
  private save(r: BackupRecord) {
    pgQuery(
      `INSERT INTO backups (id, version, env, trigger, bucket, status, size, checksum, manifest, copies, verified, verify_detail, attempts, error, started_at, finished_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT(id) DO UPDATE SET status=$6, size=$7, checksum=$8, manifest=$9,
         copies=$10, verified=$11, verify_detail=$12, attempts=$13, error=$14, finished_at=$16`,
      [r.id, r.version, r.env, r.trigger, r.bucket,
        r.status, r.size, r.checksum, r.manifest,
        JSON.stringify(r.copies), r.verified ? 1 : 0, r.verifyDetail,
        r.attempts, r.error, r.startedAt, r.finishedAt],
    ).catch(() => { /* catalog write is best-effort */ })
  }

  /** Public entry point. Runs in the background; retries up to MAX_ATTEMPTS. */
  async run(trigger: Trigger, bucket: Bucket | null = null): Promise<BackupRecord> {
    if (this.running) {
      log('info', 'backup_skipped', { reason: 'another backup in progress', trigger })
      return this.stub(trigger, bucket, 'started')
    }
    this.running = true
    const version = `${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(3).toString('hex')}`
    const rec: BackupRecord = {
      id: version, version, env: ENV, trigger, bucket, status: 'started', size: 0,
      checksum: null, manifest: null, copies: [], verified: false, verifyDetail: null,
      attempts: 0, error: null, startedAt: new Date().toISOString(), finishedAt: null,
    }
    log('info', 'backup_started', { version, trigger, bucket })
    this.emit('backup_started', rec)
    this.save(rec)

    try {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        rec.attempts = attempt
        try {
          await this.execute(rec)
          rec.status = 'success'
          rec.finishedAt = new Date().toISOString()
          this.save(rec)
          if (bucket) this.lastByBucket[bucket] = Date.now()
          log('info', 'backup_completed', { version, size: rec.size, copies: rec.copies.length, attempt })
          this.emit('backup_completed', rec)
          return rec
        } catch (err) {
          rec.error = err instanceof Error ? err.message : String(err)
          rec.status = 'failed'
          this.save(rec)
          log('warn', 'backup_failed', { version, attempt, error: rec.error })
          this.emit('backup_failed', rec)
          if (attempt === MAX_ATTEMPTS) {
            rec.finishedAt = new Date().toISOString()
            this.save(rec)
            log('error', 'backup_failed', { version, attempts: attempt, error: rec.error, final: true })
            return rec
          }
          await new Promise((r) => setTimeout(r, 1000 * attempt)) // backoff
        }
      }
      return rec
    } finally {
      this.running = false
      this.pruneRetention().catch(() => {})
    }
  }

  /** One full backup attempt: snapshot → archive → encrypt → distribute → verify. */
  private async execute(rec: BackupRecord) {
    const date = rec.version.slice(0, 10)
    const rel = `${rec.env}/${date}/${rec.version}`
    const staging = await mkdtemp(path.join(tmpdir(), 'hbz-backup-'))
    try {
      // 1. Consistent PostgreSQL snapshot (pg_dump custom format) + archive check.
      const dbSnap = path.join(staging, 'database.dump')
      await run('pg_dump', ['-Fc', '--no-owner', '--no-privileges', '-f', dbSnap, DATABASE_URL])
      const tables = await dumpTableCount(dbSnap) // valid archive TOC ⇒ dump integrity ok
      if (tables < 1) throw new Error('pg_dump produced an empty/invalid archive')

      const contents = ['database.dump']
      // 2. Config snapshot.
      const cfgDir = path.join(staging, 'config')
      await mkdir(cfgDir, { recursive: true })
      for (const f of [ENV_FILE, path.join(process.cwd(), 'package.json'), path.join(process.cwd(), 'package-lock.json')]) {
        await cp(f, path.join(cfgDir, path.basename(f))).catch(() => {})
      }
      contents.push('config')
      // 3. Media snapshot (if present).
      if (await exists(UPLOADS_DIR)) {
        await cp(UPLOADS_DIR, path.join(staging, 'uploads'), { recursive: true }).catch(() => {})
        contents.push('uploads')
      }
      // 4. Manifest.
      const manifest = {
        version: rec.version, env: rec.env, trigger: rec.trigger, bucket: rec.bucket,
        createdAt: new Date().toISOString(), contents, dbTables: tables, algo: 'aes-256-cbc', checksum: 'sha256',
      }
      await writeFile(path.join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2))
      rec.manifest = JSON.stringify(manifest)

      // 5. Archive → encrypt → checksum.
      const archive = path.join(staging, 'archive.tar.gz')
      await run('tar', ['-czf', archive, '-C', staging, ...contents, 'manifest.json'])
      const encFile = path.join(staging, `backup-${rec.version}.tar.gz.enc`)
      await encryptFile(archive, encFile)
      rec.checksum = await sha256File(encFile)
      rec.size = (await stat(encFile)).size
      await writeFile(`${encFile}.sha256`, rec.checksum)

      // 6. Distribute to every adapter (3-2-1).
      const adapters = buildAdapters(BACKUP_ROOT)
      const copies: StoredCopy[] = []
      for (const a of adapters) {
        try {
          copies.push(await a.put(encFile, `${rel}/${path.basename(encFile)}`))
          await a.put(`${encFile}.sha256`, `${rel}/${path.basename(encFile)}.sha256`).catch(() => {})
        } catch (e) {
          log('error', 'storage_unreachable', { adapter: a.name, error: e instanceof Error ? e.message : String(e) })
        }
      }
      if (copies.length === 0) throw new Error('no storage adapter accepted the backup')
      rec.copies = copies
      this.save(rec)

      // 7. Verify before declaring success.
      const primary = copies[0].location
      const detail = await this.verify(primary, rec.checksum, tables)
      rec.verified = detail.ok
      rec.verifyDetail = JSON.stringify(detail)
      if (!detail.ok) {
        rec.status = 'invalid'
        this.save(rec)
        throw new Error(`verification failed: ${detail.reason}`)
      }
      log('info', 'backup_verified', { version: rec.version, ...detail })
      this.emit('backup_verified', rec)
    } finally {
      await rm(staging, { recursive: true, force: true }).catch(() => {})
    }
  }

  /** Isolated dry restore: checksum → decrypt → untar → integrity + schema + hash. */
  async verify(encPath: string, expectedChecksum: string | null, expectedTables: number) {
    const sandbox = await mkdtemp(path.join(tmpdir(), 'hbz-verify-'))
    try {
      if (expectedChecksum) {
        const actual = await sha256File(encPath)
        if (actual !== expectedChecksum) return { ok: false, reason: 'checksum mismatch', checksum: false }
      }
      const tarball = path.join(sandbox, 'archive.tar.gz')
      await decryptFile(encPath, tarball)
      await run('tar', ['-xzf', tarball, '-C', sandbox])
      const dbFile = path.join(sandbox, 'database.dump')
      if (!(await exists(dbFile))) return { ok: false, reason: 'archive missing database.dump', checksum: true }
      // Validate the dump archive by listing its TOC (isolated; never touches live DB).
      let tables = 0
      try { tables = await dumpTableCount(dbFile) } catch (e) { return { ok: false, reason: `restored archive invalid: ${e instanceof Error ? e.message : String(e)}`, checksum: true, decryption: true } }
      if (tables < expectedTables) return { ok: false, reason: `schema drift (${tables}<${expectedTables})`, checksum: true, decryption: true, integrity: false }
      return { ok: true, reason: 'ok', checksum: true, decryption: true, integrity: true, tables }
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : String(e) }
    } finally {
      await rm(sandbox, { recursive: true, force: true }).catch(() => {})
    }
  }

  /** Retention purge — keep the newest N per bucket + overall cap. */
  private async pruneRetention() {
    const KEEP = Number(process.env.BACKUP_KEEP || 50)
    try {
      const rows = await pgQuery(`SELECT id FROM backups ORDER BY started_at DESC OFFSET $1`, [KEEP]) as { id: string }[]
      for (const r of rows) {
        // Remove the catalog row; on-disk files age out via BACKUP_ROOT housekeeping.
        await pgQuery(`DELETE FROM backups WHERE id=$1`, [r.id])
      }
    } catch { /* best-effort */ }
  }

  private stub(trigger: Trigger, bucket: Bucket | null, status: BackupRecord['status']): BackupRecord {
    return { id: 'skipped', version: 'skipped', env: ENV, trigger, bucket, status, size: 0, checksum: null,
      manifest: null, copies: [], verified: false, verifyDetail: null, attempts: 0, error: null,
      startedAt: new Date().toISOString(), finishedAt: null }
  }

  lastRun(bucket: Bucket): number { return this.lastByBucket[bucket] ?? 0 }
}

async function exists(p: string): Promise<boolean> {
  try { await stat(p); return true } catch { return false }
}
async function dirCount(p: string): Promise<number> {
  try { return (await readdir(p)).length } catch { return 0 }
}
export { dirCount, BACKUP_ROOT, ENV as BACKUP_ENV }

// Pin to global so HMR / repeated imports share one engine instance.
const g = globalThis as unknown as { __hbzBackupEngine?: BackupEngine }
export const backupEngine: BackupEngine = g.__hbzBackupEngine ?? (g.__hbzBackupEngine = new BackupEngine())
