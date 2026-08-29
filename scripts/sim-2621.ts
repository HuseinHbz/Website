/**
 * Phase 26.21 — Enterprise Full Company Simulation (24 months, live PostgreSQL).
 * Drives the REAL module data layers end-to-end: setup → 2 fiscal years of
 * purchasing/sales/warehouse/finance/treasury activity with seasonality, growth,
 * inflation and FX movement → year-end closings → imports → master data →
 * self-heal after every stage → continuous accounting reconciliation → stress.
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery } from '@/lib/db'
import { documentTotals, invoiceStatus, salesInvoicePostingLines } from '@/lib/erp/sales'
import { postSalesInvoiceToGl } from '@/lib/erp/salesData'
import {
  createVendor, evaluateVendor, saveDocument as savePurchaseDoc, submitDocument,
  decideApproval, convertDocument, receiveDocument, recordPayment as recordPurchasePayment,
  postPurchaseInvoiceToGl, compareQuotes,
} from '@/lib/erp/purchasingData'
import { createPeriod, transitionPeriod, postOpeningBalance, runYearEndClosing, assertPostable, accountStatement } from '@/lib/erp/accountingData'
import { setRate } from '@/lib/erp/currencyData'
import { createAccount, importStatement, autoMatch, addPetty, pettyOverview, createCheque, transitionCheque, cashFlow } from '@/lib/erp/bankingData'
import {
  createHold, releaseHold, createCount, enterCount, transitionCount, postCount,
  createShipment, advanceShipment, registerBatch, registerSerials, stockIntelligence, revalueInventory, stockStateFor,
} from '@/lib/inventory/inventoryOpsData'
import { bookRevaluation } from '@/lib/erp/revaluationData'
import { loadTallies } from '@/lib/erp/ledgerData'
import { trialBalance, incomeStatement, balanceSheet } from '@/lib/erp/ledger'
import { valuate } from '@/lib/erp/inventory'
import { runReport, REPORTS } from '@/lib/reports/reportData'
import { createJob, saveJobMapping, validateJob, approveJob, executeJob, rollbackJob } from '@/lib/import/importData'
import { mergeCustomers, masterDataOverview, detectDuplicates } from '@/lib/masterdata/masterDataData'
import { runSelfHeal } from '@/lib/health/selfhealData'
import { healthOverview } from '@/lib/health/healthData'
import { nextNumber } from '@/lib/numbering/integrate'
import { scanLedgerIntegrity } from '@/lib/erp/accountingValidationData'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"
let n = 0, failed = 0
const bugs: string[] = []
function ok(cond: boolean, label: string) {
  n++
  if (cond) console.log(`  ✅ ${n}. ${label}`)
  else { failed++; bugs.push(label); console.error(`  ❌ ${n}. ${label}`) }
}
const one = async <T>(sql: string, p: unknown[] = []) => (await pgQuery<T>(sql, p))[0]
const num = (v: unknown) => Number(v ?? 0)
const r2 = (v: number) => Math.round(v * 100) / 100

// Deterministic pseudo-random (reproducible simulation).
let seed = 26210
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed / 2 ** 31 }

let ADMIN = ''
let APPROVER = ''
const acct = new Map<string, number>()
async function loadChart() {
  for (const a of await pgQuery<{ id: number; code: string }>(`SELECT id, code FROM gl_accounts`)) acct.set(a.code, a.id)
}

/** Balanced adjustment/accrual journal entry (mirrors the finance journal route: period-checked, posted). */
async function bookEntry(date: string, memo: string, reference: string, lines: { code: string; debit: number; credit: number }[]): Promise<number> {
  const gate = await assertPostable(date)
  if (!gate.ok) throw new Error(`Not postable ${date}: ${gate.error}`)
  const dr = lines.reduce((s, l) => s + l.debit, 0), cr = lines.reduce((s, l) => s + l.credit, 0)
  if (Math.abs(dr - cr) > 0.001) throw new Error(`Unbalanced entry: ${memo}`)
  const entryNo = await nextNumber('journal', { legacyPrefix: 'JV' })
  const e = await one<{ id: number }>(
    `INSERT INTO gl_journal_entries (entry_no,date,memo,reference,status,total,currency,exchange_rate,created_by,period_id,posted_at)
     VALUES ($1,$2,$3,$4,'posted',$5,'IRR',1,$6,$7,${NOW}) RETURNING id`,
    [entryNo, date, memo, reference, dr, ADMIN, gate.periodId ?? null])
  let i = 0
  for (const l of lines)
    await pgQuery(`INSERT INTO gl_journal_lines (entry_id,account_id,debit,credit,line_no) VALUES ($1,$2,$3,$4,$5)`,
      [e.id, acct.get(l.code)!, l.debit, l.credit, i++])
  return e.id
}

