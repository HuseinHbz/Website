#!/usr/bin/env node
/**
 * Dependency & Bundle Governance audit.
 *
 * Flags runtime `dependencies` that are never imported in src/ (dead weight in
 * the pruned production install) and build-only tools that are miscategorized
 * as runtime deps. `@types/*`, `nodemailer` (dynamic import) and the framework
 * runtime are whitelisted. Fails CI on an unused runtime dependency.
 *
 *   node scripts/dependency-audit.mjs [--json]
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const SRC = join(ROOT, 'src')
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))

// Deps that are used without a literal static import in src/.
const WHITELIST = new Set([
  'next', 'react', 'react-dom', // framework runtime / JSX
  'nodemailer', // dynamic import in lib/notifications.ts
])
// Build-only tooling that should never sit in runtime `dependencies`.
const BUILD_ONLY = new Set([
  'typescript', 'tailwindcss', 'postcss', 'autoprefixer', 'eslint',
  'eslint-config-next', 'vitest', '@playwright/test', 'wait-on',
])

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.(tsx?|mjs)$/.test(name)) out.push(p)
  }
  return out
}

const source = walk(SRC).map((f) => readFileSync(f, 'utf8')).join('\n')
const isImported = (dep) =>
  source.includes(`'${dep}'`) || source.includes(`"${dep}"`) ||
  source.includes(`'${dep}/`) || source.includes(`"${dep}/`)

const runtime = Object.keys(pkg.dependencies || {})
const unused = runtime.filter(
  (d) => !d.startsWith('@types/') && !WHITELIST.has(d) && !isImported(d)
)
const misplaced = runtime.filter((d) => BUILD_ONLY.has(d))
const strayTypes = runtime.filter((d) => d.startsWith('@types/'))

const report = {
  runtimeDeps: runtime.length,
  devDeps: Object.keys(pkg.devDependencies || {}).length,
  unusedRuntimeDeps: unused,
  misplacedBuildTools: misplaced,
  typesInRuntime: strayTypes,
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2))
} else {
  console.log('\n  Dependency & Bundle Governance — Report')
  console.log('  ' + '─'.repeat(48))
  console.log(`  Runtime dependencies ....... ${report.runtimeDeps}`)
  console.log(`  Dev dependencies ........... ${report.devDeps}`)
  console.log(`  ✗ Unused runtime deps ...... ${unused.length ? unused.join(', ') : 'none'}`)
  console.log(`  ✗ Build tools in runtime ... ${misplaced.length ? misplaced.join(', ') : 'none'}`)
  console.log(`  ⚠ @types/* in runtime ...... ${strayTypes.length ? strayTypes.join(', ') : 'none'}`)
  console.log('')
}

const fail = unused.length + misplaced.length + strayTypes.length
process.exit(fail > 0 ? 1 : 0)
