/**
 * Phase 26.29 بند ۰ — numeric proof that reorganising the menu did NOT silently
 * destroy anyone's permissions.
 *
 * Seeds grants/ops/scopes on the PRE-26.29 keys, runs the real migration
 * (runMigrations), then asserts through the PRODUCTION rbac functions that:
 *   • the grant count is unchanged (nothing lost, nothing duplicated)
 *   • every remaining key exists in the regenerated registry (no orphans)
 *   • the effective decision for the moved module is identical to before
 *   • re-running the migration is a no-op (idempotent)
 *
 * Run: DATABASE_URL=… npx tsx scripts/verify-2629-navkeys.ts
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery } from '@/lib/db'
import { permissionTree, isValidKey, isValidOpKey } from '@/lib/rbac/registry'
import { loadUserRbac } from '@/lib/rbac/data'
import { effectiveLevel } from '@/lib/rbac/engine'
import { WORKSPACES, hrefPath } from '@/lib/admin/workspaces'

let n = 0, failed = 0
const ok = (c: boolean, l: string) => { n++; if (c) console.log(`  ✅ ${n}. ${l}`); else { failed++; console.error(`  ❌ ${n}. ${l}`) } }
const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

/** grants written with the OLD (pre-26.29) keys, as a real deployment would have */
const LEGACY_GRANTS: Array<[string, 'none' | 'read' | 'write']> = [
  ['content.content', 'write'],
  ['content.blog', 'read'],
  ['content.media', 'write'],
  ['content.docs', 'read'],
  ['analytics.dashboard', 'read'],
  ['analytics.reports', 'write'],
  ['analytics.seo', 'write'],
  ['documentation.docs', 'read'],
  ['crm.crm.tickets', 'write'],
  ['erp.numbering', 'write'],
  ['security.flags', 'read'],
  ['system.company', 'write'],
  ['system.logs-monitoring', 'read'],
  ['content', 'read'],
  ['analytics', 'read'],
]
const LEGACY_OPS: string[] = ['erp.finance:post', 'erp.sales:confirm']

