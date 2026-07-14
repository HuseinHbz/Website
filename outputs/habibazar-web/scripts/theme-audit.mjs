#!/usr/bin/env node
/**
 * Theme audit (Phase 26.24, بند ۳.۱). Fails on hardcoded light/dark colours in
 * admin UI that break the light theme: bare `text-white`/`bg-white`/`text-black`/
 * `bg-black` (and `hover:text-white`) used as base text/surface colours.
 *
 * IMPORTANT — className-fragment aware: `text-white` is CORRECT and allowed when
 * it sits on a COLOURED background in the same class fragment (`bg-brand text-white`
 * buttons, `bg-success text-white` badges, gradients) — indigo/green/red stay dark
 * enough for white text in both themes. Only white-on-neutral (transparent/surface/
 * background) is flagged, because that is what disappears in light mode.
 *
 *   node scripts/theme-audit.mjs [--json]     Budget: 0 in admin.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const SRC = join(ROOT, 'src')
const INCLUDE = [/\/app\/admin\//, /\/components\/admin\//]

// A coloured background in the same class fragment makes white/black text safe.
const COLOURED_BG = /\b(?:bg-brand|bg-accent|bg-gradient|bg-(?:success|danger|warning|info|indigo|green|red|blue|yellow|purple|emerald|amber|sky|cyan|rose|pink|violet|teal|orange|fuchsia|lime)(?:-\d{3})?|from-\w)/
const BAD = /(?<![\w-])(?:hover:)?(?:text-white|bg-white|text-black|bg-black)(?![\w/-])/g
// Extract each className fragment (between quotes/backticks or ternary branches).
const FRAGMENT = /`[^`]*`|"[^"]*"|'[^']*'/g

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

const files = walk(SRC).filter(f => INCLUDE.some(re => re.test(f)))
const hits = []
for (const f of files) {
  const rel = f.slice(SRC.length - 3)
  const text = readFileSync(f, 'utf8')
  const lineOf = (idx) => text.slice(0, idx).split('\n').length
  for (const frag of text.matchAll(FRAGMENT)) {
    const s = frag[0]
    // Split ternary branches so `A ? 'bg-brand text-white' : 'hover:text-white'`
    // is judged per-branch (the else branch has no coloured bg → flagged).
    for (const branch of s.split(/[?:]|\$\{|\}/)) {
      const bad = branch.match(BAD)
      if (bad && !COLOURED_BG.test(branch)) {
        hits.push({ file: rel, line: lineOf(frag.index), tokens: [...new Set(bad)] })
      }
    }
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ filesScanned: files.length, hits }, null, 2))
} else {
  console.log('\n  Theme Audit (hardcoded white/black on neutral surfaces in admin UI)')
  console.log('  ' + '─'.repeat(58))
  console.log(`  Admin files scanned .......... ${files.length}`)
  console.log(`  ✗ light-theme-breaking hits .. ${hits.length}  (budget 0)`)
  for (const h of hits.slice(0, 30)) console.log(`      · ${h.file}:${h.line}  [${h.tokens.join(', ')}]`)
  if (hits.length > 30) console.log(`      · … +${hits.length - 30} more`)
  console.log('')
}
process.exit(hits.length === 0 ? 0 : 1)
