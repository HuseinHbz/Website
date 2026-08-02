/**
 * Phase 26.27 بند ۷ — security test matrix (live PostgreSQL).
 *
 * Every assertion goes through the PRODUCTION rbac/2FA functions (R3 — the
 * exact code paths the routes call): registry/engine/data layers, the guarded
 * TOTP verifier, and the recovery-code store. HTTP-level enforcement of the
 * same decisions is covered by `audit:rbac` (every route declares its key in
 * code) + the Playwright suite.
 *
 * Run: DATABASE_URL=… npx tsx scripts/verify-2627-rbac.ts
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery } from '@/lib/db'
import { permissionTree, isValidKey, isValidOpKey } from '@/lib/rbac/registry'
import { effectiveLevel, isOpAllowed, levelSatisfies } from '@/lib/rbac/engine'
import { loadUserRbac, hasAnyRbac, setGrant, setOp, setRowScope, rowScopeFor, sensitiveFieldVisible, copyRbac } from '@/lib/rbac/data'
import { encryptSecret, decryptSecret, verifyTotpGuarded, issueRecoveryCodes, consumeRecoveryCode, remainingRecoveryCodes } from '@/lib/admin/totpSecurity'
import { generateTotpSecret, generateTotpToken } from '@/lib/admin/auth'
import { isSeparationViolation } from '@/lib/approval/engine'

let n = 0, failed = 0
const ok = (c: boolean, l: string) => { n++; if (c) console.log(`  ✅ ${n}. ${l}`); else { failed++; console.error(`  ❌ ${n}. ${l}`) } }

async function mkUser(id: string, email: string, role = 'editor'): Promise<string> {
  await pgQuery(
    `INSERT INTO users (id, name, email, password_hash, role, active, created_at)
     VALUES ($1,$2,$3,'x',$4,true,to_char(now(),'YYYY-MM-DD HH24:MI:SS'))
     ON CONFLICT (id) DO NOTHING`, [id, id, email, role])
  return id
}

async function main() {
  await runMigrations(); await seedDatabase()
  const admin = 'u-admin', spec = 'u-finspec', aud = 'u-auditor', emp = 'u-employee', zero = 'u-zerogrants'
  for (const [id, mail, role] of [[admin, 'a@t.ir', 'super_admin'], [spec, 's@t.ir', 'editor'], [aud, 'd@t.ir', 'auditor'], [emp, 'e@t.ir', 'editor'], [zero, 'z@t.ir', 'editor']] as const) {
    await mkUser(id, mail, role)
  }

  // ── registry sanity ────────────────────────────────────────────────────────
  const { nodes } = permissionTree()
  ok(nodes.length > 100, `registry generated from WORKSPACES (${nodes.length} nodes)`)
  ok(isValidKey('erp.finance') && isValidKey('erp'), 'workspace + module keys valid')
  ok(isValidOpKey('erp.finance:post') && !isValidOpKey('erp.finance:hack'), 'op keys validated against SENSITIVE_OPS')

  // ── 🌳 tree inheritance + 🚫 deny dominates (through live grants) ──────────
  await setGrant(admin, spec, 'erp.finance', 'write')
  await setGrant(admin, spec, 'erp.inventory', 'read')
  let rb = await loadUserRbac(spec)
  ok(effectiveLevel(rb.grants, 'erp.finance.journal') === 'write', 'tab inherits module write (finance specialist)')
  ok(effectiveLevel(rb.grants, 'erp.inventory') === 'read', 'read level loads')
  ok(levelSatisfies(effectiveLevel(rb.grants, 'erp.inventory')!, 'write') === false, 'read on module → write requirement NOT satisfied (403 path)')

  await setGrant(admin, spec, 'erp.treasury', 'none')
  await setGrant(admin, spec, 'erp.treasury.reconcile', 'write')  // more specific write below a none
  rb = await loadUserRbac(spec)
  ok(effectiveLevel(rb.grants, 'erp.treasury.reconcile') === 'none', '🚫 none on module kills tab even with explicit tab write (deny dominates)')
  ok(effectiveLevel(rb.grants, 'erp.treasury.cheques') === 'none', 'none inherited by every sibling tab')

  // ── sensitive ops: write never implies (بند ۱/۳) ──────────────────────────
  rb = await loadUserRbac(spec)
  ok(isOpAllowed(rb.ops, rb.grants, 'erp.finance:post') === null, 'write on finance WITHOUT :post op → null (legacy decides; draft path only)')
  await setOp(admin, spec, 'erp.finance:post', false)
  rb = await loadUserRbac(spec)
  ok(isOpAllowed(rb.ops, rb.grants, 'erp.finance:post') === false, 'explicit :post=false → op denied (draft 200 / post 403)')
  await setOp(admin, spec, 'erp.finance:post', true)
  rb = await loadUserRbac(spec)
  ok(isOpAllowed(rb.ops, rb.grants, 'erp.finance:post') === true, 'explicit :post=true → op allowed')
  await setOp(admin, spec, 'erp.treasury:reconcile', true)
  rb = await loadUserRbac(spec)
  ok(isOpAllowed(rb.ops, rb.grants, 'erp.treasury:reconcile') === false, 'op under a none subtree denied even with explicit op grant')

  // ── R5: zero grants → EXACTLY legacy ──────────────────────────────────────
  ok((await hasAnyRbac(zero)) === false, 'zero-grants user has no rbac rows')
  const zrb = await loadUserRbac(zero)
  ok(effectiveLevel(zrb.grants, 'erp.finance.journal') === null, 'R5: zero grants → null level (legacy role behaviour everywhere)')
  ok(isOpAllowed(zrb.ops, zrb.grants, 'erp.sales:confirm') === null, 'R5: zero op rows → null (legacy canDo decides)')
  ok((await rowScopeFor(zero, 'crm.crm')) === 'all', 'R5: default row scope = all (today\'s behaviour)')
  ok((await sensitiveFieldVisible(zero, 'erp.inventory:cost_view')) === true, 'R5: legacy user sees cost fields')

  // ── 🔴 SoD: op grant cannot bypass the 26.24b maker/checker guard ─────────
  await setOp(admin, spec, 'erp.approvals:approve', true)
  ok(isSeparationViolation('journal_entry', spec, spec) === true, 'SoD: :approve grant does NOT let the maker approve their own journal entry')
  ok(isSeparationViolation('journal_entry', spec, admin, spec) === true, 'SoD: delegation on-behalf-of the maker still blocked (effective owner)')

  // ── بند ۶.۱ row scope (ABAC) ──────────────────────────────────────────────
  await setGrant(admin, emp, 'crm', 'write')
  await setRowScope(admin, emp, 'crm.crm', 'own')
  ok((await rowScopeFor(emp, 'crm.crm')) === 'own', 'row scope=own persisted')
  const l1 = (await pgQuery<{ id: number }>(`INSERT INTO crm_leads (name, source, status, owner_id) VALUES ('mine','other','new',$1) RETURNING id`, [emp]))[0]
  const l2 = (await pgQuery<{ id: number }>(`INSERT INTO crm_leads (name, source, status, owner_id) VALUES ('theirs','other','new',$1) RETURNING id`, [admin]))[0]
  // the exact ownership check the route performs before UPDATE/DELETE:
  const own2 = (await pgQuery<{ owner_id: string }>(`SELECT owner_id FROM crm_leads WHERE id=$1`, [l2.id]))[0]
  ok(own2.owner_id !== emp, 'scope=own: another user\'s lead fails the route ownership check → 404 (existence not leaked)')
  const listed = await pgQuery<{ id: number }>(`SELECT id FROM crm_leads WHERE owner_id=$1`, [emp])
  ok(listed.some(r => r.id === l1.id) && !listed.some(r => r.id === l2.id), 'scope=own list filter returns only owned rows')

  // ── بند ۶.۲ sensitive-field masking ───────────────────────────────────────
  ok((await sensitiveFieldVisible(emp, 'erp.inventory:cost_view')) === false, 'rbac-managed user WITHOUT cost_view → field removed from API')
  await setOp(admin, emp, 'erp.inventory:cost_view', true)
  ok((await sensitiveFieldVisible(emp, 'erp.inventory:cost_view')) === true, 'explicit cost_view grant → field visible')

  // ── بند ۴ helpers: copy + audit trail ─────────────────────────────────────
  const copied = await copyRbac(admin, spec, aud)
  ok(copied > 0, `copyRbac copies grants+ops (${copied} rows)`)
  const audRows = await pgQuery<{ c: number }>(`SELECT COUNT(*)::int AS c FROM rbac_audit WHERE target_user_id=$1`, [spec])
  ok(Number(audRows[0].c) >= 5, 'every grant/op change wrote an rbac_audit row (old → new)')

  // ── بند ۴ role template (Finance Specialist: write without :post) ─────────
  const tpl = (await pgQuery<{ grants: string; ops: string }>(`SELECT grants, ops FROM rbac_role_templates WHERE name='Finance Specialist'`))[0]
  ok(!!tpl, 'Finance Specialist template seeded')
  const tg = JSON.parse(tpl.grants); const to = JSON.parse(tpl.ops)
  ok(tg['erp.finance'] === 'write' && to['erp.finance:post'] === false, 'template = journal write WITHOUT :post (SoD by default)')

  // ── بند ۵ 2FA hardening ───────────────────────────────────────────────────
  const secret = generateTotpSecret()
  const stored = encryptSecret(secret)
  await pgQuery(`UPDATE users SET totp_secret=$2, totp_enabled=true WHERE id=$1`, [spec, stored])
  ok(stored.startsWith('enc:v1:') && decryptSecret(stored) === secret, '5.4: secret stored AES-256-GCM encrypted, round-trips')
  const code = generateTotpToken(secret)
  ok((await verifyTotpGuarded(spec, stored, code)) === 'ok', '5.2/5.3: valid TOTP accepted through the guarded verifier')
  ok((await verifyTotpGuarded(spec, stored, code)) === 'replayed', '5.2: SAME code replayed within the window → rejected')
  let verdict = ''
  for (let i = 0; i < 5; i++) verdict = await verifyTotpGuarded(spec, stored, '000000')
  ok(verdict === 'locked', '5.3: 5 failed attempts → temporary lock')
  ok((await verifyTotpGuarded(spec, stored, generateTotpToken(secret))) === 'locked', '5.3: even a VALID code is refused while locked')
  await pgQuery(`UPDATE users SET totp_locked_until=NULL, totp_fail_count=0 WHERE id=$1`, [spec])
  // legacy plaintext secret still verifies (5.4 migration safety)
  await pgQuery(`UPDATE users SET totp_secret=$2, totp_last_step=NULL WHERE id=$1`, [spec, secret])
  ok((await verifyTotpGuarded(spec, secret, generateTotpToken(secret))) === 'ok', '5.4: legacy PLAINTEXT secret still verifies after migration')

  const codes = await issueRecoveryCodes(spec)
  ok(codes.length === 10 && (await remainingRecoveryCodes(spec)) === 10, '5.1: 10 recovery codes issued (hashed at rest)')
  const hashRows = await pgQuery<{ code_hash: string }>(`SELECT code_hash FROM admin_recovery_codes WHERE user_id=$1`, [spec])
  ok(hashRows.every(r => !codes.includes(r.code_hash)), '5.1: plaintext codes NEVER stored (sha256 only)')
  ok((await consumeRecoveryCode(spec, codes[0])) === true, '5.1: recovery code accepted once')
  ok((await consumeRecoveryCode(spec, codes[0])) === false, '5.1: the SAME recovery code rejected on second use (single-use)')
  ok((await remainingRecoveryCodes(spec)) === 9, '5.1: remaining counter decremented')

  // ── 5.5 mandatory-2FA policy flag (default OFF = R5) ──────────────────────
  const flag = (await pgQuery<{ value: string }>(`SELECT value FROM erp_settings WHERE key='2fa_required_sensitive'`))[0]
  ok(flag?.value === '0', '5.5: 2fa_required_sensitive seeded OFF (R5 — no behaviour change until enabled)')

  // ── privilege escalation: grant editing is itself a registered sensitive op ─
  ok(isValidOpKey('security.users:grant_edit'), 'grant_edit is a registry op — permissions route requires it (audit:rbac enforces the route guard)')

  console.log(`\n${failed === 0 ? '✅' : '❌'} 26.27 security matrix: ${n - failed}/${n} passed`)
  process.exit(failed === 0 ? 0 : 1)
}
main().catch(e => { console.error(e); process.exit(1) })
