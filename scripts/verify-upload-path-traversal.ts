#!/usr/bin/env -S npx tsx
/**
 * 26.34 бند۵ — REAL, API-level Path Traversal proof for `/api/admin/media`.
 *
 * `src/lib/media/__tests__/uploadPath.test.ts` proves the pure helper
 * (`resolveUploadDir`) rejects every attack payload — but that only proves
 * the helper is correct in isolation, not that the actual HTTP route calls
 * it correctly, on every code path, before anything unsafe happens. This
 * script drives the real, running `/api/admin/media` endpoint with a real
 * session cookie across all FOUR ways `folder` reaches the server:
 *
 *   1. CREATE  (mode=create, a Hero category)      — the common path
 *   2. RENAME  (mode=rename, a Hero category)       — same validation path
 *      as create (the route has no special "rename" branch — a distinct
 *      mode value that still must reject a bad folder identically)
 *   3. REPLACE (mode=replace, a Hero category)       — must reject BEFORE
 *      even considering the (non-existent, since a bad folder never has a
 *      real conflict row) replace target
 *   4. LEGACY  (no `category`, the non-Hero upload path used by avatars/
 *      blog/clients/…) — a structurally different branch in the route,
 *      must independently reject too
 *
 * For every payload × every mode, asserts:
 *   - HTTP 400 with errorCode MEDIA_INVALID_FOLDER
 *   - No new file appears ANYWHERE under public/ (recursive scan diff)
 *   - No new `media_files` row was inserted
 *
 * Then proves the allowlisted folders still work end-to-end (a security
 * fix that also silently broke real uploads would be its own regression).
 *
 * Usage: npx tsx scripts/verify-upload-path-traversal.ts
 */
import { spawn, execSync, type ChildProcess } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const PORT = Number(process.env.TRAVERSAL_TEST_PORT ?? 3931)
const BASE = `http://127.0.0.1:${PORT}`
const ADMIN_EMAIL = 'admin@habibazar.com'
const ADMIN_PASSWORD = 'TraversalTest#2026!'

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
const TEST_DB = `hbz_traversal_${Date.now()}`
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

/** Every file under public/, recursively — used as a before/after diff so a
 *  traversal payload that escapes to some OTHER real directory is caught
 *  too, not just "did public/uploads/<folder> gain a file". */
function snapshotPublicFiles(): Set<string> {
  const out = new Set<string>()
  const publicRoot = path.join(ROOT, 'public')
  const walk = (dir: string) => {
    let entries: string[] = []
    try { entries = readdirSync(dir) } catch { return }
    for (const e of entries) {
      const full = path.join(dir, e)
      let st
      try { st = statSync(full) } catch { continue }
      if (st.isDirectory()) walk(full)
      else out.add(full)
    }
  }
  walk(publicRoot)
  return out
}

function realPngBytes(): Buffer {
  function crc32(buf: Buffer): number {
    let c: number, crc = 0xffffffff
    for (let i = 0; i < buf.length; i++) {
      c = (crc ^ buf[i]) & 0xff
      for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
      crc = (crc >>> 8) ^ c
    }
    return crc ^ 0xffffffff
  }
  function chunk(type: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
    const typeBuf = Buffer.from(type, 'ascii')
    const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0, 0)
    return Buffer.concat([len, typeBuf, data, crcBuf])
  }
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  const idatData = Buffer.from([0x78, 0x9c, 0x62, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01])
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idatData), chunk('IEND', Buffer.alloc(0))])
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

async function upload(cookie: string, folder: string, opts: { category?: string, mode: string, nameEn?: string, nameFa?: string }) {
  const fd = new FormData()
  fd.set('file', new Blob([new Uint8Array(realPngBytes())], { type: 'image/png' }), 'test.png')
  fd.set('folder', folder)
  fd.set('mode', opts.mode)
  if (opts.category) fd.set('category', opts.category)
  if (opts.nameEn) fd.set('nameEn', opts.nameEn)
  if (opts.nameFa) fd.set('nameFa', opts.nameFa)
  fd.set('altEn', 'alt'); fd.set('altFa', 'جایگزین')
  const res = await fetch(`${BASE}/api/admin/media`, { method: 'POST', headers: { cookie }, body: fd })
  const json = await res.json().catch(() => null)
  return { status: res.status, json }
}

// A representative subset of the full attack matrix from the security
// review (26.34) — the FULL matrix (21 payloads) is already exhaustively
// proven against the pure helper in uploadPath.test.ts; this script's job
// is to prove the ROUTE actually calls that guard on every surface
// (create/rename/replace/legacy), not to re-run every payload variant a
// second time. Kept small deliberately: the real `/api/admin/media` route
// is behind a real 20-req/min rate limiter (26.34 бند۷) that must stay ON
// even for this test (it's the exact thing бند۷ added — this script must
// prove the guard under REALISTIC conditions, not with rate limiting
// disabled), and 4 payloads × 4 modes + 2 legit-folder checks fits in one
// window. Covers: classic relative traversal, an absolute path, URL-encoded
// traversal, and a prefix-based bypass attempt (the class a naive
// `folder.startsWith('profile')` check would miss).
const ATTACKS = ['../../../etc', '/etc/passwd', '%2e%2e%2f', 'profile/../../../etc']

