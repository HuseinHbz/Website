/**
 * Phase 26.28 بند ۴ — ABAC/2FA-policy security matrix (live PostgreSQL).
 *
 * Everything asserts through the PRODUCTION functions (R3): rowScopeSql /
 * rowInScope / stripFields / sensitiveFieldVisible from rbac/data, requireOp
 * from api/respond (the exact gate the routes call). HTTP-level enforcement is
 * covered by audit:rbac + e2e/rbac.spec.ts.
 *
 * Run: DATABASE_URL=… npx tsx scripts/verify-2628-abac.ts
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery } from '@/lib/db'
import { setGrant, setOp, setRowScope, rowScopeFor, rowScopeSql, rowInScope, stripFields, sensitiveFieldVisible } from '@/lib/rbac/data'
import { SCOPED_MODULES, SENSITIVE_FIELDS } from '@/lib/rbac/registry'
import { requireOp } from '@/lib/api/respond'
import type { AdminUser } from '@/lib/admin/auth'

let n = 0, failed = 0
const ok = (c: boolean, l: string) => { n++; if (c) console.log(`  ✅ ${n}. ${l}`); else { failed++; console.error(`  ❌ ${n}. ${l}`) } }
const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

async function mkUser(id: string, email: string, role = 'editor', department: string | null = null): Promise<string> {
  await pgQuery(
    `INSERT INTO users (id, name, email, password_hash, role, active, department, created_at)
     VALUES ($1,$2,$3,'x',$4,true,$5,${NOW}) ON CONFLICT (id) DO NOTHING`, [id, id, email, role, department])
  return id
}

async function main() {
  await runMigrations(); await seedDatabase()
  const admin = await mkUser('ab-admin', 'aa@t.ir', 'super_admin', 'HQ')
  const rep = await mkUser('ab-rep', 'ar@t.ir', 'editor', 'sales')       // scope=own
  const mate = await mkUser('ab-mate', 'am@t.ir', 'editor', 'sales')     // same department
  const other = await mkUser('ab-other', 'ao@t.ir', 'editor', 'ops')     // different department
  const zero = await mkUser('ab-zero', 'az@t.ir', 'editor', null)        // zero rbac rows (R5)

  // ── بند ۲: registry only advertises real scopes ───────────────────────────
  ok(Object.keys(SCOPED_MODULES).length >= 5, `SCOPED_MODULES declares ${Object.keys(SCOPED_MODULES).length} modules with a real implementation`)
  ok(!Object.values(SCOPED_MODULES).some(v => (v as string[]).includes('company')), 'company scope NOT advertised (users carry no company_id — no empty promises)')

  // ── seed leads with different owners ──────────────────────────────────────
  const mkLead = async (name: string, owner: string) =>
    (await pgQuery<{ id: number }>(`INSERT INTO crm_leads (name, source, status, owner_id) VALUES ($1,'other','new',$2) RETURNING id`, [name, owner]))[0].id
  const lRep = await mkLead('rep lead', rep)
  const lMate = await mkLead('mate lead', mate)
  const lOther = await mkLead('other lead', other)

  // ── بند ۲.۱: rowScopeSql produces the WHERE the routes run ────────────────
  await setGrant(admin, rep, 'crm', 'write')
  await setRowScope(admin, rep, 'crm.crm', 'own')
  let sc = await rowScopeSql(rep, 'crm.crm', 'l.owner_id', 1)
  let rows = await pgQuery<{ id: number }>(`SELECT l.id FROM crm_leads l WHERE 1=1${sc.clause}`, sc.params)
  ok(rows.some(r => r.id === lRep) && !rows.some(r => r.id === lMate) && !rows.some(r => r.id === lOther),
    'scope=own: list WHERE returns only the caller\'s rows')

  await setRowScope(admin, rep, 'crm.crm', 'department')
  sc = await rowScopeSql(rep, 'crm.crm', 'l.owner_id', 1)
  rows = await pgQuery<{ id: number }>(`SELECT l.id FROM crm_leads l WHERE 1=1${sc.clause}`, sc.params)
  ok(rows.some(r => r.id === lRep) && rows.some(r => r.id === lMate) && !rows.some(r => r.id === lOther),
    'scope=department: same-department rows visible, other departments filtered out')

  // ── بند ۲.۲: direct-record guard (404 path) ───────────────────────────────
  await setRowScope(admin, rep, 'crm.crm', 'own')
  ok((await rowInScope(rep, 'crm.crm', rep)) === true, 'rowInScope: own record allowed')
  ok((await rowInScope(rep, 'crm.crm', other)) === false, 'rowInScope: foreign record refused → route answers 404 (existence not leaked)')
  ok((await rowInScope(rep, 'crm.crm', null)) === false, 'rowInScope: unowned record refused under a restrictive scope')
  await setRowScope(admin, rep, 'crm.crm', 'department')
  ok((await rowInScope(rep, 'crm.crm', mate)) === true, 'rowInScope: department scope allows a same-department colleague')
  ok((await rowInScope(rep, 'crm.crm', other)) === false, 'rowInScope: department scope refuses another department')

  // ── بند ۲.۴ / R5: zero scope rows → all (exact legacy) ────────────────────
  ok((await rowScopeFor(zero, 'crm.crm')) === 'all', 'R5: user with no scope rows → all (today\'s behaviour)')
  ok((await rowInScope(zero, 'crm.crm', other)) === true, 'R5: scope=all sees every record')
  const zsc = await rowScopeSql(zero, 'crm.crm', 'l.owner_id', 1)
  ok(zsc.clause === '' && zsc.params.length === 0, 'R5: scope=all adds NOTHING to the query')

  // ── sales documents owner expression (customer owner ← creator fallback) ──
  const cust = (await pgQuery<{ id: number }>(
    `INSERT INTO sales_customers (code,name,kind,owner_id,updated_at) VALUES ('AB-1','c1','company',$1,${NOW}) RETURNING id`, [rep]))[0]
  await pgQuery(
    `INSERT INTO sales_documents (doc_type,doc_no,customer_id,date,status,subtotal,total,exchange_rate,created_by,updated_at)
     VALUES ('invoice','AB-INV-1',$1,'2026-08-01','draft',100,100,1,$2,${NOW})`, [cust.id, other])
  const docOwner = (await pgQuery<{ owner: string }>(
    `SELECT COALESCE(c.owner_id, d.created_by) AS owner FROM sales_documents d JOIN sales_customers c ON c.id=d.customer_id WHERE d.doc_no='AB-INV-1'`))[0]
  ok(docOwner.owner === rep, 'sales doc owner = customer owner (falls back to creator only when unowned)')

  // ── بند ۳: stripFields removes the KEY (not null/undefined) ───────────────
  const stripped = stripFields([{ sku: 'A', value: 10, avgCost: 5 }], ['value', 'avgCost'])
  ok(!('value' in stripped[0]) && !('avgCost' in stripped[0]) && stripped[0].sku === 'A',
    'stripFields: sensitive keys ABSENT from payload, others intact')
  ok(!!SENSITIVE_FIELDS['erp.inventory:cost_view'], 'SENSITIVE_FIELDS registry documents the covered routes/fields')
  await setGrant(admin, rep, 'erp.inventory', 'read')
  ok((await sensitiveFieldVisible(rep, 'erp.inventory:cost_view')) === false, 'rbac-managed user without cost_view → cost fields hidden')
  ok((await sensitiveFieldVisible(zero, 'erp.inventory:cost_view')) === true, 'R5: legacy user still sees cost fields')

  // ── بند ۱.۵: mandatory-2FA policy inside requireOp (the production gate) ──
  await setOp(admin, rep, 'erp.finance:post', true)
  const repUser: AdminUser = { id: rep, name: rep, email: 'ar@t.ir', role: 'editor' }
  await pgQuery(`UPDATE erp_settings SET value='1' WHERE key='2fa_required_sensitive'`)
  const denied = await requireOp(repUser, 'erp.finance:post', 'edit')
  ok(denied !== null && denied.status === 403, 'policy ON + financial op + no 2FA → requireOp 403 (loud, with reason)')
  await pgQuery(`UPDATE users SET totp_enabled=true WHERE id=$1`, [rep])
  ok((await requireOp(repUser, 'erp.finance:post', 'edit')) === null, 'policy ON + 2FA enabled → op allowed')
  await pgQuery(`UPDATE users SET totp_enabled=false WHERE id=$1`, [rep])
  const backupDenied = await requireOp(repUser, 'backup.backup:restore', 'manage_settings')
  ok(backupDenied !== null && backupDenied.status === 403, 'backup.backup:restore is under the mandatory-2FA policy too (26.28 بند ۱)')
  await pgQuery(`UPDATE erp_settings SET value='0' WHERE key='2fa_required_sensitive'`)
  ok((await requireOp(repUser, 'erp.finance:post', 'edit')) === null, 'policy OFF (default) → exact legacy behaviour (R5)')

  console.log(`\n${failed === 0 ? '✅' : '❌'} 26.28 ABAC matrix: ${n - failed}/${n} passed`)
  process.exit(failed === 0 ? 0 : 1)
}
main().catch(e => { console.error(e); process.exit(1) })
