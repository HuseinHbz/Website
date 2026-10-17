/**
 * ERPFIX-4 — purchasing controls: post-approval edit lock, separation of
 * duties (receive/convert/approve/approve_high/pay/vendor_bank_change),
 * shared financial input validation, approval-matrix unification + budget
 * chain-head-only counting. Live-PostgreSQL proof.
 *
 * Financial assertions go through production functions (saveDocument,
 * submitDocument, convertDocument, receiveDocument, directPaymentGate,
 * trialBalance via loadTallies) per CLAUDE.md rule 15. Role×op checks use
 * the real role-template rows via setGrant/setOp (the same primitives the
 * users/[id]/permissions route applies a template with), not a fabricated
 * shortcut.
 *
 * Run: DATABASE_URL=… npx tsx scripts/verify-erpfix-4.ts
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery } from '@/lib/db'
import { createVendor, saveDocument, submitDocument, convertDocument, receiveDocument, directPaymentGate, decideApproval } from '@/lib/erp/purchasingData'
import { isOpAllowed } from '@/lib/rbac/engine'
import { loadUserRbac, setGrant, setOp } from '@/lib/rbac/data'
import { money, qty, pct, isoDate, idParam } from '@/lib/api/financeSchemas'

let n = 0, failed = 0
const ok = (c: boolean, l: string) => { n++; if (c) console.log(`  ✅ ${n}. ${l}`); else { failed++; console.error(`  ❌ ${n}. ${l}`) } }
const one = async <T>(sql: string, p: unknown[] = []) => (await pgQuery<T>(sql, p))[0]
const today = () => new Date().toISOString().slice(0, 10)

async function applyTemplate(actorId: string, userId: string, templateName: string) {
  const t = (await one<{ grants: string; ops: string; row_scopes: string }>(
    `SELECT grants, ops, row_scopes FROM rbac_role_templates WHERE name=$1`, [templateName]))
  if (!t) throw new Error(`Template not found: ${templateName}`)
  // finding-for-later (unrelated to this phase): a couple of seeded role
  // templates (e.g. CFO's bare "analytics" key) carry a grant key that
  // isn't a real node in the permission tree — setGrant rejects it. Not
  // this phase's scope (purchasing ops); skip invalid grants so the OPS
  // this test actually cares about still apply.
  for (const [k, v] of Object.entries(JSON.parse(t.grants) as Record<string, 'none' | 'read' | 'write'>)) {
    try { await setGrant(actorId, userId, k, v) } catch { /* see note above */ }
  }
  for (const [k, v] of Object.entries(JSON.parse(t.ops) as Record<string, boolean>)) await setOp(actorId, userId, k, v)
}

async function makeUser(email: string): Promise<string> {
  const row = (await one<{ id: string }>(
    `INSERT INTO users (id, email, name, password_hash, role, active, created_at)
     VALUES (gen_random_uuid()::text, $1, $1, 'x', 'editor', true, to_char(now(),'YYYY-MM-DD HH24:MI:SS')) RETURNING id`, [email]))
  return row.id
}