type UploadMode = { label: string, category?: string, mode: string }
const MODES: UploadMode[] = [
  { label: 'CREATE (hero category)', category: 'hero-poster', mode: 'create' },
  { label: 'RENAME (hero category)', category: 'hero-poster', mode: 'rename' },
  { label: 'REPLACE (hero category)', category: 'hero-poster', mode: 'replace' },
  { label: 'LEGACY (no category)', mode: 'create' },
]

async function main() {
  console.log(`\n🧪 26.34 бند۵ — real API-level Path Traversal proof (create/rename/replace/legacy)\n`)

  if (process.env.SKIP_BUILD !== '1') {
    console.log('  building (SKIP_BUILD=1 to reuse an existing .next)…')
    execSync('npm run build', { cwd: ROOT, stdio: 'inherit' })
  }

  console.log(`  throwaway DB: ${TEST_DB}`)
  execSync(`PGPASSWORD='${parsed.password}' createdb -h ${parsed.host} -p ${parsed.port} -U ${parsed.user} ${TEST_DB}`)

  let server: ChildProcess | null = null
  let serverLog = ''
  let legitFilename: string | null = null
  let legitLegacyFilename: string | null = null
  try {
    server = spawn(path.join(ROOT, 'node_modules', '.bin', 'next'), ['start', '-p', String(PORT)], {
      cwd: ROOT,
      env: { ...process.env, NODE_ENV: 'production', DATABASE_URL: TEST_DSN, ADMIN_SEED_PASSWORD: ADMIN_PASSWORD, BACKUP_SCHEDULER_DISABLED: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    })
    server.stdout?.on('data', d => { serverLog += d.toString() })
    server.stderr?.on('data', d => { serverLog += d.toString() })

    await waitForHealth(server)
    console.log('  server up + DB migrated/seeded\n')

    const cookie = await login()
    ok(!!cookie, 'logged in with the throwaway-DB seeded admin')

    let counter = 0
    for (const modeCfg of MODES) {
      console.log(`\n  — ${modeCfg.label} —`)
      for (const payload of ATTACKS) {
        counter++
        const before = snapshotPublicFiles()
        const rowCountBefore = psql(TEST_DB, `select count(*) from media_files`)

        const res = await upload(cookie, payload, {
          category: modeCfg.category, mode: modeCfg.mode,
          nameEn: `Traversal Probe ${counter}`, nameFa: `کاوش مسیر ${counter}`,
        })

        const statusOk = res.status === 400
        const codeOk = res.json?.errorCode === 'MEDIA_INVALID_FOLDER'
        ok(statusOk && codeOk, `${modeCfg.label} payload ${JSON.stringify(payload)} → 400 MEDIA_INVALID_FOLDER (got ${res.status} ${res.json?.errorCode ?? '?'})`)

        const after = snapshotPublicFiles()
        const newFiles = [...after].filter(f => !before.has(f))
        ok(newFiles.length === 0, `no new file appeared anywhere under public/ (found: ${newFiles.join(', ') || 'none'})`)

        const rowCountAfter = psql(TEST_DB, `select count(*) from media_files`)
        ok(rowCountAfter === rowCountBefore, `no new media_files DB row was inserted (before=${rowCountBefore}, after=${rowCountAfter})`)
      }
    }

    // ---- Legit folders must still work end-to-end after the guard ----
    console.log(`\n  — allowlisted folders still work —`)
    const legit = await upload(cookie, 'hero-orbit', { category: 'hero-poster', mode: 'create', nameEn: 'Traversal Legit Check', nameFa: 'بررسی سالم' })
    ok(legit.status === 200, `a real allowlisted folder (hero-orbit) still uploads successfully (got ${legit.status})`)
    if (legit.status === 200 && typeof legit.json?.url === 'string') legitFilename = legit.json.url.replace(/^\/uploads\//, '')

    const legitLegacy = await upload(cookie, 'avatars', { mode: 'create', nameEn: 'x', nameFa: 'x' })
    ok(legitLegacy.status === 200, `the legacy path with a real allowlisted folder (avatars) still uploads successfully (got ${legitLegacy.status})`)
    if (legitLegacy.status === 200 && typeof legitLegacy.json?.url === 'string') legitLegacyFilename = legitLegacy.json.url.replace(/^\/uploads\//, '')

    if (failed > 0) {
      console.log('\n--- server log tail (failure diagnosis) ---')
      console.log(serverLog.split('\n').slice(-40).join('\n'))
    }
  } finally {
    if (server?.pid) { try { process.kill(-server.pid, 'SIGKILL') } catch { try { server.kill('SIGKILL') } catch { /* already gone */ } } }
    await new Promise(r => setTimeout(r, 1000))
    try { psql('postgres', `select pg_terminate_backend(pid) from pg_stat_activity where datname='${TEST_DB}' and pid <> pg_backend_pid()`) } catch { /* best-effort */ }
    try { execSync(`PGPASSWORD='${parsed.password}' dropdb -h ${parsed.host} -p ${parsed.port} -U ${parsed.user} --if-exists ${TEST_DB}`) } catch { /* best-effort cleanup */ }
    // Clean up the two "legit folder still works" probe files by filename,
    // captured from their own upload responses — never a glob, so this can
    // never accidentally sweep up a real pre-existing upload in those folders.
    for (const f of [legitFilename, legitLegacyFilename]) {
      if (!f) continue
      try { execSync(`rm -f "${path.join(ROOT, 'public', 'uploads')}/${f}"`) } catch { /* best-effort */ }
    }
  }

  console.log(`\n${failed === 0 ? '✅' : '❌'} ${n - failed}/${n} assertions passed\n`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
