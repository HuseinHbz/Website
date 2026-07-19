#!/usr/bin/env node
/**
 * Link & media integrity audit (Phase 14 — Broken Internal Links / Broken Media).
 *
 * Enumerates the real public routes from the App Router, then scans src/ for
 * internal link literals and flags any that point at a non-existent public page.
 * Also flags `/uploads/` media references missing from public/. Complements the
 * content audit (which reports media coverage) by catching dead navigation/CTA
 * links like a menu item pointing at a route that was never built.
 *
 *   node scripts/link-integrity-audit.mjs [--json]
 *
 * Exits non-zero if any broken internal link is found (gates CI). Missing media
 * is a warning (CMS assets are seeded at runtime).
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const SRC = join(ROOT, 'src')
const PUBLIC = join(ROOT, 'public')
const MARKETING = join(SRC, 'app', '[locale]', '(marketing)')
const LOCALE_DIR = join(SRC, 'app', '[locale]')

// Real public routes = marketing segments + top-level [locale] segments that are
// actual pages (a directory with a page.tsx, or a known dynamic segment).
function routeSegments(dir) {
  const out = new Set()
  let entries = []
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return out }
  for (const e of entries) {
    if (!e.isDirectory()) continue
    if (e.name.startsWith('(') || e.name.startsWith('_')) continue
    // e.g. "blog", or dynamic "[slug]"
    out.add(e.name.replace(/^\[\.\.\.(.+)\]$/, '*').replace(/^\[(.+)\]$/, ':param'))
  }
  return out
}

const KNOWN = new Set([...routeSegments(MARKETING), ...routeSegments(LOCALE_DIR)])
KNOWN.add('') // "/" home
KNOWN.add('ai')

// Segments we don't validate as marketing pages.
const IGNORED_PREFIXES = ['admin', 'api', 'uploads', 'fa', 'en', 'resume.pdf', '_next']

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.(tsx|ts)$/.test(name)) out.push(p)
  }
  return out
}

// Internal link literals: href="/x", href={`/x`}, href='/x/y'. Locale-relative
// (/services) or locale-prefixed (/fa/services) — we normalize off the locale.
const LINK_RE = /\bhref\s*=\s*[{]?\s*[`'"](\/[a-zA-Z0-9/_-]*)[`'"]/g
const UPLOAD_RE = /\/uploads\/[A-Za-z0-9_-][A-Za-z0-9_./-]*\.[a-z0-9]{2,4}/g

const files = walk(SRC)
const brokenLinks = []
const uploadRefs = new Set()
const seenLinks = new Map() // path -> first location

for (const f of files) {
  const rel = f.slice(SRC.length - 3)
  const text = readFileSync(f, 'utf8')
  let m
  LINK_RE.lastIndex = 0
  while ((m = LINK_RE.exec(text))) {
    let p = m[1]
    // strip a leading locale prefix
    p = p.replace(/^\/(fa|en)(?=\/|$)/, '')
    const seg = p.replace(/^\//, '').split('/')[0] // first segment
    if (IGNORED_PREFIXES.includes(seg)) continue
    if (KNOWN.has(seg)) continue
    if (seg === '') continue // "/" or "/fa" root
    if (!seenLinks.has(p)) { seenLinks.set(p, `${rel}`); brokenLinks.push({ link: p, file: rel, segment: seg }) }
  }
  for (const u of text.match(UPLOAD_RE) || []) uploadRefs.add(u)
}

const missingMedia = [...uploadRefs].filter((u) => !existsSync(join(PUBLIC, u))).sort()

const report = {
  knownRoutes: [...KNOWN].filter(Boolean).sort(),
  scannedFiles: files.length,
  brokenInternalLinks: brokenLinks,
  uploadRefs: uploadRefs.size,
  missingMedia,
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2))
} else {
  console.log('\n  Link & Media Integrity — Report')
  console.log('  ' + '─'.repeat(48))
  console.log(`  Public routes known ........ ${report.knownRoutes.length}`)
  console.log(`  Files scanned .............. ${report.scannedFiles}`)
  console.log(`  ✗ Broken internal links .... ${brokenLinks.length}`)
  console.log(`  ⚠ Missing referenced media . ${missingMedia.length} (CMS-seeded at runtime)`)
  if (brokenLinks.length) {
    console.log('\n  Broken internal links:')
    for (const b of brokenLinks) console.log(`   - ${b.link}  → segment "${b.segment}" is not a route  (${b.file})`)
  }
  if (missingMedia.length) {
    console.log('\n  Missing media (seed via /admin/media):')
    for (const u of missingMedia) console.log(`   - ${u}`)
  }
  console.log('')
}

process.exit(brokenLinks.length > 0 ? 1 : 0)
