#!/usr/bin/env -S npx tsx
/**
 * 26.34 бند۴ — REAL DB-fault-injection rollback proof for the media upload
 * API. Not a unit test against a mocked repository: this spins up a genuine
 * `next start` (production build) server pointed at a THROWAWAY Postgres
 * database, drives the real `/api/admin/media` HTTP endpoint with a real
 * session cookie, and injects an actual database fault (REVOKE on the
 * `media_files` table for the connected role — a real Postgres permission
 * error, not a simulated one) mid-flow. It then asserts, by reading the real
 * filesystem and querying the real database directly:
 *
 *   1. A DB fault during REPLACE never destroys the old (healthy) file —
 *      the new bytes are staged, the swap only happens after the DB write
 *      commits (this script is what caught the original bug: the OLD code
 *      wrote the new bytes directly over the old file's path first, so a
 *      failed DB update caused the cleanup step to delete the only copy of
 *      the file that was left — old AND new both gone).
 *   2. A DB fault during CREATE leaves no orphan file behind (the staged/
 *      written file is unlinked) and no incomplete DB row is created.
 *   3. No `.staging-*` temp file is ever left behind after either fault.
 *   4. A new upload never silently replaces a previously-healthy file when
 *      its own DB write fails.
 *   5. The Persian error response includes both `errorCode` and `requestId`.
 *
 * Usage:
 *   npx tsx scripts/verify-upload-rollback.ts
 *
 * Requires a local Postgres reachable with CREATEDB privilege by the role in
 * DATABASE_URL (defaults to the dev DSN's host/user/password, substituting a
 * throwaway database name). Creates + drops that database; never touches the
 * real dev/prod database referenced by DATABASE_URL itself.
 */
import { spawn, execSync, type ChildProcess } from 'node:child_process'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const PORT = Number(process.env.ROLLBACK_TEST_PORT ?? 3919)
const BASE = `http://127.0.0.1:${PORT}`
const ADMIN_EMAIL = 'admin@habibazar.com'
const ADMIN_PASSWORD = 'RollbackTest#2026!'

let n = 0, failed = 0
const ok = (c: boolean, label: string) => {
  n++
  if (c) console.log(`  ✅ ${n}. ${label}`)
  else { failed++; console.error(`  ❌ ${n}. ${label}`) }
}

function parseDsn(dsn: string) {
  const u = new URL(dsn)
  return {
    user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
    host: u.hostname, port: u.port || '5432', db: u.pathname.replace(/^\//, ''),
  }
}

const baseDsn = process.env.DATABASE_URL || 'postgresql://hbztest:hbztest123@localhost:5432/hbzdev'
const parsed = parseDsn(baseDsn)
const TEST_DB = `hbz_rollback_${Date.now()}`
const TEST_DSN = `postgresql://${parsed.user}:${parsed.password}@${parsed.host}:${parsed.port}/${TEST_DB}`

function psql(db: string, sql: string): string {
  return execSync(
    `PGPASSWORD='${parsed.password}' psql -h ${parsed.host} -p ${parsed.port} -U ${parsed.user} -d ${db} -t -A -c "${sql.replace(/"/g, '\\"')}"`,
    { encoding: 'utf8' },
  ).trim()
}

async function waitForHealth(proc: ChildProcess, timeoutMs = 90_000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (proc.exitCode !== null) throw new Error(`server exited early with code ${proc.exitCode}`)
    try {
      const res = await fetch(`${BASE}/api/health`)
      if (res.ok) return
    } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 500))
  }
  throw new Error('server did not become healthy in time')
}

function crc32(buf: Buffer): number {
  let c: number, crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = (crc ^ buf[i]) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    crc = (crc >>> 8) ^ c
  }
  return crc ^ 0xffffffff
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = crc32(Buffer.concat([typeBuf, data]))
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc >>> 0, 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

/** A minimal but genuinely valid 1x1 PNG (real magic bytes + IHDR/IDAT/IEND),
 *  with a distinguishing tEXt payload so "old" vs "new" content differ in
 *  actual bytes (not just a label) — real magic-byte sniffing still passes. */
function realPngBytes(fill: number): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  const idatData = Buffer.from([0x78, 0x9c, 0x62, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01])
  const text = pngChunk('tEXt', Buffer.from(`fill ${fill}`, 'ascii'))
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), text, pngChunk('IDAT', idatData), pngChunk('IEND', Buffer.alloc(0))])
}