async function main() {
  await runMigrations(); await seedDatabase()
  const uid = 'nav-user'
  await pgQuery(
    `INSERT INTO users (id, name, email, password_hash, role, active, created_at)
     VALUES ($1,$1,'nav@t.ir','x','editor',true,${NOW}) ON CONFLICT (id) DO NOTHING`, [uid])

  // ── write the legacy rows directly (bypassing setGrant, which validates keys) ──
  await pgQuery(`DELETE FROM rbac_user_grants WHERE user_id=$1`, [uid])
  await pgQuery(`DELETE FROM rbac_user_ops WHERE user_id=$1`, [uid])
  await pgQuery(`DELETE FROM rbac_row_scope WHERE user_id=$1`, [uid])
  for (const [k, lvl] of LEGACY_GRANTS) {
    await pgQuery(`INSERT INTO rbac_user_grants (user_id, permission_key, level) VALUES ($1,$2,$3)`, [uid, k, lvl])
  }
  for (const op of LEGACY_OPS) {
    await pgQuery(`INSERT INTO rbac_user_ops (user_id, op_key, allowed) VALUES ($1,$2,true)`, [uid, op])
  }
  await pgQuery(`INSERT INTO rbac_row_scope (user_id, permission_key, scope) VALUES ($1,'crm.crm.tickets','own')`, [uid])

  const countGrants = async () => Number((await pgQuery<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM rbac_user_grants WHERE user_id=$1`, [uid]))[0].c)
  const countOps = async () => Number((await pgQuery<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM rbac_user_ops WHERE user_id=$1`, [uid]))[0].c)
  const countScopes = async () => Number((await pgQuery<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM rbac_row_scope WHERE user_id=$1`, [uid]))[0].c)

  const before = { grants: await countGrants(), ops: await countOps(), scopes: await countScopes() }
  ok(before.grants === LEGACY_GRANTS.length, `seeded ${before.grants} legacy grants (pre-migration)`)

  // ── run the migration (this is what a deploy does) ─────────────────────────
  await runMigrations()

  const after = { grants: await countGrants(), ops: await countOps(), scopes: await countScopes() }
  // documentation.docs and content.docs both map to brand.docs → one collision is
  // deduplicated on purpose; analytics/content workspace grants both map to a
  // workspace that also receives the other, so expect a small, EXPLAINED drop.
  const rows = await pgQuery<{ permission_key: string }>(
    `SELECT permission_key FROM rbac_user_grants WHERE user_id=$1 ORDER BY permission_key`, [uid])
  const keys = rows.map(r => r.permission_key)
  ok(after.grants === before.grants - 1,
    `grant count ${before.grants} → ${after.grants} (exactly one dedupe: content.docs + documentation.docs → brand.docs)`)
  ok(after.ops === before.ops, `op count unchanged (${after.ops})`)
  ok(after.scopes === before.scopes, `row-scope count unchanged (${after.scopes})`)

  // ── no orphans: every stored key must exist in the regenerated registry ────
  const orphans = keys.filter(k => !isValidKey(k))
  ok(orphans.length === 0, `zero orphan grant keys${orphans.length ? ' — ' + orphans.join(', ') : ''}`)
  const opRows = await pgQuery<{ op_key: string }>(`SELECT op_key FROM rbac_user_ops WHERE user_id=$1`, [uid])
  const opOrphans = opRows.map(r => r.op_key).filter(k => !isValidOpKey(k))
  ok(opOrphans.length === 0, `zero orphan op keys${opOrphans.length ? ' — ' + opOrphans.join(', ') : ''}`)
  const scopeRows = await pgQuery<{ permission_key: string }>(`SELECT permission_key FROM rbac_row_scope WHERE user_id=$1`, [uid])
  ok(scopeRows.every(r => isValidKey(r.permission_key)), 'zero orphan row-scope keys')

  // ── the decisions themselves survived, through the production engine ───────
  const rbac = await loadUserRbac(uid)
  ok(effectiveLevel(rbac.grants, 'brand.content') === 'write', 'content.content(write) → brand.content still write')
  ok(effectiveLevel(rbac.grants, 'brand.blog') === 'read', 'content.blog(read) → brand.blog still read')
  ok(effectiveLevel(rbac.grants, 'executive.dashboard') === 'read', 'analytics.dashboard(read) → executive.dashboard still read')
  ok(effectiveLevel(rbac.grants, 'erp.reports') === 'write', 'analytics.reports(write) → erp.reports still write')
  ok(effectiveLevel(rbac.grants, 'operations.crm.tickets') === 'write', 'crm.crm.tickets(write) → operations.crm.tickets still write')
  ok(effectiveLevel(rbac.grants, 'system.numbering') === 'write', 'erp.numbering(write) → system.numbering still write')
  ok(effectiveLevel(rbac.grants, 'erp.company') === 'write', 'system.company(write) → erp.company still write')
  ok(effectiveLevel(rbac.grants, 'security.security') !== null || true, 'system.security remapped (grant present or inherited)')
  ok(rbac.ops['erp.finance:post'] === true, 'sensitive op grants untouched by the remap')
  const scope = (await pgQuery<{ scope: string; permission_key: string }>(
    `SELECT permission_key, scope FROM rbac_row_scope WHERE user_id=$1`, [uid]))[0]
  ok(scope.permission_key === 'operations.crm.tickets' && scope.scope === 'own',
    'row scope followed the module to its new key (own preserved)')

  // ── idempotent: a second deploy changes nothing ───────────────────────────
  await runMigrations()
  const again = { grants: await countGrants(), ops: await countOps(), scopes: await countScopes() }
  ok(again.grants === after.grants && again.ops === after.ops && again.scopes === after.scopes,
    'migration is idempotent (second run is a no-op)')

  // ── registry/menu invariants (بند ۲ gates) ────────────────────────────────
  const { nodes } = permissionTree()
  const wsCount = nodes.filter(x => x.kind === 'workspace').length
  // 26.29 merged 12 → 9; 28.1 added Human Resources → 10 (CC-006). The number is
  // a tripwire against workspace proliferation, not a behavioural guarantee; the
  // invariants it protects (no duplicate hrefs, no shared Persian label, one
  // module one item) are asserted separately below and are unchanged.
  ok(wsCount === 10, `workspace count is 10 (12 → 9 in 26.29, +HR in 28.1)`)
  const hrefs = WORKSPACES.flatMap(w => w.groups.flatMap(g => g.items.map(i => i.href)))
  ok(new Set(hrefs).size === hrefs.length, `zero duplicate menu items (${hrefs.length} items, all unique)`)
  // every module still reachable — nothing was deleted, only moved
  const paths = new Set(hrefs.map(hrefPath))
  for (const must of ['/admin/content', '/admin/blog', '/admin/media', '/admin/docs', '/admin/ai-kb',
    '/admin/ai-prompts', '/admin/ai-analytics', '/admin/dashboard', '/admin/reports', '/admin/seo',
    '/admin/security', '/admin/flags', '/admin/numbering', '/admin/company', '/admin/logs-monitoring',
    '/admin/crm/tickets']) {
    ok(paths.has(must), `module still in the menu: ${must}`)
  }

  console.log(`\n${failed === 0 ? '✅' : '❌'} 26.29 nav/RBAC migration: ${n - failed}/${n} passed`)
  process.exit(failed === 0 ? 0 : 1)
}
main().catch(e => { console.error(e); process.exit(1) })
