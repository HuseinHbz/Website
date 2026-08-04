/**
 * Phase 27 — live-PostgreSQL proof for opportunities + the loyalty club.
 *
 * The assertion this suite exists for is the LAST one: returning an invoice
 * must take back the points it granted. Points are a liability, so a programme
 * that grants them and cannot claw them back is a programme that leaks money.
 *
 * Everything is asserted through the SAME functions production calls — never a
 * hand-written SQL re-interpretation of the rules (26.26c بند۲).
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery } from '@/lib/db'
import {
  createOpportunity, updateOpportunity, setItems, convertToSalesDocument,
  overview, customerOpportunities,
} from '@/lib/crm/opportunityData'
import {
  activeProgram, accountFor, ledgerOf, postTransaction, earnForInvoice,
  reverseForInvoice, redeemPoints, customerLoyalty, validateCoupon,
  redeemCoupon, loyaltyOverview,
} from '@/lib/crm/loyaltyData'
import { balanceOf } from '@/lib/crm/loyalty'

let pass = 0, fail = 0
function check(label: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { fail++; console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`) }
}

async function main() {
  console.log('\n  Phase 27 — CRM completion, live PostgreSQL\n')

  // The CI runner hands each suite an EMPTY database, so provision it here
  // (idempotent, so a local re-run against an existing DB is also fine).
  await runMigrations()
  await seedDatabase()

  const userId = (await pgQuery<{ id: string }>(`SELECT id FROM users LIMIT 1`))[0]?.id
  if (!userId) throw new Error('no admin user seeded')

  // ── fixtures ──────────────────────────────────────────────────────────────
  const customerId = (await pgQuery<{ id: number }>(
    `INSERT INTO sales_customers (code, name, kind) VALUES ('P27C','P27 Customer','company')
     ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name RETURNING id`))[0].id

  // ══ بند۱ — Opportunity ═════════════════════════════════════════════════════
  console.log('  ── بند۱: فرصت فروش')

  const oppA = await createOpportunity({
    title: 'P27 Network project', amount: 4_000_000, probability: 75,
    stage: 'negotiation', customerId,
  }, userId)
  const oppB = await createOpportunity({
    title: 'P27 Support contract', amount: 1_000_000, probability: 50,
    stage: 'proposal', customerId,
  }, userId)
  check('one customer holds several open deals at once', oppA > 0 && oppB > 0 && oppA !== oppB)

  const ov = await overview()
  const mine = ov.opportunities.filter(o => [oppA, oppB].includes(o.id))
  check('both deals are listed', mine.length === 2)

  // weighted = 4M×75% + 1M×50% = 3M + 500k
  const weighted = mine.reduce((s, o) => s + o.amount * o.probability / 100, 0)
  check('weighted pipeline value', weighted === 3_500_000, `${weighted.toLocaleString()}`)

  const cust = await customerOpportunities(customerId)
  check('Customer 360 sees the open deals', cust.summary.openCount === 2, `open=${cust.summary.openCount}`)

  // proposed lines drive the converted document
  await setItems(oppA, [
    { description: 'Core switch', qty: 2, unitPrice: 1_000_000 },
    { description: 'Installation', qty: 1, unitPrice: 500_000 },
  ])
  const afterItems = (await pgQuery<{ amount: number }>(
    `SELECT amount::float AS amount FROM crm_opportunities WHERE id=$1`, [oppA]))[0]
  check('amount follows the proposed lines', afterItems.amount === 2_500_000, `${afterItems.amount}`)

  // win it, then convert
  await updateOpportunity(oppA, { stage: 'won', probability: 100 })
  const conv = await convertToSalesDocument(oppA, 'invoice', userId)
  check('a won deal converts to a sales document', conv.ok && !!conv.documentId, conv.docNo ?? conv.error)

  const doc = (await pgQuery<{ id: number; total: number; status: string; lines: string }>(
    `SELECT d.id, d.total::float AS total, d.status,
            (SELECT count(*)::text FROM sales_document_lines l WHERE l.document_id=d.id) AS lines
     FROM sales_documents d WHERE d.id=$1`, [conv.documentId!]))[0]
  check('the document carries the proposed lines', doc.lines === '2', `${doc.lines} lines`)
  check('the document total matches the deal', doc.total === 2_500_000, `${doc.total}`)
  check('conversion produces a DRAFT — posting stays a Sales decision', doc.status === 'draft', doc.status)

  const conv2 = await convertToSalesDocument(oppA, 'invoice', userId)
  check('converting twice is idempotent (no duplicate document)',
    conv2.alreadyConverted === true && conv2.documentId === conv.documentId)

  const linked = (await pgQuery<{ sales_document_id: number }>(
    `SELECT sales_document_id FROM crm_opportunities WHERE id=$1`, [oppA]))[0]
  check('two-way link is stored', linked.sales_document_id === conv.documentId)

  // loss requires a reason (enforced in the route; the data layer records it)
  await updateOpportunity(oppB, { stage: 'lost', probability: 0, outcomeReason: 'Price too high' })
  const ov2 = await overview()
  check('loss reason feeds the breakdown',
    ov2.losses.some(l => l.reason === 'Price too high'),
    JSON.stringify(ov2.losses.slice(0, 2)))

  // ══ بند۲ — Loyalty ════════════════════════════════════════════════════════
  console.log('\n  ── بند۲: باشگاه مشتریان')

  // programme + tiers
  const programId = (await pgQuery<{ id: number }>(
    `INSERT INTO loyalty_programs (name_en, name_fa, kind, earn_rate, redeem_rate)
     VALUES ('P27 Club','باشگاه P27','hybrid', 0.001, 10) RETURNING id`))[0].id
  await pgQuery(
    `INSERT INTO loyalty_tiers (program_id, name_en, name_fa, threshold, discount_pct) VALUES
     ($1,'Bronze','برنز',0,0), ($1,'Silver','نقره',1000,5), ($1,'Gold','طلا',5000,10)`, [programId])
  const prog = await activeProgram()
  check('an active programme is found', prog?.id === programId)

  // a CONFIRMED invoice earns
  const invId = (await pgQuery<{ id: number }>(
    `INSERT INTO sales_documents (doc_type, doc_no, customer_id, date, status, subtotal, discount_total, tax_total, total, created_by)
     VALUES ('invoice','P27-INV-1',$1,to_char(now(),'YYYY-MM-DD'),'confirmed',2000000,0,0,2000000,$2) RETURNING id`,
    [customerId, userId]))[0].id

  const earned = await earnForInvoice(invId, userId)
  check('a confirmed invoice earns points', earned.awarded === 2000, `${earned.awarded} pts`)

  const again = await earnForInvoice(invId, userId)
  check('earning is idempotent — a retry cannot mint points twice',
    again.awarded === 0, again.skipped)

  // a DRAFT must not earn
  const draftId = (await pgQuery<{ id: number }>(
    `INSERT INTO sales_documents (doc_type, doc_no, customer_id, date, status, subtotal, discount_total, tax_total, total, created_by)
     VALUES ('invoice','P27-INV-DRAFT',$1,to_char(now(),'YYYY-MM-DD'),'draft',9000000,0,0,9000000,$2) RETURNING id`,
    [customerId, userId]))[0].id
  const draftEarn = await earnForInvoice(draftId, userId)
  check('a DRAFT earns nothing — no liability for an unmade sale', draftEarn.awarded === 0, draftEarn.skipped)

  // tier promotion
  let snap = await customerLoyalty(customerId)
  check('balance reflects the ledger', snap.account?.balance === 2000, `${snap.account?.balance}`)
  check('the customer is promoted to Silver', snap.tier?.nameEn === 'Silver', snap.tier?.nameFa)

  // redeem
  const red = await redeemPoints(customerId, 500, { userId })
  check('redeeming converts points to currency', red.ok && red.value === 5000, `value=${red.value}`)
  snap = await customerLoyalty(customerId)
  check('balance drops after redemption', snap.account?.balance === 1500, `${snap.account?.balance}`)

  const tooMuch = await redeemPoints(customerId, 999_999, { userId })
  check('an over-redemption is REFUSED, not clamped', !tooMuch.ok, tooMuch.error)

  // ── 🔴 the assertion this suite exists for ────────────────────────────────
  const rev = await reverseForInvoice(invId, userId)
  check('returning the invoice reverses its points', rev.reversed === 2000, `${rev.reversed} pts`)

  const accountId = await accountFor(customerId, programId)
  const ledger = await ledgerOf(accountId)
  const bal = balanceOf(ledger)
  // earned 2000, spent 500, reversed 2000 → −500 (the customer spent points the
  // returned invoice had granted). Surfaced, not silently floored at zero.
  check('balance after reversal is arithmetically correct', bal === -500, `${bal}`)
  check('the original earn row SURVIVES — history is not erased',
    ledger.some(t => t.kind === 'earn' && t.points === 2000))
  check('a reversal row was appended', ledger.some(t => t.kind === 'reversal' && t.points === -2000))

  const revAgain = await reverseForInvoice(invId, userId)
  check('reversing twice does not double-subtract', revAgain.reversed === 0, revAgain.skipped)

  // manual correction restores the account, still through the ledger
  await postTransaction(accountId, 'adjust', 500, { note: 'goodwill', userId })
  check('an adjustment is a ledger movement, never a direct balance write',
    balanceOf(await ledgerOf(accountId)) === 0)

  // ── coupons ───────────────────────────────────────────────────────────────
  console.log('\n  ── بند۲: کوپن')
  await pgQuery(
    `INSERT INTO coupons (code, kind, value, min_order_total, max_per_customer, active, created_by)
     VALUES ('P27OFF','percent',10,500000,1,1,$1)`, [userId])

  const okCoupon = await validateCoupon('P27OFF', customerId, 1_000_000)
  check('a valid coupon computes its discount', okCoupon.ok && okCoupon.discount === 100_000, `${okCoupon.discount}`)

  const belowMin = await validateCoupon('P27OFF', customerId, 100_000)
  check('below the minimum order it is refused', !belowMin.ok && belowMin.reason === 'below_minimum')

  const unknown = await validateCoupon('NOPE', customerId, 1_000_000)
  check('an unknown code is refused', !unknown.ok && unknown.reason === 'not_found')

  await redeemCoupon(okCoupon.couponId!, customerId, conv.documentId!, okCoupon.discount)
  const second = await validateCoupon('P27OFF', customerId, 1_000_000)
  check('the per-customer limit is enforced from the DATABASE, not the client',
    !second.ok && second.reason === 'customer_limit_reached')

  const lo = await loyaltyOverview()
  check('club overview reports the outstanding liability',
    typeof lo.liabilityValue === 'number', `${lo.members} members · liability ${lo.liabilityValue}`)

  // ── cleanup ───────────────────────────────────────────────────────────────
  await pgQuery(`DELETE FROM coupon_redemptions WHERE customer_id=$1`, [customerId])
  await pgQuery(`DELETE FROM coupons WHERE code='P27OFF'`)
  await pgQuery(`DELETE FROM loyalty_programs WHERE id=$1`, [programId])
  await pgQuery(`DELETE FROM crm_opportunities WHERE id IN ($1,$2)`, [oppA, oppB])
  await pgQuery(`DELETE FROM sales_document_lines WHERE document_id IN ($1,$2)`, [conv.documentId, invId])
  await pgQuery(`DELETE FROM sales_documents WHERE id IN ($1,$2,$3)`, [conv.documentId, invId, draftId])
  await pgQuery(`DELETE FROM sales_customers WHERE id=$1`, [customerId])

  console.log(`\n  ${fail === 0 ? '✅' : '❌'} Phase 27: ${pass}/${pass + fail} passed\n`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch(e => { console.error('❌', e); process.exit(1) })