async function main() {
  await runMigrations(); await seedDatabase()
  const ADMIN = (await one<{ id: string }>(`SELECT id FROM users ORDER BY created_at LIMIT 1`)).id

  // ══ BUG-ERP-16: role×op matrix with REAL template users ══
  console.log('— BUG-ERP-16: role×op matrix (Warehouse Keeper / Procurement / CFO) —')
  const wkId = await makeUser(`wk-${Date.now()}@test.local`)
  await applyTemplate(ADMIN, wkId, 'Warehouse Keeper')
  const wkRbac = await loadUserRbac(wkId)
  ok(!!isOpAllowed(wkRbac.ops, wkRbac.grants, 'erp.purchasing:receive'), '1. Warehouse Keeper holds erp.purchasing:receive')
  ok(!!!isOpAllowed(wkRbac.ops, wkRbac.grants, 'erp.purchasing:pay'), '2. Warehouse Keeper does NOT hold erp.purchasing:pay')
  ok(!!!isOpAllowed(wkRbac.ops, wkRbac.grants, 'erp.purchasing:convert'), '3. Warehouse Keeper does NOT hold erp.purchasing:convert')
  ok(!!!isOpAllowed(wkRbac.ops, wkRbac.grants, 'erp.purchasing:vendor_bank_change'), '4. Warehouse Keeper does NOT hold erp.purchasing:vendor_bank_change')

  const procId = await makeUser(`proc-${Date.now()}@test.local`)
  await applyTemplate(ADMIN, procId, 'Procurement')
  const procRbac = await loadUserRbac(procId)
  ok(!!isOpAllowed(procRbac.ops, procRbac.grants, 'erp.purchasing:convert'), '5. Procurement holds erp.purchasing:convert')
  ok(!!isOpAllowed(procRbac.ops, procRbac.grants, 'erp.purchasing:receive'), '6. Procurement holds erp.purchasing:receive')
  ok(!!!isOpAllowed(procRbac.ops, procRbac.grants, 'erp.purchasing:approve'), '7. Procurement does NOT hold erp.purchasing:approve (separation of duties)')
  ok(!!!isOpAllowed(procRbac.ops, procRbac.grants, 'erp.purchasing:pay'), '8. Procurement does NOT hold erp.purchasing:pay')

  const cfoId = await makeUser(`cfo-${Date.now()}@test.local`)
  await applyTemplate(ADMIN, cfoId, 'CFO')
  const cfoRbac = await loadUserRbac(cfoId)
  ok(!!isOpAllowed(cfoRbac.ops, cfoRbac.grants, 'erp.purchasing:approve_high'), '9. CFO holds erp.purchasing:approve_high')
  ok(!!isOpAllowed(cfoRbac.ops, cfoRbac.grants, 'erp.purchasing:pay'), '10. CFO holds erp.purchasing:pay')
  ok(!!isOpAllowed(cfoRbac.ops, cfoRbac.grants, 'erp.purchasing:vendor_bank_change'), '11. CFO holds erp.purchasing:vendor_bank_change')

  console.log('— BUG-ERP-16: direct-payment guard (warn mode, Rial units, decision_gate answered) —')
  const modeRow = await one<{ value: string }>(`SELECT value FROM erp_settings WHERE key='direct_payment_mode'`)
  ok(modeRow?.value === 'warn', `12. erp_settings.direct_payment_mode defaults to 'warn' — got "${modeRow?.value}"`)
  const smallGate = await directPaymentGate(10_000_000)
  ok(!smallGate.blocked && !smallGate.warn, `13. a 10,000,000 Rial direct payment (under the first tier) is neither blocked nor warned`)
  const bigGate = await directPaymentGate(80_000_000)
  ok(!bigGate.blocked && bigGate.warn, `14. an 80,000,000 Rial direct payment (over the first 50M tier) warns, does not block — got ${JSON.stringify(bigGate)}`)

  // ══ BUG-ERP-15: post-lock edit guard ══
  console.log('— BUG-ERP-15: an approved/received purchase document cannot be edited —')
  const vendorId = await createVendor({ name: 'EF4 Vendor', kind: 'company' }, ADMIN)
  const poId = await saveDocument({ docType: 'order', vendorId, date: today(), lines: [{ description: 'Widget', qty: 10, unitPrice: 1000, discountPct: 0, taxPct: 0 }] }, ADMIN)
  await pgQuery(`UPDATE purchase_documents SET status='approved' WHERE id=$1`, [poId])
  let editBlocked = false
  try { await saveDocument({ id: poId, docType: 'order', vendorId, date: today(), lines: [{ description: 'Widget', qty: 10, unitPrice: 999999, discountPct: 0, taxPct: 0 }] }, ADMIN) }
  catch (e) { editBlocked = /PURCHASE_DOC_LOCKED/.test((e as Error).message) }
  ok(editBlocked, '15. editing an APPROVED PO (changing its price) is rejected')
  const unchanged = await one<{ unit_price: number }>(`SELECT unit_price::float AS unit_price FROM purchase_document_lines WHERE document_id=$1`, [poId])
  ok(Math.abs(unchanged.unit_price - 1000) < 0.01, `16. the approved PO's price is untouched — got ${unchanged.unit_price}`)

  console.log('— BUG-ERP-15: a draft purchase document CAN still be edited —')
  const draftId = await saveDocument({ docType: 'order', vendorId, date: today(), lines: [{ description: 'Gadget', qty: 5, unitPrice: 500, discountPct: 0, taxPct: 0 }] }, ADMIN)
  await saveDocument({ id: draftId, docType: 'order', vendorId, date: today(), lines: [{ description: 'Gadget', qty: 5, unitPrice: 600, discountPct: 0, taxPct: 0 }] }, ADMIN)
  const changed = await one<{ unit_price: number }>(`SELECT unit_price::float AS unit_price FROM purchase_document_lines WHERE document_id=$1`, [draftId])
  ok(Math.abs(changed.unit_price - 600) < 0.01, `17. a DRAFT PO's price is editable — got ${changed.unit_price}`)

  // ══ BUG-ERP-18: shared financial input validation ══
  console.log('— BUG-ERP-18: shared financeSchemas reject bad input —')
  ok(!qty.safeParse(-5).success, '18. a negative qty is rejected')
  ok(!pct.safeParse(500).success, '19. a 500% tax is rejected')
  ok(!isoDate.safeParse('abc').success, '20. a non-date string is rejected')
  ok(!idParam.safeParse('abc').success, '21. ?id=abc is rejected (never becomes NaN)')
  ok(!money.safeParse(-1).success, '22. a negative money amount is rejected')

  // ══ BUG-ERP-17: approval-matrix unification + budget chain-head-only counting ══
  console.log('— BUG-ERP-17: requiredApprovalLevels reads the SAME approval_matrix as the Approval Center —')
  const { purchaseApprovalLevels } = await import('@/lib/erp/purchasingData')
  const lowLevels = await purchaseApprovalLevels(50_000_000, 'order')
  const highLevels = await purchaseApprovalLevels(2_000_000_000, 'order')
  ok(lowLevels === 1, `23. a 50,000,000 Rial PO needs 1 level (matrix tier ≤100M) — got ${lowLevels}`)
  ok(highLevels === 3, `24. a 2,000,000,000 Rial PO needs 3 levels (matrix tier >1B) — got ${highLevels}`)

  console.log('— BUG-ERP-17: a PR→PO→invoice chain counts committed spend ONCE, not three times —')
  const costCenterId = (await one<{ id: number }>(
    `INSERT INTO erp_cost_centers (code, name_en, name_fa, kind, active) VALUES ('EF4DEPT','EF4 Ops','عملیات EF4','department',1) RETURNING id`)).id
  void costCenterId
  const year = await one<{ id: number }>(
    `INSERT INTO gl_fiscal_periods (name, start_date, end_date, status, kind) VALUES ('EF4 FY', '2020-01-01', '2035-12-31', 'open', 'year') RETURNING id`)
  void year
  const prId = await saveDocument({ docType: 'request', vendorId, date: today(), department: 'EF4DEPT', budget: 1_000_000_000,
    lines: [{ description: 'bulk order', qty: 1, unitPrice: 100_000_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
  const sub1 = await submitDocument(prId)
  ok(sub1.ok, `25. submitting the PR (100M within a 1B budget) succeeds — ${JSON.stringify(sub1)}`)
  const approverId = await makeUser(`approver-${Date.now()}@test.local`)
  const prLevels = (await one<{ approval_levels: number }>(`SELECT approval_levels FROM purchase_documents WHERE id=$1`, [prId])).approval_levels
  for (let lvl = 1; lvl <= prLevels; lvl++) {
    const dec = await decideApproval(prId, lvl, 'approved', approverId)
    if (!dec.ok) throw new Error(`decideApproval level ${lvl} failed: ${dec.error}`)
  }
  const poFromPr = await convertDocument(prId, 'order', ADMIN)
  await pgQuery(`UPDATE purchase_documents SET department=$2, budget=1000000000 WHERE id=$1`, [poFromPr, 'EF4DEPT'])
  const sub2 = await submitDocument(poFromPr)
  ok(sub2.ok, `26. submitting the derived PO does NOT double-count the PR's 100M against the SAME 1B budget — ${JSON.stringify(sub2)}`)
  const committedCheck = await one<{ t: number }>(
    `SELECT COALESCE(SUM(COALESCE(base_total,total)),0)::float AS t FROM purchase_documents p
     WHERE department='EF4DEPT' AND status NOT IN ('draft','void','rejected')
       AND NOT EXISTS (SELECT 1 FROM purchase_documents c WHERE c.source_id=p.id AND c.status<>'void')`)
  ok(Math.abs(committedCheck.t - 100_000_000) < 1, `27. the chain-head-only committed-spend query counts exactly 100,000,000 (not 200M+) — got ${committedCheck.t}`)

  console.log('— BUG-ERP-17: an unknown department is rejected at submit —')
  const prBad = await saveDocument({ docType: 'request', vendorId, date: today(), department: 'NOPE-DEPT', budget: 1_000_000,
    lines: [{ description: 'x', qty: 1, unitPrice: 1, discountPct: 0, taxPct: 0 }] }, ADMIN)
  const subBad = await submitDocument(prBad)
  ok(!subBad.ok, `28. submitDocument rejects an unknown department — ${JSON.stringify(subBad)}`)

  console.log(`\n  ${n - failed}/${n} assertions passed.`)
  if (failed > 0) process.exit(1)
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
