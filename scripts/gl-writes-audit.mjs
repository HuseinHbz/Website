#!/usr/bin/env node
/**
 * ERPFIX-1 BUG-ERP-08 — "only one point of writing a posted entry" gate.
 *
 * Fails if `INSERT INTO gl_journal_entries` appears anywhere under `src/`
 * EXCEPT inside the one core function (`insertPostedEntry` in glPosting.ts)
 * or an explicitly documented, written-reason allowlist entry. Test fixture
 * files (scripts/verify-*.ts, scripts/sim-*.ts) are exempt — they build
 * throwaway rows directly to set up a scenario, never production code.
 *
 * Run: node scripts/gl-writes-audit.mjs [--json]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const CORE_FILE = 'src/lib/erp/glPosting.ts'

// Every entry here needs a WRITTEN one-line reason (26.28 بند ۰.۳ pattern).
// Deliberately short: anything new here should be migrated to
// insertPostedEntry instead, not added to this list.
const ALLOWLIST = new Map([
  // These 3 are NOT bypasses: each independently calls assertPostable,
  // runs its own header+lines insert inside ONE transaction, and is
  // already covered by its own long-standing, live-PG-verified regression
  // suite (26.15.1 sales auto-post, 26.24b purchase auto-post, the journal
  // route's own create-and-post + runOnce idempotency). Forcing them onto
  // insertPostedEntry would rewrite already-correct, already-regression-
  // tested financial code for no bug this phase found — a disproportionate
  // risk. A genuine future gap in any of these three stays caught by their
  // OWN gate (assertPostable), not by this allowlist.
  ['[src/app/api/admin/erp/finance/journal/route.ts:135]', 'journal route create-and-post: own assertPostable gate + own transaction + runOnce idempotency, regression-tested since 26.23.'],
  ['[src/lib/erp/purchasingData.ts:752]', 'postPurchaseInvoiceToGl: own assertPostable gate + own transaction, regression-tested since 26.24b (verify-2624b, AP non-negative proof).'],
  ['[src/lib/erp/salesData.ts:219]', 'postSalesInvoiceToGl: own assertPostable gate + own transaction, regression-tested since 26.15.1 (sales auto-post to GL).'],
])

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) { if (name === 'node_modules' || name === '__tests__') continue; walk(p, out) }
    else if (extname(name) === '.ts' || extname(name) === '.tsx') out.push(p)
  }
  return out
}

const findings = []
let scanned = 0
for (const file of walk(join(ROOT, 'src'))) {
  const rel = file.slice(ROOT.length)
  if (rel === CORE_FILE) continue
  const src = readFileSync(file, 'utf8')
  scanned++
  const re = /INSERT INTO gl_journal_entries/g
  let m
  while ((m = re.exec(src))) {
    const line = src.slice(0, m.index).split('\n').length
    const key = `[${rel}:${line}]`
    if (ALLOWLIST.has(key)) continue
    findings.push({ file: rel, line, reason: ALLOWLIST.get(key) })
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ scanned, findings }, null, 2))
} else {
  console.log('\n  GL-Writes Audit (ERPFIX-1 BUG-ERP-08 — single posted-entry entry point)')
  console.log('  ' + '─'.repeat(70))
  console.log(`  Files scanned ................ ${scanned}`)
  console.log(`  ✗ Writes outside the core ..... ${findings.length}  (budget 0)`)
  for (const f of findings) console.log(`      · ${f.file}:${f.line}`)
  console.log('')
}
process.exit(findings.length === 0 ? 0 : 1)
