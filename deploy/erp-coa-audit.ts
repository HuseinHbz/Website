/**
 * ERPFIX-1 BUG-ERP-10 — read-only chart-of-accounts audit.
 *
 * Reports (never writes):
 *   1. Account codes seeded with two different name/type pairs somewhere
 *      in migrate.ts's history (the collision class BUG-ERP-10 was).
 *   2. Live GL entries posted to code 6100 (Rent Expense), broken down by
 *      reference prefix (payroll / treasury / other) — so you can see how
 *      many existing postings actually belong to payroll.
 *
 * Usage:
 *   DATABASE_URL=… npx tsx deploy/erp-coa-audit.ts
 */
import { pgQuery } from '@/lib/db'
import { readFileSync } from 'fs'
import { join } from 'path'
import { findCoaCollisions } from '@/lib/erp/coaContract'

async function main() {
  console.log('── Chart-of-Accounts Audit (read-only) ──────────────────────\n')

  // 1. Seed collisions (same logic as scripts/coa-audit.mjs, reused here so
  // the operator sees the SAME classification this install's audit:coa gate uses).
  const migrate = readFileSync(join(process.cwd(), 'src/lib/db/migrate.ts'), 'utf8')
  const INSERT_RE = /INSERT INTO gl_accounts\s*\(([^)]+)\)\s*VALUES\s*([\s\S]*?);/gi
  const seeds: { code: string; nameEn: string; type: string }[] = []
  let m: RegExpExecArray | null
  while ((m = INSERT_RE.exec(migrate))) {
    const cols = m[1].split(',').map(c => c.trim().toLowerCase())
    const codeIdx = cols.indexOf('code'), nameIdx = cols.indexOf('name_en'), typeIdx = cols.indexOf('type')
    if (codeIdx === -1 || nameIdx === -1 || typeIdx === -1) continue
    const block = m[2]
    let depth = 0, start = -1
    const rows: string[] = []
    for (let i = 0; i < block.length; i++) {
      if (block[i] === '(') { if (depth === 0) start = i; depth++ }
      else if (block[i] === ')') { depth--; if (depth === 0) rows.push(block.slice(start, i + 1)) }
    }
    for (const row of rows) {
      const fields: string[] = []
      let d = 0, s = 1, inStr = false
      for (let i = 1; i < row.length - 1; i++) {
        const c = row[i]
        if (c === "'" && !inStr) inStr = true
        else if (c === "'" && inStr && row[i + 1] === "'") i++
        else if (c === "'" && inStr) inStr = false
        else if (!inStr && (c === '(' || c === '[')) d++
        else if (!inStr && (c === ')' || c === ']')) d--
        else if (!inStr && c === ',' && d === 0) { fields.push(row.slice(s, i).trim()); s = i + 1 }
      }
      fields.push(row.slice(s, row.length - 1).trim())
      const unquote = (v: string) => v && v.startsWith("'") && v.endsWith("'") ? v.slice(1, -1).replace(/''/g, "'") : v
      const code = unquote(fields[codeIdx]), nameEn = unquote(fields[nameIdx]), type = unquote(fields[typeIdx])
      if (code && nameEn && type) seeds.push({ code, nameEn, type })
    }
  }
  const collisions = findCoaCollisions(seeds)
  console.log(`Seed collisions: ${collisions.length}`)
  for (const c of collisions) console.log(`  · ${c.code}: ${c.variants.map(v => `${v.nameEn} (${v.type})`).join(' vs ')}`)

  // 2. Live postings on 6100, by reference prefix.
  const rows = await pgQuery<{ prefix: string; n: number; total: number }>(`
    SELECT
      CASE
        WHEN e.reference LIKE 'payroll:%' THEN 'payroll'
        WHEN e.reference ILIKE '%salary%' OR e.reference ILIKE '%salar%' THEN 'treasury (salary_payment)'
        ELSE 'other'
      END AS prefix,
      count(*)::int AS n,
      COALESCE(SUM(l.debit - l.credit), 0)::float AS total
    FROM gl_journal_lines l
    JOIN gl_journal_entries e ON e.id = l.entry_id
    JOIN gl_accounts a ON a.id = l.account_id
    WHERE a.code = '6100' AND e.status = 'posted'
    GROUP BY prefix`)
  console.log('\nLive postings on account 6100 (Rent Expense), by likely origin:')
  if (rows.length === 0) console.log('  (none — nothing posted to 6100 yet)')
  for (const r of rows) console.log(`  · ${r.prefix}: ${r.n} line(s), net ${r.total.toLocaleString()}`)

  console.log('\nNothing was changed. Use deploy/erp-remediate-salary-account.ts to correct any payroll postings found above.')
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
