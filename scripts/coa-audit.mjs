#!/usr/bin/env node
/**
 * ERPFIX-1 BUG-ERP-10 — chart-of-accounts seed collision gate.
 *
 * Parses every `INSERT INTO gl_accounts (code, name_en, name_fa, type, ...)
 * VALUES (...)` statement in migrate.ts and fails if any `code` is seeded
 * with more than one distinct (name_en, type) pair — the exact shape of
 * BUG-ERP-10 ('6100' seeded once as Rent Expense, once — a no-op — as
 * Salaries).
 *
 * Run: node scripts/coa-audit.mjs [--json]
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const migrate = readFileSync(join(ROOT, 'src/lib/db/migrate.ts'), 'utf8')

// Find every `INSERT INTO gl_accounts (...)  VALUES ( ... );` block and
// pull out each row tuple's code/name_en/type. Column order varies
// (code, name_en, name_fa, type[, active]) across the seed statements, so
// we match named columns positionally from the INSERT's own column list.
const INSERT_RE = /INSERT INTO gl_accounts\s*\(([^)]+)\)\s*VALUES\s*([\s\S]*?);/gi
const ROW_RE = /\(\s*'([^']*)'(?:\s*,\s*('(?:[^']|'')*'|NULL|[A-Za-z0-9_.]+))*\s*\)/g

const seeds = []
let m
while ((m = INSERT_RE.exec(migrate))) {
  const cols = m[1].split(',').map(c => c.trim().toLowerCase())
  const codeIdx = cols.indexOf('code')
  const nameIdx = cols.indexOf('name_en')
  const typeIdx = cols.indexOf('type')
  if (codeIdx === -1 || nameIdx === -1 || typeIdx === -1) continue
  const valuesBlock = m[2]
  // Split the VALUES block into individual row tuples by top-level
  // parenthesis matching (commas inside a row's own parens don't split it).
  let depth = 0, start = -1
  const rows = []
  for (let i = 0; i < valuesBlock.length; i++) {
    const c = valuesBlock[i]
    if (c === '(') { if (depth === 0) start = i; depth++ }
    else if (c === ')') { depth--; if (depth === 0) rows.push(valuesBlock.slice(start, i + 1)) }
  }
  for (const row of rows) {
    // Extract each top-level comma-separated field (handles quoted strings).
    const fields = []
    let d = 0, s = 1 // skip the opening '('
    let inStr = false
    for (let i = 1; i < row.length - 1; i++) {
      const c = row[i]
      if (c === "'" && !inStr) inStr = true
      else if (c === "'" && inStr && row[i + 1] === "'") { i++ } // escaped quote
      else if (c === "'" && inStr) inStr = false
      else if (!inStr && (c === '(' || c === '[')) d++
      else if (!inStr && (c === ')' || c === ']')) d--
      else if (!inStr && c === ',' && d === 0) { fields.push(row.slice(s, i).trim()); s = i + 1 }
    }
    fields.push(row.slice(s, row.length - 1).trim())
    const unquote = v => v && v.startsWith("'") && v.endsWith("'") ? v.slice(1, -1).replace(/''/g, "'") : v
    const code = unquote(fields[codeIdx])
    const nameEn = unquote(fields[nameIdx])
    const type = unquote(fields[typeIdx])
    if (code && nameEn && type) seeds.push({ code, nameEn, type })
  }
}

const groups = new Map()
for (const s of seeds) {
  const key = `${s.nameEn}\u0000${s.type}`
  if (!groups.has(s.code)) groups.set(s.code, new Set())
  groups.get(s.code).add(key)
}
const collisions = []
for (const [code, variants] of groups) {
  if (variants.size > 1) {
    collisions.push({ code, variants: [...variants].map(v => { const [nameEn, type] = v.split('\u0000'); return { nameEn, type } }) })
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ codesSeeded: groups.size, collisions }, null, 2))
} else {
  console.log('\n  Chart-of-Accounts Audit (ERPFIX-1 BUG-ERP-10 — seed collision gate)')
  console.log('  ' + '─'.repeat(66))
  console.log(`  Account codes seeded ......... ${groups.size}`)
  console.log(`  ✗ Codes with 2+ definitions ... ${collisions.length}  (budget 0)`)
  for (const c of collisions) console.log(`      · ${c.code}: ${c.variants.map(v => `${v.nameEn} (${v.type})`).join(' vs ')}`)
  console.log('')
}
process.exit(collisions.length === 0 ? 0 : 1)
