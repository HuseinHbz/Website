#!/usr/bin/env node
/**
 * Design Token Governance audit.
 *
 * Scans src/ for hardcoded design values and classifies each occurrence as a
 * VIOLATION (should use a token/semantic class) or an ACCEPTED exception
 * (SVG art, external brand color, decorative gradient). Prints a compliance
 * summary and exits non-zero if violations exceed the allowed budget, so CI can
 * gate design drift.
 *
 *   node scripts/design-token-audit.mjs            # human report
 *   node scripts/design-token-audit.mjs --json     # machine report
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('../src', import.meta.url).pathname
const VIOLATION_BUDGET = 20 // ratchet down over time; fails CI if exceeded

/** Tailwind arbitrary color classes — always a violation (use a token class). */
const ARBITRARY_CLASS = /\b(bg|text|border|from|via|to|ring|fill|stroke|shadow)-\[#[0-9a-fA-F]{3,8}\]/g
/** Any hex literal, for classification of the remainder. */
const HEX = /#[0-9a-fA-F]{3,8}\b/g

// Official external brand colors — accepted (they are not ours to tokenize).
const SOCIAL = new Set(['#0077b5', '#e1306c', '#0088cc', '#25d366', '#1da1f2'])

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const s = statSync(p)
    if (s.isDirectory()) out.push(...walk(p))
    else if (/\.(tsx|ts|css)$/.test(name)) out.push(p)
  }
  return out
}

function classify(line) {
  // In an SVG attribute (fill/stroke/stopColor) → accepted decorative art.
  if (/(fill|stroke|stopColor)=["']#/.test(line)) return 'svg'
  // Inside a CSS gradient/shadow inline style → accepted decorative.
  if (/(linear-gradient|radial-gradient|conic-gradient|box-?shadow|drop-shadow)/i.test(line)) return 'decorative'
  if (ARBITRARY_CLASS.test(line)) return 'violation'
  return 'literal' // data literal / inline color — reviewable
}

const files = walk(ROOT)
const buckets = { violation: [], literal: [], svg: 0, decorative: 0 }
let totalHex = 0

for (const f of files) {
  const rel = f.slice(ROOT.length - 3)
  const lines = readFileSync(f, 'utf8').split('\n')
  lines.forEach((line, i) => {
    const hexes = line.match(HEX)
    if (!hexes) return
    totalHex += hexes.length
    const kind = classify(line)
    const onlySocial = hexes.every((h) => SOCIAL.has(h.toLowerCase()))
    if (kind === 'svg') buckets.svg += hexes.length
    else if (kind === 'decorative') buckets.decorative += hexes.length
    // Arbitrary classes carrying only official external brand colors are accepted.
    else if (kind === 'violation' && onlySocial) buckets.decorative += hexes.length
    else if (kind === 'violation') buckets.violation.push({ file: rel, line: i + 1 })
    else if (hexes.every((h) => SOCIAL.has(h.toLowerCase()))) buckets.decorative += hexes.length
    else buckets.literal.push({ file: rel, line: i + 1, hexes })
  })
}

const report = {
  scannedFiles: files.length,
  totalHexOccurrences: totalHex,
  violations: buckets.violation.length,
  reviewableLiterals: buckets.literal.length,
  acceptedSvgArt: buckets.svg,
  acceptedDecorative: buckets.decorative,
  budget: VIOLATION_BUDGET,
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ ...report, violationList: buckets.violation }, null, 2))
} else {
  console.log('\n  Design Token Governance — Compliance Report')
  console.log('  ' + '─'.repeat(48))
  console.log(`  Files scanned .............. ${report.scannedFiles}`)
  console.log(`  Hex occurrences (total) .... ${report.totalHexOccurrences}`)
  console.log(`  ✗ Arbitrary-class violations ${report.violations}  (budget ${report.budget})`)
  console.log(`  • Reviewable data literals . ${report.reviewableLiterals}`)
  console.log(`  ✓ Accepted SVG art ......... ${report.acceptedSvgArt}`)
  console.log(`  ✓ Accepted decorative ...... ${report.acceptedDecorative}`)
  if (buckets.violation.length) {
    console.log('\n  Violations:')
    for (const v of buckets.violation) console.log(`   - ${v.file}:${v.line}`)
  }
  console.log('')
}

process.exit(report.violations > VIOLATION_BUDGET ? 1 : 0)
