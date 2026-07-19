#!/usr/bin/env node
/**
 * UI Consistency Engine — enterprise design-language audit (Phase 24).
 *
 * Complements the Design Token audit (which governs colour). This one governs
 * the *type scale* and *control sizing*: it fails CI when a component reaches for
 * an arbitrary Tailwind font-size (`text-[13px]`, `text-[0.9rem]`, …) instead of
 * a named scale token (text-4xs … text-9xl / text-display). Arbitrary micro
 * sizes are the #1 source of visual drift across ~50 admin modules, so the type
 * scale is a hard gate. Interactive control heights are reported informationally.
 *
 *   node scripts/ui-consistency-audit.mjs            # human report
 *   node scripts/ui-consistency-audit.mjs --json     # machine report
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('../src', import.meta.url).pathname
const FONT_BUDGET = 0 // hard gate: every font-size must be an on-scale token

/** Arbitrary Tailwind font-size class — a type-scale violation. */
const ARBITRARY_FONT = /\btext-\[[0-9.]+(px|rem|em)\]/g
/** Arbitrary interactive control height (button/input) — reported, not gated. */
const ARBITRARY_HEIGHT = /\b(h|min-h|max-h)-\[[0-9.]+px\]/g

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const s = statSync(p)
    if (s.isDirectory()) out.push(...walk(p))
    else if (/\.(tsx|ts)$/.test(name)) out.push(p)
  }
  return out
}

const files = walk(ROOT)
const fontViolations = []
const heightNotes = []

for (const f of files) {
  const rel = f.slice(ROOT.length - 3)
  const lines = readFileSync(f, 'utf8').split('\n')
  lines.forEach((line, i) => {
    const fonts = line.match(ARBITRARY_FONT)
    if (fonts) fonts.forEach((cls) => fontViolations.push({ file: rel, line: i + 1, cls }))
    const heights = line.match(ARBITRARY_HEIGHT)
    if (heights) heights.forEach((cls) => heightNotes.push({ file: rel, line: i + 1, cls }))
  })
}

const report = {
  scannedFiles: files.length,
  fontViolations: fontViolations.length,
  fontBudget: FONT_BUDGET,
  arbitraryHeights: heightNotes.length,
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ ...report, fontViolationList: fontViolations, heightNotes }, null, 2))
} else {
  console.log('\n  UI Consistency Engine — Design-Language Report')
  console.log('  ' + '─'.repeat(48))
  console.log(`  Files scanned .............. ${report.scannedFiles}`)
  console.log(`  ✗ Arbitrary font sizes ..... ${report.fontViolations}  (budget ${report.fontBudget})`)
  console.log(`  • Arbitrary control heights  ${report.arbitraryHeights}  (informational)`)
  if (fontViolations.length) {
    console.log('\n  Type-scale violations (use a text-* scale token):')
    for (const v of fontViolations.slice(0, 40)) console.log(`   - ${v.file}:${v.line}  ${v.cls}`)
    if (fontViolations.length > 40) console.log(`   … and ${fontViolations.length - 40} more`)
  }
  console.log('')
}

process.exit(report.fontViolations > FONT_BUDGET ? 1 : 0)
