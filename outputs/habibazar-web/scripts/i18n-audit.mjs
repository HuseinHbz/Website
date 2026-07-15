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

// ── 26.25b بند ۰.۳: hardcoded-string detector ──────────────────────────────
// The i18n gate previously only caught MISSING keys — so a developer could dodge
// it by deleting the t('…') call and hardcoding text instead (backwards). This
// flags admin components that render BARE Persian (Arabic-script) JSX text that is
// NOT wrapped in a bilingual construct (t('…'), lc(fa,…) or a { fa, en } object).
// Reported informationally: the codebase's established convention is the inline
// `lc(fa, en, fa)` pattern (both languages present), so a hard-fail would
// false-positive across hundreds of legitimate call sites. The signal here is a
// Persian literal with NO English counterpart on the same line — the real leak.
const PERSIAN = /[؀-ۿ]/
const hardcoded = []
for (const f of files) {
  if (f === LOCALE) continue
  const text = readFileSync(f, 'utf8')
  if (!ADMIN_LOCALE_IMPORT.test(text)) continue
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!PERSIAN.test(line)) continue
    // Skip lines that already carry a bilingual construct or an English pair.
    if (/\bt\(\s*['"]/.test(line)) continue                 // t('key')
    if (/lc\(\s*fa\b/.test(line)) continue                   // lc(fa, en, fa)
    if (/\bfa:\s*['"`].*\ben:\s*['"`]/.test(line)) continue  // { fa:'…', en:'…' }
    if (/\ben:\s*['"`].*\bfa:\s*['"`]/.test(line)) continue
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue            // comment
    // A JSX text node or string attribute holding bare Persian → likely a leak.
    if (/>[^<>{]*[؀-ۿ]|(?:title|label|placeholder|aria-label)=\{?['"][^'"]*[؀-ۿ]/.test(line)) {
      hardcoded.push({ file: f.slice(SRC.length - 3), line: i + 1 })
    }
  }
}

const report = {
  definedKeys: defined.size,
  referencedStaticKeys: used.size,
  missing,
  emptyTranslation,
  orphanCount: orphan.length,
  hardcodedCount: hardcoded.length,
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ ...report, orphan, hardcoded }, null, 2))
} else {
  console.log('\n  Translation-Key Integrity — Report')
  console.log('  ' + '─'.repeat(48))
  console.log(`  Defined keys ............... ${report.definedKeys}`)
  console.log(`  Referenced (static t('…')) . ${report.referencedStaticKeys}`)
  console.log(`  ✗ Missing keys ............. ${missing.length}`)
  console.log(`  ✗ Empty fa/en translation .. ${emptyTranslation.length}`)
  console.log(`  • Orphan keys (informational) ${report.orphanCount}`)
  console.log(`  • Hardcoded Persian JSX (informational) ${report.hardcodedCount}`)
  for (const x of missing) console.log(`   - MISSING  t('${x.key}')  (${x.file})`)
  for (const x of emptyTranslation) console.log(`   - EMPTY    '${x.key}'  (${x.file})`)
  for (const x of hardcoded.slice(0, 20)) console.log(`   · HARDCODED ${x.file}:${x.line}`)
  console.log('')
}

process.exit(missing.length + emptyTranslation.length > 0 ? 1 : 0)
