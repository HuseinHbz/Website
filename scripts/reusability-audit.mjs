#!/usr/bin/env node
/**
 * Component Reusability Governance audit.
 *
 * Measures duplication of the raw admin CRUD fetch idiom that
 * `lib/admin/crud.ts` + `useResource` exist to replace. Each occurrence of a
 * hand-rolled `fetch('/api/admin/…', { method, headers, body })` is a
 * migration candidate. Reports the count so the number can be ratcheted down;
 * does not fail CI (informational).
 *
 *   node scripts/reusability-audit.mjs [--json]
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ADMIN = new URL('../src/app/admin', import.meta.url).pathname

// Raw write idiom: fetch(..., { method: ... }) — what crud.save/patch/remove replace.
const RAW_WRITE = /fetch\([^)]*\{\s*method:/g
// Raw list idiom: fetch('/api/admin/x') with no options — what useResource/crud.list replace.
const RAW_LIST = /fetch\((['"`]\/api\/admin\/[^'"`]+['"`])\s*\)/g

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (name.endsWith('.tsx')) out.push(p)
  }
  return out
}

const files = walk(ADMIN)
const perFile = []
let rawWrites = 0, rawLists = 0

for (const f of files) {
  const rel = f.slice(ADMIN.length - 5)
  const text = readFileSync(f, 'utf8')
  const w = (text.match(RAW_WRITE) || []).length
  const l = (text.match(RAW_LIST) || []).length
  if (w + l > 0) perFile.push({ file: rel, rawWrites: w, rawLists: l })
  rawWrites += w
  rawLists += l
}

perFile.sort((a, b) => (b.rawWrites + b.rawLists) - (a.rawWrites + a.rawLists))

const report = {
  adminComponents: files.length,
  filesUsingRawFetch: perFile.length,
  rawWriteIdioms: rawWrites,
  rawListIdioms: rawLists,
  sharedPrimitive: 'lib/admin/crud.ts (crud.save/patch/remove/list, useResource)',
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ ...report, perFile }, null, 2))
} else {
  console.log('\n  Component Reusability Governance — Report')
  console.log('  ' + '─'.repeat(48))
  console.log(`  Admin components ............... ${report.adminComponents}`)
  console.log(`  Files still using raw fetch .... ${report.filesUsingRawFetch}`)
  console.log(`  Raw write idioms (→ crud.*) .... ${report.rawWriteIdioms}`)
  console.log(`  Raw list idioms (→ useResource)  ${report.rawListIdioms}`)
  console.log(`  Shared primitive ............... ${report.sharedPrimitive}`)
  console.log('\n  Top migration candidates:')
  for (const p of perFile.slice(0, 12)) {
    console.log(`   - ${p.file}  (writes ${p.rawWrites}, lists ${p.rawLists})`)
  }
  console.log('')
}