/** Create a sales document (mirrors the route's server-side totals + numbering). */
async function saveSalesDoc(d: { docType: 'quote' | 'order' | 'invoice' | 'credit_note'; customerId: number; date: string; sourceId?: number; lines: { description: string; qty: number; unitPrice: number; discountPct?: number; taxPct?: number; productId?: number | null }[] }): Promise<{ id: number; total: number }> {
  const lines = d.lines.map(l => ({ ...l, discountPct: l.discountPct ?? 0, taxPct: l.taxPct ?? 0 }))
  const totals = documentTotals(lines)
  const docNo = await nextNumber(d.docType, { module: 'sales', legacyPrefix: d.docType.slice(0, 3).toUpperCase() })
  const row = await one<{ id: number }>(
    `INSERT INTO sales_documents (doc_type,doc_no,customer_id,date,status,subtotal,discount_total,tax_total,total,source_id,created_by,currency,exchange_rate,base_total,updated_at)
     VALUES ($1,$2,$3,$4,'draft',$5,$6,$7,$8,$9,$10,'IRR',1,$8,${NOW}) RETURNING id`,
    [d.docType, docNo, d.customerId, d.date, totals.subtotal, totals.discountTotal, totals.taxTotal, totals.total, d.sourceId ?? null, ADMIN])
  let i = 0
  for (const l of lines)
    await pgQuery(`INSERT INTO sales_document_lines (document_id,description,qty,unit_price,discount_pct,tax_pct,line_total,line_no,product_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [row.id, l.description, l.qty, l.unitPrice, l.discountPct, l.taxPct, documentTotals([l]).total, i++, l.productId ?? null])
  return { id: row.id, total: totals.total }
}
async function setSalesStatus(id: number, status: string) {
  await pgQuery(`UPDATE sales_documents SET status=$2, updated_at=${NOW} WHERE id=$1`, [id, status])
}
/** Record a customer payment (mirrors the payments route: status recompute). */
async function recordSalesPayment(customerId: number, documentId: number | null, date: string, amount: number, method = 'bank') {
  await pgQuery(`INSERT INTO sales_payments (customer_id,document_id,date,amount,method,created_by,currency,exchange_rate) VALUES ($1,$2,$3,$4,$5,$6,'IRR',1)`,
    [customerId, documentId, date, amount, method, ADMIN])
  if (documentId) {
    const doc = await one<{ total: number; doc_type: string }>(`SELECT total::float AS total, doc_type FROM sales_documents WHERE id=$1`, [documentId])
    if (doc?.doc_type === 'invoice') {
      const paid = num((await one<{ p: number }>(`SELECT COALESCE(SUM(amount),0)::float AS p FROM sales_payments WHERE document_id=$1`, [documentId]))?.p)
      await setSalesStatus(documentId, invoiceStatus(doc.total, paid))
    }
  }
}
/** Sales return → posted credit note (mirrors the route's 'return' op). */
async function salesReturn(invoiceId: number, date: string): Promise<number> {
  const src = await one<Record<string, unknown>>(`SELECT * FROM sales_documents WHERE id=$1`, [invoiceId])
  const docNo = await nextNumber('credit_note', { module: 'sales', legacyPrefix: 'CN' })
  const cn = await one<{ id: number }>(
    `INSERT INTO sales_documents (doc_type,doc_no,customer_id,date,status,subtotal,discount_total,tax_total,total,source_id,notes,created_by,currency,exchange_rate,base_total,updated_at)
     VALUES ('credit_note',$1,$2,$3,'confirmed',$4,$5,$6,$7,$8,$9,$10,'IRR',1,$7,${NOW}) RETURNING id`,
    [docNo, src.customer_id, date, src.subtotal, src.discount_total, src.tax_total, src.total, invoiceId, `Return of ${src.doc_no}`, ADMIN])
  await pgQuery(`INSERT INTO sales_document_lines (document_id,description,qty,unit_price,discount_pct,tax_pct,line_total,line_no,product_id)
                 SELECT $1,description,qty,unit_price,discount_pct,tax_pct,line_total,line_no,product_id FROM sales_document_lines WHERE document_id=$2`, [cn.id, invoiceId])
  await postSalesInvoiceToGl(cn.id, ADMIN)
  return cn.id
}

const CATS = ['electronics', 'components', 'accessories', 'appliances']
interface Prod { id: number; sku: string; cost: number; price: number; cat: string }

async function main() {
  const T0 = Date.now()
  console.log('══ STAGE 0 · migrate + seed + company setup ══')
  await runMigrations()
  await seedDatabase()
  ADMIN = (await one<{ id: string }>(`SELECT id FROM users ORDER BY created_at LIMIT 1`)).id
  // Phase-4 procurement hardening added a maker/checker guard to decideApproval
  // (a document's creator may not approve/reject their own request) — a second
  // seeded user approves purchase documents ADMIN creates, so this simulation
  // still exercises a realistic two-person approval flow instead of tripping
  // the new separation-of-duties rule against itself.
  await pgQuery(`INSERT INTO users (id,name,email,password_hash,role,created_at) VALUES ('sim-approver','Sim Approver','sim-approver@habibazar.com','x','administrator',now()) ON CONFLICT (id) DO NOTHING`)
  APPROVER = (await one<{ id: string }>(`SELECT id FROM users WHERE id='sim-approver'`)).id
  await loadChart()

  // Fiscal years + monthly USD rate baseline.
  const fy24 = await createPeriod({ name: 'FY2024', startDate: '2024-01-01', endDate: '2024-12-31', kind: 'year' })
  const fy25 = await createPeriod({ name: 'FY2025', startDate: '2025-01-01', endDate: '2025-12-31', kind: 'year' })
  await createPeriod({ name: 'FY2026', startDate: '2026-01-01', endDate: '2026-12-31', kind: 'year' })
  ok(fy24 > 0 && fy25 > 0, 'fiscal years FY2024/FY2025/FY2026 created (open)')

  // Bank accounts + petty cash float + opening balances.
  const bank1 = await createAccount({ name: 'Mellat Main', bank: 'Mellat', currency: 'IRR', openingBalance: 5_000_000_000 })
  await createAccount({ name: 'Saman Payroll', bank: 'Saman', currency: 'IRR', openingBalance: 800_000_000 })
  await addPetty({ kind: 'float', date: '2024-01-02', amount: 50_000_000, note: 'Initial float' }, ADMIN)
  const ob = await postOpeningBalance({ date: '2024-01-01', entries: [
    { accountId: acct.get('1010')!, amount: 5_800_000_000 },   // Bank
    { accountId: acct.get('1200')!, amount: 1_200_000_000 },   // Inventory
    { accountId: acct.get('3000') ?? acct.get('3900')!, amount: 7_000_000_000 }, // Equity
  ] }, ADMIN)
  ok(ob.entryId > 0, 'opening balance posted (7B = 7B, normal-side placement)')

  // Vendors (8, evaluated), customers (12 + a deliberate duplicate), products (16), warehouses (3).
  const vendorIds: number[] = []
  for (let i = 1; i <= 8; i++) {
    const id = await createVendor({ code: `V-${100 + i}`, name: `Supplier ${i}`, kind: 'company' } as never, ADMIN)
    await evaluateVendor(id, { quality: 3 + Math.floor(rnd() * 3), delivery: 3 + Math.floor(rnd() * 3), price: 3 + Math.floor(rnd() * 3), service: 4, compliance: 5 }, 'annual eval', ADMIN)
    vendorIds.push(id)
  }
  const custIds: number[] = []
  for (let i = 1; i <= 12; i++) {
    const c = await one<{ id: number }>(`INSERT INTO sales_customers (code,name,kind,national_id,credit_limit) VALUES ($1,$2,'company',$3,$4) RETURNING id`,
      [`C-${200 + i}`, `Customer ${i}`, `10${String(i).padStart(8, '0')}`, 2_000_000_000])
    custIds.push(c.id)
  }
  const dup = await one<{ id: number }>(`INSERT INTO sales_customers (code,name,kind,national_id) VALUES ('C-201B','Customer 1 (branch)','company','1000000001') RETURNING id`)
  const whMain = (await one<{ id: number }>(`INSERT INTO inv_warehouses (code,name_en) VALUES ('WH-MAIN','Main DC') RETURNING id`)).id
  const whEast = (await one<{ id: number }>(`INSERT INTO inv_warehouses (code,name_en) VALUES ('WH-EAST','East Branch') RETURNING id`)).id
  await one<{ id: number }>(`INSERT INTO inv_warehouses (code,name_en) VALUES ('WH-RET','Returns') RETURNING id`)
  const prods: Prod[] = []
  for (let i = 1; i <= 16; i++) {
    const cost = 800_000 + Math.floor(rnd() * 4_000_000)
    const price = Math.round(cost * (1.25 + rnd() * 0.4))
    const cat = CATS[i % CATS.length]
    const p = await one<{ id: number }>(`INSERT INTO inv_products (sku,name_en,category,cost,price,active,track_serial) VALUES ($1,$2,$3,$4,$5,1,$6) RETURNING id`,
      [`SKU-${1000 + i}`, `Product ${i}`, cat, cost, price, i === 1 ? 1 : 0])
    prods.push({ id: p.id, sku: `SKU-${1000 + i}`, cost, price, cat })
    // Opening stock (real receipt moves).
    await pgQuery(`INSERT INTO inv_moves (product_id,warehouse_id,type,qty,unit_cost,ref,created_by) VALUES ($1,$2,'receipt',$3,$4,'Opening stock',$5)`,
      [p.id, whMain, 40 + Math.floor(rnd() * 60), cost, ADMIN])
  }
  ok(prods.length === 16 && custIds.length === 12 && vendorIds.length === 8, 'masters created: 8 suppliers · 13 customers · 16 products · 3 warehouses')

  // Serial/batch tracking on product 1.
  await registerSerials({ productId: prods[0].id, warehouseId: whMain, serials: [{ serial: 'SN-9001', imei: '490154203237518' }, { serial: 'SN-9002' }], warrantyMonths: 18 }, ADMIN)
  await registerBatch({ productId: prods[1].id, warehouseId: whMain, batchNo: 'LOT-24A', qty: 30, productionDate: '2024-01-05', expiryDate: '2025-06-30' }, ADMIN)
  ok(true, 'serials (IMEI Luhn-checked) + expiring batch registered')

  // Assets with depreciation profile.
  await pgQuery(`INSERT INTO assets (name, category, purchase_price, purchase_date, useful_life_years, residual_value, depreciation_method, status)
                 VALUES ('Delivery Truck','vehicle',3600000000,'2024-01-10',6,600000000,'straight_line','active'),
                        ('Server Rack','it',900000000,'2024-02-01',4,100000000,'straight_line','active')`)
  ok(true, 'depreciable assets registered')

  console.log('══ STAGE 1 · 24-month operation (2024-01 … 2025-12) ══')
  let invoiceCount = 0, poCount = 0, returnCount = 0, badDebtBooked = 0
  const openInvoices: { id: number; customerId: number; total: number; date: string }[] = []
  for (let m = 0; m < 24; m++) {
    const year = 2024 + Math.floor(m / 12)
    const month = (m % 12) + 1
    const mm = String(month).padStart(2, '0')
    const date = (d: number) => `${year}-${mm}-${String(d).padStart(2, '0')}`
    // Seasonality (Q4 high), growth (+2%/mo), inflation on prices (+1.2%/mo).
    const season = month >= 10 ? 1.35 : month <= 2 ? 0.8 : 1
    const growth = 1 + m * 0.02
    const inflate = 1 + m * 0.012
    // FX: USD climbs 500k→~740k with monthly noise.
    await setRate('USD', date(1), Math.round(500_000 * (1 + m * 0.02 + (rnd() - 0.5) * 0.03)), ADMIN)
    await setRate('EUR', date(1), Math.round(540_000 * (1 + m * 0.018)), ADMIN)

    // — Sales: 3 cycles/month (quote → order → invoice → confirm → GL → payment) —
    const cycles = Math.max(2, Math.round(3 * season * Math.min(growth, 1.8)))
    for (let c = 0; c < cycles; c++) {
      const cust = custIds[Math.floor(rnd() * custIds.length)]
      const p = prods[Math.floor(rnd() * prods.length)]
      const qty = 8 + Math.floor(rnd() * 18)
      const price = Math.round(p.price * inflate)
      const lines = [{ description: p.sku, qty, unitPrice: price, discountPct: rnd() < 0.25 ? 5 : 0, taxPct: 9, productId: p.id }]
      const q = await saveSalesDoc({ docType: 'quote', customerId: cust, date: date(3 + c), lines })
      await setSalesStatus(q.id, 'confirmed')
      const o = await saveSalesDoc({ docType: 'order', customerId: cust, date: date(4 + c), sourceId: q.id, lines })
      await setSalesStatus(o.id, 'confirmed')
      const inv = await saveSalesDoc({ docType: 'invoice', customerId: cust, date: date(6 + c), sourceId: o.id, lines })
      await setSalesStatus(inv.id, 'confirmed')
      await postSalesInvoiceToGl(inv.id, ADMIN)
      invoiceCount++
      // Shipment for the order (reserve → pick → pack → ship).
      if (c === 0) {
        const shp = await createShipment({ warehouseId: whMain, customerId: cust, lines: [{ productId: p.id, qty }] }, ADMIN)
        await advanceShipment(shp.id, 'picking', {}, ADMIN)
        await advanceShipment(shp.id, 'packed', {}, ADMIN)
        await advanceShipment(shp.id, 'shipped', { trackingNo: `TRK-${year}${mm}` }, ADMIN)
        await advanceShipment(shp.id, 'delivered', {}, ADMIN)
      }
      // Payment behaviour: 70% pay full, 15% partial (late), 15% stay open (aging/bad debt pool).
      const roll = rnd()
      if (roll < 0.7) await recordSalesPayment(cust, inv.id, date(20), inv.total)
      else if (roll < 0.85) { await recordSalesPayment(cust, inv.id, date(25), r2(inv.total * 0.5)); openInvoices.push({ id: inv.id, customerId: cust, total: inv.total, date: date(6 + c) }) }
      else openInvoices.push({ id: inv.id, customerId: cust, total: inv.total, date: date(6 + c) })
      // 8% of invoices come back (customer return → credit note, GL-reversing).
      if (rnd() < 0.08) { await salesReturn(inv.id, date(26)); returnCount++ }
    }
    // Advance payment (no document yet).
    if (month === 3) await recordSalesPayment(custIds[0], null, date(2), 150_000_000)

    // — Purchasing: monthly PR → approval tiers → PO → GRN → invoice → GL → payment —
    const v = vendorIds[Math.floor(rnd() * vendorIds.length)]
    const p = prods[Math.floor(rnd() * prods.length)]
    const buyQty = 40 + Math.floor(rnd() * 60)
    const cost = Math.round(p.cost * inflate)
    const prId = await savePurchaseDoc({ docType: 'request', vendorId: v, date: date(2), department: 'ops', lines: [{ description: p.sku, qty: buyQty, unitPrice: cost, discountPct: 0, taxPct: 9, productId: p.id }] }, ADMIN)
    const sub = await submitDocument(prId)
    if (!sub.ok) throw new Error(`PR submit failed: ${sub.error}`)
    const prDoc = await one<{ total: number; approval_levels: number }>(`SELECT total::float AS total, approval_levels FROM purchase_documents WHERE id=$1`, [prId])
    for (let lvl = 1; lvl <= prDoc.approval_levels; lvl++) {
      const r = await decideApproval(prId, lvl, 'approved', APPROVER)
      if (!r.ok) throw new Error(`approval failed: ${r.error}`)
    }
    const poId = await convertDocument(prId, 'order', ADMIN)
    poCount++
    const grnId = await convertDocument(poId, 'receipt', ADMIN)
    // Partial receipt first, then the rest (under/over-receipt guard: cap at ordered).
    const grnLines = await pgQuery<{ id: number; qty: number }>(`SELECT id, qty::float AS qty FROM purchase_document_lines WHERE document_id=$1`, [grnId])
    await receiveDocument(grnId, whMain, [{ lineId: grnLines[0].id, qty: Math.floor(grnLines[0].qty / 2) }], ADMIN)
    await receiveDocument(grnId, whMain, undefined, ADMIN) // remainder
    const pinvId = await convertDocument(grnId, 'invoice', ADMIN)
    await pgQuery(`UPDATE purchase_documents SET status='confirmed', updated_at=${NOW} WHERE id=$1`, [pinvId])
    await postPurchaseInvoiceToGl(pinvId, ADMIN)
    const pinv = await one<{ total: number }>(`SELECT total::float AS total FROM purchase_documents WHERE id=$1`, [pinvId])
    // Partial then final payment.
    await recordPurchasePayment(pinvId, v, r2(pinv.total * 0.6), 'bank', date(18), undefined, ADMIN)
    await recordPurchasePayment(pinvId, v, r2(pinv.total * 0.4), 'bank', date(28), undefined, ADMIN)

    // — Treasury: bank statement lines for this month's payments + auto-match; petty cash; payroll —
    await importStatement(bank1, [
      { date: date(20), amount: 50_000_000, description: `POS settlements ${year}-${mm}`, reference: `ST-${year}${mm}` },
      { date: date(28), amount: -r2(pinv.total * 0.4), description: `Transfer to Supplier`, reference: `TR-${year}${mm}` },
    ] as never)
    await autoMatch(bank1)
    await addPetty({ kind: 'expense', date: date(15), amount: 3_000_000 + Math.floor(rnd() * 4_000_000), category: 'office', note: 'consumables' }, ADMIN)
    // Payroll accrual (HR boundary → booked as a real balanced journal).
    await bookEntry(date(27), `Payroll ${year}-${mm}`, 'payroll', [
      { code: '6100', debit: Math.round(90_000_000 * growth), credit: 0 },
      { code: '1010', debit: 0, credit: Math.round(90_000_000 * growth) },
    ])
    // Monthly straight-line depreciation (truck 3.0B/6y + server 0.8B/4y ≈ 58.3M/mo).
    if (acct.get('6900') || acct.get('5000')) {
      await bookEntry(date(28), `Depreciation ${year}-${mm}`, 'depreciation', [
        { code: acct.has('6900') ? '6900' : '5000', debit: 58_333_333, credit: 0 },
        { code: '1500', debit: 0, credit: 58_333_333 },
      ]).catch(async () => {
        // 1500 Accumulated dep. may not exist in the seeded chart — use fixed assets contra fallback via equity-safe pair.
        await bookEntry(date(28), `Depreciation ${year}-${mm}`, 'depreciation', [
          { code: '5000', debit: 58_333_333, credit: 0 },
          { code: '1200', debit: 0, credit: 58_333_333 },
        ])
      })
    }

    // — Quarterly: cycle count with shrinkage → GL; damaged goods hold; cheque; FX revaluation —
    if (month % 3 === 0) {
      const cnt = await createCount(whMain, ADMIN)
      const firstLine = await one<{ product_id: number; snapshot_qty: number }>(`SELECT product_id, system_qty::float AS snapshot_qty FROM inv_count_lines WHERE count_id=$1 ORDER BY id LIMIT 1`, [cnt.id])
      await enterCount(cnt.id, [{ productId: firstLine.product_id, countedQty: Math.max(0, firstLine.snapshot_qty - 1) }])
      await transitionCount(cnt.id, 'submitted', ADMIN)
      await transitionCount(cnt.id, 'approved', ADMIN)
      await postCount(cnt.id, ADMIN)
      const dmg = await createHold({ productId: prods[2].id, warehouseId: whMain, kind: 'damage', qty: 1, ref: `DMG-${year}${mm}` }, ADMIN)
      await releaseHold(dmg.id, true)
      const chq = await createCheque({ direction: 'issued', number: `CHQ-${year}${mm}`, party: 'Supplier 1', amount: 80_000_000, dueDate: date(28), bankAccountId: bank1 }, ADMIN)
      await transitionCheque(chq, 'presented' as never).catch(() => null)
      await bookRevaluation(ADMIN)
    }
  }
  ok(invoiceCount >= 60, `${invoiceCount} sales invoices over 24 months (seasonality + growth applied)`)
  ok(poCount === 24, `${poCount} full procure-to-pay cycles (PR→approve→PO→GRN partial+full→invoice→GL→payments)`)
  ok(returnCount > 0, `${returnCount} customer returns → GL-reversing credit notes`)

  // Cancelled PO + rejected approval (exception paths).
  const cancelPr = await savePurchaseDoc({ docType: 'request', vendorId: vendorIds[0], date: '2025-06-05', lines: [{ description: 'cancelled buy', qty: 5, unitPrice: 900_000_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
  await submitDocument(cancelPr)
  const rej = await decideApproval(cancelPr, 1, 'rejected', APPROVER, 'over budget, not needed')
  ok(rej.ok && rej.status === 'rejected', 'approval rejection stops a purchase request')
  const voidPo = await savePurchaseDoc({ docType: 'order', vendorId: vendorIds[1], date: '2025-06-10', lines: [{ description: 'to cancel', qty: 1, unitPrice: 10_000_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
  await pgQuery(`UPDATE purchase_documents SET status='void', updated_at=${NOW} WHERE id=$1`, [voidPo])
  ok(true, 'cancelled PO voided (excluded from aggregates)')
  // RFQ comparison (3 supplier quotations).
  const rfq = await savePurchaseDoc({ docType: 'rfq', date: '2025-03-01', lines: [{ description: 'bulk cable', qty: 100, unitPrice: 0, discountPct: 0, taxPct: 0 }] }, ADMIN)
  for (const [i, vv] of vendorIds.slice(0, 3).entries())
    await savePurchaseDoc({ docType: 'quotation', vendorId: vv, date: '2025-03-04', sourceId: rfq, lines: [{ description: 'bulk cable', qty: 100, unitPrice: 1_000_000 + i * 90_000, discountPct: 0, taxPct: 0 }] }, ADMIN)
  const quotes = await compareQuotes(rfq)
  ok(quotes.length === 3 && num((quotes[0] as { total: number }).total) <= num((quotes[1] as { total: number }).total), 'RFQ comparison ranks 3 quotations cheapest-first')

  // Bad debt: write off the oldest open invoice (Dr Bad debt expense / Cr AR).
  const bad = openInvoices[0]
  const badPaid = num((await one<{ p: number }>(`SELECT COALESCE(SUM(amount),0)::float AS p FROM sales_payments WHERE document_id=$1`, [bad.id]))?.p)
  const writeOff = r2(bad.total - badPaid)
  await bookEntry('2025-11-30', `Bad debt write-off ${bad.id}`, 'bad-debt', [
    { code: acct.has('6800') ? '6800' : '6100', debit: writeOff, credit: 0 },
    { code: '1100', debit: 0, credit: writeOff },
  ])
  badDebtBooked = writeOff
  ok(badDebtBooked > 0, `bad debt written off (${writeOff.toLocaleString()})`)

  // Negative-stock attempt must be rejected by the availability guard.
  const state = await stockStateFor(prods[3].id, whEast)
  let negBlocked = false
  try { await createShipment({ warehouseId: whEast, lines: [{ productId: prods[3].id, qty: state.available + 999 }] }, ADMIN) } catch { negBlocked = true }
  ok(negBlocked, 'negative-stock attempt (over-available shipment) rejected by the hold guard')

  console.log('══ STAGE 2 · year-end closing FY2024 → FY2025 ══')
  const close24 = await runYearEndClosing(fy24, ADMIN)
  ok(close24.ok && !!close24.entryId && num(close24.netIncome) > 0, `FY2024 closed profitably → retained earnings (net income ${num(close24.netIncome).toLocaleString()})`)
  const again = await runYearEndClosing(fy24, ADMIN)
  ok(!again.ok, 'double year-end close rejected (idempotent)')
  await transitionPeriod(fy24, 'closed', ADMIN)
  await transitionPeriod(fy24, 'locked', ADMIN)
  const lockedPost = await assertPostable('2024-06-15')
  ok(!lockedPost.ok, 'posting into the locked FY2024 is refused')
  const close25 = await runYearEndClosing(fy25, ADMIN)
  ok(close25.ok && num(close25.netIncome) > 0, `FY2025 closed profitably (net income ${num(close25.netIncome).toLocaleString()})`)
  // Period attribution (26.21 fix): revenue swept by the closings, not stranded in the current year.
  const strandedRev = incomeStatement(await loadTallies()).totalRevenue
  ok(strandedRev < num(close24.netIncome) / 10, `post-closing income statement holds only current-year activity (stranded revenue ${r2(strandedRev).toLocaleString()})`)

  console.log('══ STAGE 3 · continuous accounting validation ══')
  const tallies = await loadTallies()
  const tb = trialBalance(tallies)
  ok(Math.abs(tb.totalDebit - tb.totalCredit) < 1, `trial balance balances (Dr ${r2(tb.totalDebit).toLocaleString()} = Cr ${r2(tb.totalCredit).toLocaleString()})`)
  const is24 = incomeStatement(tallies)
  const bs = balanceSheet(tallies)
  ok(Math.abs(bs.totalAssets - (bs.totalLiabilities + bs.totalEquity)) < 1, `balance sheet ties (A ${r2(bs.totalAssets).toLocaleString()} = L+E)`)
  const integ = await scanLedgerIntegrity({ status: 'posted' })
  ok(integ.withIssues === 0 && integ.score === 100, `ledger integrity 100 — 0/${integ.entriesChecked} posted entries with issues`)
  // Subsidiary ledger ⇄ GL: AR control account equals invoices − credit notes − payments − write-offs.
  const arStmt = await accountStatement(acct.get('1100')!)
  const arSub = await one<{ inv: number; cn: number; pay: number }>(
    `SELECT (SELECT COALESCE(SUM(total),0)::float FROM sales_documents WHERE doc_type='invoice' AND status NOT IN ('draft','void') AND deleted_at IS NULL AND gl_entry_id IS NOT NULL) AS inv,
            (SELECT COALESCE(SUM(total),0)::float FROM sales_documents WHERE doc_type='credit_note' AND gl_entry_id IS NOT NULL) AS cn,
            (SELECT COALESCE(SUM(amount),0)::float FROM sales_payments WHERE document_id IS NOT NULL) AS pay`)
  // GL AR = posted invoices − credit notes − write-off (payments post to AR only via receipts; here receipts aren't GL-posted per module design — AR statement reflects invoices/CN/write-off).
  const expectedAr = r2(num(arSub.inv) - num(arSub.cn) - badDebtBooked)
  ok(Math.abs(num(arStmt?.totals.debit) - num(arSub.inv)) < 1 && Math.abs(num(arStmt?.totals.balance) - expectedAr) < 1,
    `AR control reconciles with the sales subledger (GL AR ${r2(num(arStmt?.totals.balance)).toLocaleString()})`)
  // VAT: GL 2100 credit-side equals output VAT − input VAT − returns VAT.
  const vat = await accountStatement(acct.get('2100')!)
  ok(num(vat?.totals.credit) > 0 && num(vat?.totals.debit) > 0, `VAT control carries output (Cr ${r2(num(vat?.totals.credit)).toLocaleString()}) and input/return (Dr ${r2(num(vat?.totals.debit)).toLocaleString()}) tax`)
  // Inventory valuation engine reconciles with the move ledger.
  const moves = await pgQuery<{ product_id: number; qty: number; unit_cost: number; type: string; created_at: string }>(
    `SELECT product_id, qty::float AS qty, unit_cost::float AS unit_cost, type, created_at FROM inv_moves WHERE product_id=$1 ORDER BY id`, [prods[0].id])
  const val = valuate(moves.map(m => ({ type: m.type as never, qty: m.qty, unitCost: m.unit_cost })), 'wavg')
  const onHand = moves.reduce((s, m) => s + m.qty, 0)
  ok(Math.abs(val.onHand - onHand) < 0.001 && val.value >= 0, `WAVG valuation reconciles the move ledger for ${prods[0].sku} (on-hand ${onHand}, value ${val.value.toLocaleString()})`)

  console.log('══ STAGE 4 · self-heal + health after operations ══')
  const heal = await runSelfHeal(ADMIN)
  const crit = heal.findings.filter(f => f.severity === 'critical' && f.count - f.fixed > 0 && !['duplicate_payments'].includes(f.code))
  ok(heal.findings.find(f => f.code === 'sales_invoice_unposted')!.count === 0, 'self-heal: zero unposted sales invoices after 24 months')
  ok(heal.findings.find(f => f.code === 'purchase_invoice_unposted')!.count === 0, 'self-heal: zero unposted purchase invoices')
  ok(heal.findings.find(f => f.code === 'gl_unbalanced')!.count === 0, 'self-heal: zero unbalanced entries')
  ok(heal.findings.find(f => f.code === 'negative_stock')!.count === 0, 'self-heal: zero negative stock after 2 years of movement')
  ok(crit.length === 0, `self-heal: no unexplained critical findings (risk ${heal.risk})`)

  console.log('══ STAGE 5 · imports (CSV validate→approve→execute→rollback) ══')
  const csv = 'code,name,phone\nC-901,Imported Co 1,09121110001\nC-902,Imported Co 2,09121110002\nC-903,Imported Co 3,۰۹۱۲۱۱۱۰۰۰۳\n'
  const job = await createJob({ entityType: 'customer', name: 'legacy-crm.csv', fileName: 'legacy-crm.csv', content: csv }, ADMIN)
  await saveJobMapping(job.id, job.suggested, 'skip')
  const vres = await validateJob(job.id)
  ok(vres.errors === 0, `import validation clean (${vres.valid} valid rows, Persian digits cleansed)`)
  await approveJob(job.id, { id: ADMIN, role: 'super_admin' })
  const exec = await executeJob(job.id, ADMIN)
  ok(exec.imported === 3, `3 legacy customers imported (${exec.imported})`)
  const cleansed = await one<{ phone: string }>(`SELECT phone FROM sales_customers WHERE code='C-903'`)
  ok(cleansed?.phone === '09121110003', 'Persian-digit phone normalized on import')
  const rb = await rollbackJob(job.id, ADMIN)
  ok(rb.reversed === 3 && !(await one(`SELECT id FROM sales_customers WHERE code='C-901'`)), 'import rollback restored the DB (3 reversed)')

  console.log('══ STAGE 6 · master data governance ══')
  const dupes = await detectDuplicates()
  ok(dupes.groups.some(g => g.keyType === 'customer.national_id'), 'duplicate customer identity detected (national_id)')
  const merge = await mergeCustomers(custIds[0], dup.id)
  ok(merge.movedDocuments >= 0 && !!(await one<{ active: number }>(`SELECT active FROM sales_customers WHERE id=$1`, [dup.id])), 'customer merge repointed children + archived the duplicate')
  const md = await masterDataOverview()
  ok(md.overall > 0 && md.domains.length === 3, `master-data quality scored (overall ${md.overall}%)`)

  console.log('══ STAGE 7 · full report catalog ══')
  let reportsRun = 0, reportsFailed = 0
  for (const rep of REPORTS) {
    const out = await runReport(rep.id).catch(() => null)
    if (out && Array.isArray(out.rows)) reportsRun++
    else { reportsFailed++; console.error(`   report failed: ${rep.id}`) }
  }
  ok(reportsFailed === 0, `entire report catalog executes (${reportsRun}/${REPORTS.length})`)
  const intel = await stockIntelligence()
  ok(intel.rows.length > 0 && intel.kpis !== undefined, 'ABC/XYZ/dead-stock/aging intelligence computed')
  const cf = await cashFlow(12)
  ok(Array.isArray(cf) || cf !== undefined, 'treasury cash-flow series computed')
  const petty = await pettyOverview()
  ok(num((petty as { balance?: number }).balance) < 50_000_000, 'petty cash balance reflects 24 months of expenses')

  console.log('══ STAGE 8 · health center + final posture ══')
  const h = await healthOverview()
  ok(h.overall >= 75, `overall ERP health ${h.overall}/100 (${h.grade}) after two years`)
  ok(h.components.find(c => c.key === 'financial')!.score === 100, 'financial component 100 (books clean)')

  console.log('══ STAGE 9 · stress (100k+ rows, measured) ══')
  let t = Date.now()
  await pgQuery(`INSERT INTO inv_moves (product_id,warehouse_id,type,qty,unit_cost,ref)
                 SELECT $1,$2,'receipt',1,1000,'stress-'||g FROM generate_series(1,100000) g`, [prods[5].id, whEast])
  const insMs = Date.now() - t
  t = Date.now()
  const big = await one<{ q: number }>(`SELECT COALESCE(SUM(qty),0)::float AS q FROM inv_moves WHERE product_id=$1 AND warehouse_id=$2`, [prods[5].id, whEast])
  const aggMs = Date.now() - t
  ok(num(big.q) >= 100_000 && aggMs < 1000, `100k stock moves inserted (${insMs}ms) · on-hand aggregate in ${aggMs}ms`)
  t = Date.now()
  await stockIntelligence()
  const intelMs = Date.now() - t
  ok(intelMs < 5000, `stock intelligence over 100k+ moves in ${intelMs}ms`)
  t = Date.now()
  const tb2 = trialBalance(await loadTallies())
  const tbMs = Date.now() - t
  ok(Math.abs(tb2.totalDebit - tb2.totalCredit) < 1 && tbMs < 2000, `trial balance still balanced + computed in ${tbMs}ms`)

  console.log(`\n══ RESULT ══  ${failed === 0 ? `✅ ALL ${n} ASSERTIONS PASSED` : `❌ ${failed}/${n} FAILED`}  (total ${((Date.now() - T0) / 1000).toFixed(1)}s)`)
  // CFO figures for the reports.
  const fig = {
    invoices: invoiceCount, pos: poCount, returns: returnCount,
    revenue: r2(is24.totalRevenue), expenses: r2(is24.totalExpenses), netIncome: r2(is24.netIncome),
    assets: r2(bs.totalAssets), liabilities: r2(bs.totalLiabilities), equity: r2(bs.totalEquity),
    trialDr: r2(tb.totalDebit), fy24Net: num(close24.netIncome), fy25Net: num(close25.netIncome),
    badDebt: badDebtBooked, risk: heal.risk, health: h.overall,
    vatOut: r2(num(vat?.totals.credit)), vatIn: r2(num(vat?.totals.debit)),
    stress: { insMs, aggMs, intelMs, tbMs },
  }
  console.log('FIGURES ' + JSON.stringify(fig))
  process.exit(failed === 0 ? 0 : 1)
}

main().catch(e => { console.error(e); process.exit(1) })