async function login(): Promise<string> {
  const res = await fetch(`${BASE}/api/admin/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  })
  const setCookie = res.headers.get('set-cookie') ?? ''
  const m = setCookie.match(/admin_token=[^;]+/)
  if (!m) throw new Error(`login failed: ${res.status} ${await res.text()}`)
  return m[0]
}

async function upload(cookie: string, opts: {
  bytes: Buffer, category: string, folder: string, mode: string, nameEn: string, nameFa: string,
}) {
  const fd = new FormData()
  fd.set('file', new Blob([new Uint8Array(opts.bytes)], { type: 'image/png' }), 'test.png')
  fd.set('category', opts.category)
  fd.set('folder', opts.folder)
  fd.set('mode', opts.mode)
  fd.set('nameEn', opts.nameEn)
  fd.set('nameFa', opts.nameFa)
  fd.set('altEn', 'alt')
  fd.set('altFa', 'جایگزین')
  const res = await fetch(`${BASE}/api/admin/media`, { method: 'POST', headers: { cookie }, body: fd })
  const json = await res.json().catch(() => null)
  return { status: res.status, json }
}

async function main() {
  console.log(`\n🧪 26.34 бند۴ — upload rollback proof (real Postgres fault injection)\n`)

  if (process.env.SKIP_BUILD !== '1') {
    // This test drives a real `next start`, which serves whatever is
    // already in `.next` — NOT the source on disk. Running against a stale
    // build silently tests old code and produces a false result (this bit
    // once already during development: a real fix looked "broken" only
    // because the server hadn't been rebuilt). Always rebuild unless the
    // caller explicitly opts out (SKIP_BUILD=1, e.g. CI already built).
    console.log('  building (SKIP_BUILD=1 to reuse an existing .next)…')
    execSync('npm run build', { cwd: ROOT, stdio: 'inherit' })
  }

  console.log(`  throwaway DB: ${TEST_DB}`)
  execSync(`PGPASSWORD='${parsed.password}' createdb -h ${parsed.host} -p ${parsed.port} -U ${parsed.user} ${TEST_DB}`)

  let server: ChildProcess | null = null
  let serverLog = ''
  try {
    server = spawn(path.join(ROOT, 'node_modules', '.bin', 'next'), ['start', '-p', String(PORT)], {
      cwd: ROOT,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        DATABASE_URL: TEST_DSN,
        ADMIN_SEED_PASSWORD: ADMIN_PASSWORD,
        BACKUP_SCHEDULER_DISABLED: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true, // own process group, so killing it also kills any child it forks
    })
    server.stdout?.on('data', d => { serverLog += d.toString() })
    server.stderr?.on('data', d => { serverLog += d.toString() })

    await waitForHealth(server)
    console.log('  server up + DB migrated/seeded (via instrumentation.ts)\n')

    const cookie = await login()
    ok(!!cookie, 'logged in with the throwaway-DB seeded admin')

    // ---- Step 1: a healthy CREATE upload (baseline "old, healthy" file) ----
    const uploadRoot = path.join(ROOT, 'public', 'uploads', 'hero-orbit')
    const oldBytes = realPngBytes(1)
    const created = await upload(cookie, {
      bytes: oldBytes, category: 'hero-poster', folder: 'hero-orbit', mode: 'create',
      nameEn: 'Rollback Baseline', nameFa: 'مبنای بازگشت',
    })
    ok(created.status === 200, `baseline create succeeded (got ${created.status})`)
    const filename: string | undefined = created.json?.filename
    ok(!!filename, `baseline response carries a filename (${filename})`)
    const filePath = filename ? path.join(uploadRoot, filename) : ''
    const onDiskBefore = filename && existsSync(filePath) ? readFileSync(filePath) : null
    ok(!!onDiskBefore && onDiskBefore.equals(oldBytes), 'baseline file bytes on disk match what was uploaded')

    const rowBefore = psql(TEST_DB, `select id, filename, size from media_files where filename='${filename}'`)
    ok(rowBefore.includes(filename ?? ' '), 'baseline DB row exists')

    // ---- Step 2: inject a REAL DB fault then attempt REPLACE ----
    // (REVOKE doesn't work here — the connected role is the TABLE OWNER via
    // migration, and Postgres owners bypass GRANT/REVOKE entirely. A NOT
    // VALID CHECK constraint that's always false is enforced on every new
    // INSERT/UPDATE regardless of ownership — a genuine, unavoidable DB
    // fault, not a permissions workaround.)
    psql(TEST_DB, `alter table media_files add constraint ck_rollback_fault check (1=0) not valid`)
    const newBytes = realPngBytes(2)
    const replaceAttempt = await upload(cookie, {
      bytes: newBytes, category: 'hero-poster', folder: 'hero-orbit', mode: 'replace',
      nameEn: 'Rollback Baseline', nameFa: 'مبنای بازگشت',
    })
    ok(replaceAttempt.status === 500, `REPLACE under a DB UPDATE fault returns 500 (got ${replaceAttempt.status})`)
    ok(replaceAttempt.json?.errorCode === 'MEDIA_DATABASE_WRITE_FAILED', `errorCode is MEDIA_DATABASE_WRITE_FAILED (got ${replaceAttempt.json?.errorCode})`)
    ok(typeof replaceAttempt.json?.requestId === 'string' && replaceAttempt.json.requestId.length > 0, `response carries a requestId (${replaceAttempt.json?.requestId})`)
    ok(replaceAttempt.json?.retryable === true, 'response marks the failure as retryable')

    const onDiskAfterFault = filename && existsSync(filePath) ? readFileSync(filePath) : null
    ok(!!onDiskAfterFault && onDiskAfterFault.equals(oldBytes), 'OLD FILE SURVIVED — bytes unchanged after the failed replace (the bug this test targets)')

    const stagingLeftovers = readdirSync(uploadRoot).filter(f => f.startsWith('.staging-'))
    ok(stagingLeftovers.length === 0, `no leftover .staging-* temp files (found: ${stagingLeftovers.join(', ') || 'none'})`)

    const rowAfterFault = psql(TEST_DB, `select size from media_files where filename='${filename}'`)
    ok(rowAfterFault === rowBefore.split('|')[2], 'DB row still reflects the OLD file (no partial/incomplete update committed)')

    // ---- Step 3: clear the fault, confirm the SAME file now replaces cleanly ----
    psql(TEST_DB, `alter table media_files drop constraint ck_rollback_fault`)
    const replaceOk = await upload(cookie, {
      bytes: newBytes, category: 'hero-poster', folder: 'hero-orbit', mode: 'replace',
      nameEn: 'Rollback Baseline', nameFa: 'مبنای بازگشت',
    })
    ok(replaceOk.status === 200, `replace succeeds once the DB fault is cleared (got ${replaceOk.status})`)
    const onDiskFinal = filename && existsSync(filePath) ? readFileSync(filePath) : null
    ok(!!onDiskFinal && onDiskFinal.equals(newBytes), 'a HEALTHY replace really does swap in the new content')

    // ---- Step 4: inject the same DB fault on CREATE, confirm no orphan ----
    psql(TEST_DB, `alter table media_files add constraint ck_rollback_fault check (1=0) not valid`)
    const createAttempt = await upload(cookie, {
      bytes: realPngBytes(3), category: 'hero-poster', folder: 'hero-orbit', mode: 'create',
      nameEn: 'Rollback Orphan Check', nameFa: 'بررسی فایل یتیم',
    })
    ok(createAttempt.status === 500, `CREATE under a DB INSERT fault returns 500 (got ${createAttempt.status})`)
    ok(createAttempt.json?.errorCode === 'MEDIA_DATABASE_WRITE_FAILED', 'create-fault errorCode is MEDIA_DATABASE_WRITE_FAILED')
    ok(typeof createAttempt.json?.requestId === 'string' && createAttempt.json.requestId.length > 0, 'create-fault response carries a requestId')

    const filesNow = readdirSync(uploadRoot)
    const orphan = filesNow.find(f => f.toLowerCase().includes('rollback-orphan-check'))
    ok(!orphan, `no orphan file was left on disk for the failed create (dir: ${filesNow.join(', ')})`)
    const noRowCount = psql(TEST_DB, `select count(*) from media_files where name_en='Rollback Orphan Check'`)
    ok(noRowCount === '0', 'no incomplete DB record was created for the failed create')

    psql(TEST_DB, `alter table media_files drop constraint ck_rollback_fault`)
    const createOk = await upload(cookie, {
      bytes: realPngBytes(4), category: 'hero-poster', folder: 'hero-orbit', mode: 'create',
      nameEn: 'Rollback Orphan Check', nameFa: 'بررسی فایل یتیم',
    })
    ok(createOk.status === 200, `create succeeds once the DB fault is cleared (got ${createOk.status})`)

    if (failed > 0) {
      console.log('\n--- server log tail (failure diagnosis) ---')
      console.log(serverLog.split('\n').slice(-40).join('\n'))
    }
  } finally {
    if (server?.pid) { try { process.kill(-server.pid, 'SIGKILL') } catch { try { server.kill('SIGKILL') } catch { /* already gone */ } } }
    // Give the pool's connections a moment to actually close after SIGKILL,
    // then force-terminate anything still attached before dropping — a
    // throwaway test DB should never linger because of a slow client teardown.
    await new Promise(r => setTimeout(r, 1000))
    try {
      psql('postgres', `select pg_terminate_backend(pid) from pg_stat_activity where datname='${TEST_DB}' and pid <> pg_backend_pid()`)
    } catch { /* best-effort */ }
    try { execSync(`PGPASSWORD='${parsed.password}' dropdb -h ${parsed.host} -p ${parsed.port} -U ${parsed.user} --if-exists ${TEST_DB}`) } catch { /* best-effort cleanup */ }
  }

  console.log(`\n${failed === 0 ? '✅' : '❌'} ${n - failed}/${n} assertions passed\n`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
