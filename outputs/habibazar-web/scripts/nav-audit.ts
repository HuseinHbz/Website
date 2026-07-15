#!/usr/bin/env tsx
/**
 * Navigation integrity audit (Phase 26.26, BUG-010 regression gate). Fails the
 * build if any admin nav registry item resolves to a workspace that does NOT
 * contain it — i.e. a ?tab= or hyphen-sibling href silently jumping to the
 * executive fallback. Closes the BUG-010 class forever.
 *
 *   tsx scripts/nav-audit.ts [--json]
 */
import { WORKSPACES, workspaceForPath, hrefPath } from '../src/lib/admin/workspaces'

const contains = (wsId: string, path: string) => {
  const ws = WORKSPACES.find(w => w.id === wsId)
  return !!ws && ws.groups.some(g => g.items.some(it => hrefPath(it.href) === path))
}

const violations: { href: string; ownedBy: string; resolvesTo: string }[] = []
let checked = 0
for (const ws of WORKSPACES) {
  for (const g of ws.groups) {
    for (const it of g.items) {
      checked++
      const path = hrefPath(it.href)
      const resolved = workspaceForPath(path)
      if (!contains(resolved.id, path)) violations.push({ href: it.href, ownedBy: ws.id, resolvesTo: resolved.id })
    }
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ checked, violations }, null, 2))
} else {
  console.log('\n  Navigation Integrity — Report')
  console.log('  ' + '─'.repeat(48))
  console.log(`  Registry items checked ..... ${checked}`)
  console.log(`  ✗ Mis-resolved items ....... ${violations.length}  (budget 0)`)
  for (const v of violations) console.log(`   - ${v.href}  (in '${v.ownedBy}') → resolves to '${v.resolvesTo}' (does not contain it)`)
  console.log('')
}

process.exit(violations.length > 0 ? 1 : 0)
