#!/usr/bin/env node
/**
 * AdminShell integrity audit (Phase 26.26b, BUG-014 regression gate). Every
 * `page.tsx` under src/app/admin/ — except the login page, which is intentionally
 * chrome-less — MUST import and render <AdminShell> so it gets the sidebar, header
 * and command palette. A page that renders its component bare shows up broken (no
 * nav, content spilling past the edge) even though TypeScript + build are green.
 * This closes that class forever.
 *
 *   node scripts/shell-audit.mjs [--json]
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const ADMIN = join(ROOT, 'src', 'app', 'admin')

// Pages that are legitimately shell-less (full-screen auth surface).
const EXEMPT = [/\/login\/page\.tsx$/]

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (name === 'page.tsx') out.push(p)
  }
  return out
}

const pages = walk(ADMIN)
const violations = []
for (const p of pages) {
  const rel = p.slice(ROOT.length)
  if (EXEMPT.some((re) => re.test(p))) continue
  const text = readFileSync(p, 'utf8')
  // Must both import AND render AdminShell (rendering another component that itself
  // wraps AdminShell is not the project pattern; page-level shell is the contract).
  const imports = /AdminShell/.test(text) && /<AdminShell\b/.test(text)
  if (!imports) violations.push(rel)
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ pages: pages.length, violations }, null, 2))
} else {
  console.log('\n  AdminShell Integrity — Report')
  console.log('  ' + '─'.repeat(48))
  console.log(`  Admin pages scanned ........ ${pages.length}`)
  console.log(`  ✗ Pages without AdminShell . ${violations.length}  (budget 0, login exempt)`)
  for (const v of violations) console.log(`   - ${v}`)
  console.log('')
}

process.exit(violations.length > 0 ? 1 : 0)
