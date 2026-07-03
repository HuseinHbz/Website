#!/usr/bin/env node
/**
 * Translation-key integrity audit (Phase 19 — "Broken Translation Keys").
 *
 * Parses the admin locale dictionary (src/lib/admin/locale.tsx), then scans src/
 * for static `t('key')` calls and verifies each referenced key:
 *   - exists in the dictionary, and
 *   - has a non-empty `fa` AND `en` translation.
 * A missing/empty key renders as a blank or the raw key in the UI — a real bug.
 *
 * Dynamic calls — `t(someVar)`, `t(`x_${y}`)` — cannot be resolved statically and
 * are skipped (so keys only referenced dynamically may show as "orphan", which is
 * informational, not a failure).
 *
 *   node scripts/i18n-audit.mjs [--json]
 *
 * Exits non-zero if any referenced key is missing or has an empty translation.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const SRC = join(ROOT, 'src')
const LOCALE = join(SRC, 'lib', 'admin', 'locale.tsx')

// ── Parse the dictionary: `key: { fa: '…', en: '…' }` ──────────────────────
const localeText = readFileSync(LOCALE, 'utf8')
const defined = new Map() // key -> { fa, en }
const ENTRY_RE = /^\s{2}([a-zA-Z0-9_]+):\s*\{\s*fa:\s*(['"`])((?:\\.|(?!\2).)*)\2\s*,\s*en:\s*(['"`])((?:\\.|(?!\4).)*)\4\s*\}/gm
let m
while ((m = ENTRY_RE.exec(localeText))) {
  defined.set(m[1], { fa: m[3], en: m[5] })
}

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.(tsx|ts)$/.test(name)) out.push(p)
  }
  return out
}

// ── Collect static t('key') references ─────────────────────────────────────
// IMPORTANT: only the admin i18n system uses this dictionary via useT() from
// '@/lib/admin/locale'. Public marketing components use next-intl's
// useTranslations() (backed by messages/*.json) — a different system. Scope the
// scan to files that import the admin locale so we don't conflate the two.
const CALL_RE = /\bt\(\s*(['"])([a-zA-Z0-9_]+)\1/g
const ADMIN_LOCALE_IMPORT = /from\s+['"]@\/lib\/admin\/locale['"]/
const files = walk(SRC)
const used = new Map() // key -> first file
for (const f of files) {
  const rel = f.slice(SRC.length - 3)
  const text = readFileSync(f, 'utf8')
  if (f !== LOCALE && !ADMIN_LOCALE_IMPORT.test(text)) continue // not an admin-i18n file
  let c
  CALL_RE.lastIndex = 0
  while ((c = CALL_RE.exec(text))) { if (!used.has(c[2])) used.set(c[2], rel) }
}

const missing = []       // referenced but not defined
const emptyTranslation = [] // defined but fa or en blank
for (const [key, file] of used) {
  const d = defined.get(key)
  if (!d) { missing.push({ key, file }); continue }
  if (!d.fa.trim() || !d.en.trim()) emptyTranslation.push({ key, file })
}
const orphan = [...defined.keys()].filter((k) => !used.has(k))

const report = {
  definedKeys: defined.size,
  referencedStaticKeys: used.size,
  missing,
  emptyTranslation,
  orphanCount: orphan.length,
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ ...report, orphan }, null, 2))
} else {
  console.log('\n  Translation-Key Integrity — Report')
  console.log('  ' + '─'.repeat(48))
  console.log(`  Defined keys ............... ${report.definedKeys}`)
  console.log(`  Referenced (static t('…')) . ${report.referencedStaticKeys}`)
  console.log(`  ✗ Missing keys ............. ${missing.length}`)
  console.log(`  ✗ Empty fa/en translation .. ${emptyTranslation.length}`)
  console.log(`  • Orphan keys (informational) ${report.orphanCount}`)
  for (const x of missing) console.log(`   - MISSING  t('${x.key}')  (${x.file})`)
  for (const x of emptyTranslation) console.log(`   - EMPTY    '${x.key}'  (${x.file})`)
  console.log('')
}

process.exit(missing.length + emptyTranslation.length > 0 ? 1 : 0)
