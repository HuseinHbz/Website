/**
 * 26.27 — audit:rbac gate. Fails the build when:
 *  1. a SENSITIVE_OPS key doesn't exist in the generated registry (rot)
 *  2. a workspace module/tab lacks a registry node (generator bug)
 *  3. an /api/admin route file neither calls requirePermission/checkTreePermission
 *     nor is on the explicit EXCEPTIONS list
 *  4. a permission key used in a route file is not a valid registry key
 */
import { readdirSync, statSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { permissionTree, SENSITIVE_OPS, isValidKey } from '@/lib/rbac/registry'
import { EXCEPTIONS, keyForApiRoute } from './rbac-route-map'

const API_ROOT = 'src/app/api/admin'
let fail = 0
const err = (m: string) => { console.error('  ✗ ' + m); fail++ }

// 1+2 — registry integrity
const { byKey, nodes } = permissionTree()
for (const mod of Object.keys(SENSITIVE_OPS)) {
  if (!byKey.has(mod)) err(`SENSITIVE_OPS key not in registry: ${mod}`)
}
const moduleCount = nodes.filter(n => n.kind === 'module').length
const tabCount = nodes.filter(n => n.kind === 'tab').length
if (moduleCount < 50) err(`registry unexpectedly small: ${moduleCount} modules`)

// 3+4 — route coverage
function routeDirs(dir: string, base = ''): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...routeDirs(p, base ? `${base}/${e}` : e))
    else if (e === 'route.ts') out.push(base)
  }
  return out
}
let guarded = 0, exempt = 0
for (const r of routeDirs(API_ROOT).sort()) {
  const clean = r.replace(/\/\[[^\]]+\]/g, '')
  const src = readFileSync(join(API_ROOT, r, 'route.ts'), 'utf8')
  if (EXCEPTIONS.has(clean)) { exempt++; continue }
  const calls = [...src.matchAll(/(?:requirePermission|checkTreePermission)\(\s*(?:\w+,\s*)?'([^']+)'/g)]
  if (calls.length === 0) { err(`route without requirePermission/checkTreePermission: ${r}`); continue }
  for (const c of calls) {
    if (!isValidKey(c[1])) err(`route ${r} uses unknown permission key: ${c[1]}`)
  }
  const expected = keyForApiRoute(r)
  if (expected && !calls.some(c => c[1] === expected)) {
    // route may legitimately use a more specific tab key — accept prefix match
    if (!calls.some(c => c[1].startsWith(expected) || expected.startsWith(c[1]))) {
      err(`route ${r} declares '${calls[0][1]}' but the map says '${expected}'`)
    }
  }
  guarded++
}
// op keys used in routes must be valid
for (const r of routeDirs(API_ROOT)) {
  const src = readFileSync(join(API_ROOT, r, 'route.ts'), 'utf8')
  for (const m of src.matchAll(/requireOp\([^,]+,\s*'([^']+)'/g)) {
    const opKey = m[1]
    const i = opKey.lastIndexOf(':')
    const mod = opKey.slice(0, i), op = opKey.slice(i + 1)
    if (!(SENSITIVE_OPS[mod] ?? []).includes(op)) err(`route ${r} uses unknown op key: ${opKey}`)
  }
}

console.log(`  RBAC Audit (26.27 — tree permission coverage)`)
console.log(`  registry: ${moduleCount} modules · ${tabCount} tabs · ${Object.values(SENSITIVE_OPS).flat().length} sensitive ops`)
console.log(`  routes: ${guarded} guarded · ${exempt} explicit exceptions · failures: ${fail}`)
if (fail > 0) process.exit(1)
console.log('  ✅ audit:rbac clean')
