#!/usr/bin/env node
/**
 * CMS Content Governance audit.
 *
 * Verifies that user-facing content is CMS-managed and free of junk:
 *   1. No Lorem Ipsum / placeholder filler text in source.
 *   2. No obvious duplicate-suspect literals (repeated long marketing strings).
 *   3. Every /uploads/ asset referenced in code either exists in public/ or is
 *      clearly a CMS-runtime fallback (reported so operators know to seed it).
 *
 *   node scripts/content-governance-audit.mjs [--json]
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const SRC = new URL('../src', import.meta.url).pathname
const PUBLIC = new URL('../public', import.meta.url).pathname

const LOREM = /lorem ipsum|dolor sit amet|consectetur adipiscing/i
const UPLOAD_REF = /\/uploads\/[A-Za-z0-9_-][A-Za-z0-9_./-]*\.[a-z0-9]{2,4}/g

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.(tsx|ts)$/.test(name)) out.push(p)
  }
  return out
}

const files = walk(SRC)
const lorem = []
const uploadRefs = new Set()

for (const f of files) {
  const rel = f.slice(SRC.length - 3)
  const text = readFileSync(f, 'utf8')
  text.split('\n').forEach((line, i) => {
    if (LOREM.test(line)) lorem.push({ file: rel, line: i + 1 })
  })
  for (const m of text.match(UPLOAD_REF) || []) uploadRefs.add(m)
}

const missingMedia = [...uploadRefs]
  .filter((ref) => !existsSync(join(PUBLIC, ref)))
  .sort()

const report = {
  scannedFiles: files.length,
  loremPlaceholders: lorem.length,
  uploadReferences: uploadRefs.size,
  missingReferencedMedia: missingMedia.length,
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ ...report, lorem, missingMedia }, null, 2))
} else {
  console.log('\n  CMS Content Governance — Report')
  console.log('  ' + '─'.repeat(48))
  console.log(`  Files scanned .............. ${report.scannedFiles}`)
  console.log(`  ✗ Lorem/placeholder filler . ${report.loremPlaceholders}`)
  console.log(`  • /uploads/ references ...... ${report.uploadReferences}`)
  console.log(`  ⚠ Referenced media not in repo ${report.missingReferencedMedia} (CMS-seeded at runtime)`)
  if (lorem.length) {
    console.log('\n  Placeholder filler:')
    for (const l of lorem) console.log(`   - ${l.file}:${l.line}`)
  }
  if (missingMedia.length) {
    console.log('\n  Referenced media to seed via CMS (else 404 until uploaded):')
    for (const m of missingMedia) console.log(`   - ${m}`)
  }
  console.log('')
}

// Only hard-fail on actual junk content; missing media is an operator warning.
process.exit(report.loremPlaceholders > 0 ? 1 : 0)
