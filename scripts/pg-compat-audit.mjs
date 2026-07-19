#!/usr/bin/env node
/**
 * PostgreSQL compatibility audit (Phase 20).
 *
 * Inventories every SQLite-specific construct still present in the application
 * runtime, so the async-driver cutover has an exact, verifiable work list and
 * the eventual "SQLite fully removed" state can be gated (target: 0 hits).
 *
 *   node scripts/pg-compat-audit.mjs [--json]
 *
 * Informational (exit 0): a report, not a gate. Grouped by category with the
 * PostgreSQL equivalent for each.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const SRC = join(ROOT, 'src')

const PATTERNS = [
  { key: 'driver-import', re: /better-sqlite3|drizzle-orm\/better-sqlite3|sqlite-core/g, note: '→ pg / drizzle-orm/node-postgres / pg-core' },
  { key: 'raw-$client', re: /\$client/g, note: 'raw better-sqlite3 handle → async pg pool/query' },
  { key: 'sync-get-all-run', re: /\.prepare\([^)]*\)\.(get|all|run)\b|\bprepare\(`|\.pragma\(/g, note: 'synchronous calls → await pool.query() in pg' },
  { key: 'pragma', re: /\bPRAGMA\b|\.pragma\(/gi, note: 'no PRAGMA in pg → pg_catalog / SET / extensions' },
  { key: 'autoincrement', re: /AUTOINCREMENT/gi, note: '→ GENERATED ... AS IDENTITY / SERIAL' },
  { key: 'datetime-now', re: /datetime\('now'\)/g, note: "→ now() / CURRENT_TIMESTAMP (timestamptz)" },
  { key: 'insert-or-ignore', re: /INSERT\s+OR\s+IGNORE/gi, note: '→ INSERT ... ON CONFLICT DO NOTHING' },
  { key: 'json-extract', re: /json_extract\s*\(/gi, note: "→ JSONB operators (->, ->>, jsonb_path_query)" },
  { key: 'sqlite-catalog', re: /sqlite_master|sqlite_version\s*\(|sqlite_%/g, note: '→ information_schema / pg_catalog' },
  { key: 'boolean-as-int', re: /integer\('[a-z_]+',\s*\{\s*mode:\s*'boolean'/gi, note: 'sqlite boolean-as-int → native boolean' },
  { key: 'backup-dot-backup', re: /\.backup\(/g, note: 'better-sqlite3 .backup() → pg_dump / pg_basebackup / WAL' },
]

// blogContent.ts holds blog-post markdown (tutorials that quote SQL/SQLite in
// prose) — it is content data, not runtime DB code, so it is excluded from scan.
const EXCLUDE = /db\/blogContent\.ts$/
function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.(ts|tsx|mjs)$/.test(name) && !EXCLUDE.test(p)) out.push(p)
  }
  return out
}

const files = walk(SRC)
const results = Object.fromEntries(PATTERNS.map((p) => [p.key, { note: p.note, count: 0, files: new Set() }]))
for (const f of files) {
  const rel = f.slice(SRC.length - 3)
  const text = readFileSync(f, 'utf8')
  for (const p of PATTERNS) {
    const m = text.match(p.re)
    if (m) { results[p.key].count += m.length; results[p.key].files.add(rel) }
  }
}
const report = PATTERNS.map((p) => ({ category: p.key, count: results[p.key].count, files: [...results[p.key].files].sort(), pgEquivalent: p.note }))
const totalHits = report.reduce((s, r) => s + r.count, 0)
const totalFiles = new Set(report.flatMap((r) => r.files)).size

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ totalHits, totalFiles, categories: report }, null, 2))
} else {
  console.log('\n  PostgreSQL Compatibility Audit (SQLite constructs remaining in runtime)')
  console.log('  ' + '─'.repeat(58))
  console.log(`  Files scanned .............. ${files.length}`)
  console.log(`  SQLite-specific hits ....... ${totalHits} across ${totalFiles} files\n`)
  for (const r of report) {
    console.log(`  ${r.category.padEnd(20)} ${String(r.count).padStart(4)}  → ${r.pgEquivalent}`)
    for (const f of r.files.slice(0, 6)) console.log(`      · ${f}`)
    if (r.files.length > 6) console.log(`      · … +${r.files.length - 6} more`)
  }
  console.log('\n  Target for full cutover: 0 hits. The data tier is already migrated')
  console.log('  + validated on PostgreSQL (see docs/governance/phase20-postgres-migration.md).')
  console.log('')
}
process.exit(0)
