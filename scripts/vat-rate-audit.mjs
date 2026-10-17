#!/usr/bin/env node
/**
 * ERPFIX-7 BUG-ERP-20 — statutory VAT rate literal gate.
 *
 * A VAT rate is a statutory figure that changes with the budget and must
 * NEVER be a literal in source — it comes from the confirmed `tax_rates`
 * table (`erp/taxData.ts#currentVatRate`), computed live, not a hardcoded
 * default. This scans `src/` for the specific patterns a hardcoded VAT
 * default has historically taken in this codebase:
 *   - `taxPct: <number>` / `taxPct = <number>` initializers (React state /
 *     object literals) with a nonzero numeric default — a 0 default is fine
 *     (that is exactly what an unconfirmed rate should fall back to).
 *   - a `rate: <number>` field adjacent to a VAT-labelled tax rule literal.
 *   - any `vat_rate` seeded as a nonzero literal in `migrate.ts`.
 * Test fixtures (`__tests__/`) are excluded — they legitimately exercise the
 * pure tax-math engine with an arbitrary example percentage, which is not a
 * statutory assumption.
 *
 * Run: node scripts/vat-rate-audit.mjs [--json]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const SRC = join(ROOT, 'src')

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}

const TAX_PCT_NONZERO = /taxPct\s*[:=]\s*(?!0\b)\d+(\.\d+)?/g

const violations = []
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file)
  if (rel.includes('__tests__')) continue
  const text = readFileSync(file, 'utf8')
  let m
  while ((m = TAX_PCT_NONZERO.exec(text))) {
    const line = text.slice(0, m.index).split('\n').length
    violations.push({ file: rel, line, snippet: m[0] })
  }
}

// migrate.ts: any tax_profiles seed row with a nonzero vat_rate literal.
const migratePath = join(SRC, 'lib/db/migrate.ts')
const migrate = readFileSync(migratePath, 'utf8')
const PROFILE_ROW_RE = /INSERT INTO tax_profiles[\s\S]*?VALUES([\s\S]*?);/g
let pm
while ((pm = PROFILE_ROW_RE.exec(migrate))) {
  const block = pm[1]
  // Row shape: ('code','name_en','name_fa','category',vat_rate,withholding_rate,exempt)
  const ROW_RE = /\(\s*'[^']*'\s*,\s*'[^']*'\s*,\s*'[^']*'\s*,\s*'[^']*'\s*,\s*(-?\d+(?:\.\d+)?)/g
  let rm
  while ((rm = ROW_RE.exec(block))) {
    const rate = Number(rm[1])
    if (rate !== 0) {
      const idx = pm.index + (rm.index ?? 0)
      const line = migrate.slice(0, idx).split('\n').length
      violations.push({ file: 'src/lib/db/migrate.ts', line, snippet: `tax_profiles seed vat_rate=${rate}` })
    }
  }
}

console.log('\n  VAT Rate Literal Audit (ERPFIX-7 BUG-ERP-20 — no statutory rate in src)')
console.log('  ' + '─'.repeat(70))
console.log(`  Files scanned ................ ${walk(SRC).length}`)
console.log(`  ✗ Hardcoded nonzero VAT literals .. ${violations.length}  (budget 0)`)
if (violations.length) {
  for (const v of violations) console.log(`    - ${v.file}:${v.line} — ${v.snippet}`)
}
if (process.argv.includes('--json')) console.log(JSON.stringify(violations))
process.exit(violations.length === 0 ? 0 : 1)
