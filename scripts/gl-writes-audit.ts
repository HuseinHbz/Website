/**
 * ERPFIX-1 gate — `npm run audit:gl-writes`. Fails when anything in src/ or
 * deploy/ writes a journal entry/line (or flips one to posted) outside the
 * single GL entry point. Rules + allowlist: src/lib/governance/glWritesAudit.ts
 * `--extra <file>` adds a file to the scan (used by the negative test).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { scanGlWrites, GL_WRITES_ALLOWLIST, type SourceFile } from '../src/lib/governance/glWritesAudit'

const ROOT = process.cwd()
const EXT = /\.(ts|tsx|mjs|js|sql|sh)$/
function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === '__tests__') continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, acc)
    else if (EXT.test(name) && !/\.test\.ts$/.test(name)) acc.push(p)
  }
  return acc
}

const paths = [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'deploy'))]
const extraIdx = process.argv.indexOf('--extra')
if (extraIdx > 0 && process.argv[extraIdx + 1]) paths.push(join(ROOT, process.argv[extraIdx + 1]))
const files: SourceFile[] = paths.map(p => ({ path: relative(ROOT, p).split('\\').join('/'), text: readFileSync(p, 'utf8') }))
const violations = scanGlWrites(files)

console.log(`audit:gl-writes — scanned ${files.length} files; allowlist ${Object.keys(GL_WRITES_ALLOWLIST).length} (each with a written reason)`)
if (violations.length) {
  for (const v of violations) console.log(`  ✗ ${v.path}:${v.line} [${v.kind}] ${v.snippet}\n      → ${v.why}`)
  console.log(`\n✗ ${violations.length} GL write(s) bypass insertPostedEntry`)
  process.exit(1)
}
console.log('✓ every posted journal entry is written through insertPostedEntry')
