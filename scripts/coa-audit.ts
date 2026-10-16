/**
 * ERPFIX-1 gate — `npm run audit:coa` (BUG-ERP-10). See src/lib/erp/coaAudit.ts.
 *  (a) no gl_accounts code seeded twice with a different name/type
 *  (b) every account-code literal in an account context is in COA_CONTRACT,
 *      and every contract entry matches the seed.
 * `--seed <file>` / `--extra <file>` add a SQL seed / a source file to the
 * scan (used by the negative test).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { parseGlAccountSeeds, seedConflicts, findAccountLiterals, contractProblems } from '../src/lib/erp/coaAudit'
import { COA_CONTRACT } from '../src/lib/erp/coaContract'

const ROOT = process.cwd()
const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined }

let seedSql = readFileSync(join(ROOT, 'src/lib/db/migrate.ts'), 'utf8')
if (arg('--seed')) seedSql += '\n' + readFileSync(join(ROOT, arg('--seed')!), 'utf8')
const seeds = parseGlAccountSeeds(seedSql)

const SCAN = ['src/lib', 'src/app/api']
const SKIP = new Set(['src/lib/db/migrate.ts', 'src/lib/erp/coaContract.ts', 'src/lib/erp/coaAudit.ts'])
function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === '__tests__' || name === 'node_modules') continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, acc)
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name)) acc.push(p)
  }
  return acc
}
const files = SCAN.flatMap(d => walk(join(ROOT, d)))
if (arg('--extra')) files.push(join(ROOT, arg('--extra')!))
const hits = files.flatMap(p => {
  const rel = relative(ROOT, p).split('\\').join('/')
  return SKIP.has(rel) ? [] : findAccountLiterals(rel, readFileSync(p, 'utf8'))
})

const conflicts = seedConflicts(seeds)
const problems = contractProblems(hits, COA_CONTRACT, seeds)
console.log(`audit:coa — ${seeds.length} seeded gl_accounts rows · ${hits.length} account-code literals in ${files.length} files · ${Object.keys(COA_CONTRACT).length} contract entries`)
for (const c of conflicts) console.log(`  ✗ (a) code ${c.code} seeded with different name/type: ${c.rows.map(r => `«${r.nameEn}» ${r.type} (line ${r.line})`).join(' vs ')}`)
for (const p of problems) console.log(`  ✗ (b) ${p.code}: ${p.problem}${p.where ? `\n        ${p.where}` : ''}`)
if (conflicts.length || problems.length) { console.log(`\n✗ ${conflicts.length} seed conflict(s), ${problems.length} contract problem(s)`); process.exit(1) }
console.log('✓ no seed conflicts; every account-code literal is in the contract and matches the seed')
