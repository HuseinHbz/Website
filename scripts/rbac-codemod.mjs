/**
 * 26.27 بند ۳ codemod — one-shot migration of /api/admin routes to tree RBAC.
 *  - requireAdmin(...)      → requirePermission('<key>', '<need>'[, legacyAction])
 *  - getAdminUser()+null-guard → inject checkTreePermission(user,'<key>','<need>')
 * need: GET → read, other methods → write. Key comes from rbac-route-map (in-code,
 * never from headers). Financial op branches get requireOp manually afterwards.
 *
 * Run: node --experimental-strip-types? no — run via tsx: npx tsx scripts/rbac-codemod.mjs
 */
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

const API_ROOT = 'src/app/api/admin'

// pull the mapping from the ts module via tsx eval
const mapJson = execSync(`npx tsx -e "
import { permissionTree } from './src/lib/rbac/registry'
import { keyForApiRoute } from './scripts/rbac-route-map'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
function dirs(d, b='') { const o=[]; for (const e of readdirSync(d)) { const p=join(d,e); if (statSync(p).isDirectory()) o.push(...dirs(p, b?b+'/'+e:e)); else if (e==='route.ts') o.push(b) } return o }
const out = {}
for (const r of dirs('${API_ROOT}')) out[r] = keyForApiRoute(r)
console.log(JSON.stringify(out))
"`, { encoding: 'utf8' }).trim().split('\n').pop()
const MAP = JSON.parse(mapJson)

const HANDLER_RE = /export async function (GET|POST|PUT|DELETE|PATCH)\b/g

let migrated = 0, injected = 0, skipped = []
for (const [route, key] of Object.entries(MAP)) {
  const file = join(API_ROOT, route, 'route.ts')
  if (!key) { skipped.push(route); continue }
  let src = readFileSync(file, 'utf8')
  const orig = src

  // handler regions: [start, end, method]
  const marks = []
  let m
  HANDLER_RE.lastIndex = 0
  while ((m = HANDLER_RE.exec(src))) marks.push({ i: m.index, method: m[1] })
  marks.push({ i: src.length, method: null })

  let out = src.slice(0, marks[0]?.i ?? 0)
  for (let h = 0; h < marks.length - 1; h++) {
    let body = src.slice(marks[h].i, marks[h + 1].i)
    const need = marks[h].method === 'GET' ? 'read' : 'write'
    // requireAdmin('action') / requireAdmin()
    body = body.replace(/requireAdmin\(\s*'([^']+)'\s*\)/g, `requirePermission('${key}', '${need}', '$1')`)
    body = body.replace(/requireAdmin\(\s*\)/g, `requirePermission('${key}', '${need}')`)
    // getAdminUser + null guard → inject tree check (only when no requirePermission already in this handler)
    if (!body.includes('requirePermission(')) {
      body = body.replace(
        /(const (\w+) = await getAdminUser\(\)\s*\n(\s*)if \(!\2\)[^\n]+\n)/,
        (full, block, varName, indent) =>
          `${block}${indent}{ const deny = await checkTreePermission(${varName}, '${key}', '${need}'); if (deny) return deny }\n`,
      )
      if (body.includes('checkTreePermission(')) injected++
    }
    out += body
  }
  src = out

  if (src !== orig) {
    // fix imports
    if (src.includes('requirePermission(') && !/import[^\n]*requirePermission/.test(src)) {
      if (/from '@\/lib\/api\/respond'/.test(src)) {
        src = src.replace(/import \{([^}]*)\} from '@\/lib\/api\/respond'/, (f, names) => {
          const list = names.split(',').map(s => s.trim()).filter(Boolean)
          if (!list.includes('requirePermission')) list.push('requirePermission')
          const cleaned = src.includes('requireAdmin(') ? list : list.filter(n => n !== 'requireAdmin')
          return `import { ${cleaned.join(', ')} } from '@/lib/api/respond'`
        })
      } else {
        src = src.replace(/(import[^\n]+\n)/, `$1import { requirePermission } from '@/lib/api/respond'\n`)
      }
    }
    if (src.includes('checkTreePermission(') && !/import[^\n]*checkTreePermission/.test(src)) {
      if (/from '@\/lib\/api\/respond'/.test(src)) {
        src = src.replace(/import \{([^}]*)\} from '@\/lib\/api\/respond'/, (f, names) => {
          const list = names.split(',').map(s => s.trim()).filter(Boolean)
          if (!list.includes('checkTreePermission')) list.push('checkTreePermission')
          return `import { ${list.join(', ')} } from '@/lib/api/respond'`
        })
      } else {
        src = src.replace(/(import[^\n]+\n)/, `$1import { checkTreePermission } from '@/lib/api/respond'\n`)
      }
    }
    writeFileSync(file, src)
    migrated++
  }
}
console.log(`migrated files: ${migrated} · injected tree-checks: ${injected} · exceptions: ${skipped.length} (${skipped.join(', ')})`)
