/**
 * ERPFIX-6 — inventory costing + COGS from one reference: a per-product
 * `valuation_method` (FIFO/LIFO/WAVG, default WAVG) now drives issueCost
 * everywhere stock leaves the warehouse (BUG-ERP-12), a direct invoice's
 * stock lines are gated by `erp_settings.invoice_stock_mode`
 * (auto_issue/require_delivery/warn — BUG-ERP-07), and a confirmed sales
 * return restocks at the ORIGINAL issue cost (audit_first finding,
 * decision_gate answered). Live-PostgreSQL proof.
 *
 * Financial assertions go through production functions (deliverSalesOrder,
 * trialBalance via loadTallies, issueCost/valuate) per CLAUDE.md rule 15.
 *
 * Run: DATABASE_URL=… npx tsx scripts/verify-erpfix-6.ts
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery, withTransaction } from '@/lib/db'
import { createPeriod } from '@/lib/erp/accountingData'
import { loadTallies } from '@/lib/erp/ledgerData'
import { trialBalance } from '@/lib/erp/ledger'
import { issueCost } from '@/lib/erp/inventory'
import { inventoryGlReconciliation } from '@/lib/erp/inventoryData'
import { reserveSalesOrderTx, deliverSalesOrder } from '@/lib/erp/salesFulfillment'
import { saveDocument as savePurchaseDoc, confirmPurchaseInvoice, receiveDocument } from '@/lib/erp/purchasingData'
import {
  createSalesReturn, restockSalesReturn, directInvoiceStockLines, autoIssueDirectInvoiceStock,
} from '@/lib/erp/salesData'

let n = 0, failed = 0
const ok = (c: boolean, l: string) => { n++; if (c) console.log(`  ✅ ${n}. ${l}`); else { failed++; console.error(`  ❌ ${n}. ${l}`) } }
const one = async <T>(sql: string, p: unknown[] = []) => (await pgQuery<T>(sql, p))[0]
const today = () => new Date().toISOString().slice(0, 10)
const close = (a: number, b: number, eps = 1) => Math.abs(a - b) <= eps

async function accountBalance(code: string): Promise<number> {
  const tb = trialBalance(await loadTallies())
  const row = tb.rows.find(r => r.code === code)
  return row ? row.debit - row.credit : 0
}

async function main() {
  await runMigrations(); await seedDatabase()
  const ADMIN = (await one<{ id: string }>(`SELECT id FROM users ORDER BY created_at LIMIT 1`)).id
  await createPeriod({ name: 'EF6', startDate: '2020-01-01', endDate: '2100-12-31', kind: 'year' })
  const whId = (await one<{ id: number }>(`INSERT INTO inv_warehouses (code, name_en, active) VALUES ('EF6WH','EF6 Warehouse',1) RETURNING id`)).id
  const customerId = (await one<{ id: number }>(`INSERT INTO sales_customers (code, name) VALUES ('EF6CUST','EF6 Customer') RETURNING id`)).id

  // ══ BUG-ERP-12: COGS == issueCost, per the product's OWN valuation_method ══
  console.log('— BUG-ERP-12: COGS comes from issueCost (WAVG/FIFO/LIFO), never a static inv_products.cost —')
  for (const method of ['wavg', 'fifo', 'lifo'] as const) {
    const productId = (await one<{ id: number }>(
      `INSERT INTO inv_products (sku, name_en, cost, price, active, valuation_method) VALUES ($1,'EF6 Product',999,150,1,$2) RETURNING id`,
      [`EF6SKU-${method}`, method])).id
    await pgQuery(`INSERT INTO inv_moves (product_id, warehouse_id, type, qty, unit_cost, ref, created_at) VALUES ($1,$2,'receipt',10,100,'EF6-R1',${"to_char(now(),'YYYY-MM-DD HH24:MI:SS')"})`, [productId, whId])
    await pgQuery(`INSERT INTO inv_moves (product_id, warehouse_id, type, qty, unit_cost, ref, created_at) VALUES ($1,$2,'receipt',10,200,'EF6-R2',${"to_char(now(),'YYYY-MM-DD HH24:MI:SS')"})`, [productId, whId])
    // Reference figure via the SAME production function the issuing code calls.
    const moves = await pgQuery<{ type: 'receipt'; qty: number; unit_cost: number }>(
      `SELECT type, qty::float AS qty, unit_cost::float AS unit_cost FROM inv_moves WHERE product_id=$1 ORDER BY id`, [productId])
    const ref = issueCost(moves.map(m => ({ type: m.type, qty: m.qty, unitCost: m.unit_cost })), 15, method)

    const soId = (await one<{ id: number }>(
      `INSERT INTO sales_documents (doc_type, doc_no, customer_id, date, status, subtotal, discount_total, tax_total, total, warehouse_id, currency, exchange_rate, base_total)
       VALUES ('order',$1,$2,$3,'confirmed',2250,0,0,2250,$4,'IRR',1,2250) RETURNING id`, [`EF6-SO-${method}`, customerId, today(), whId])).id
    const lineId = (await one<{ id: number }>(
      `INSERT INTO sales_document_lines (document_id, description, qty, unit_price, discount_pct, tax_pct, line_total, line_no, product_id)
       VALUES ($1,'EF6 line',15,150,0,0,2250,0,$2) RETURNING id`, [soId, productId])).id
    await withTransaction(async query => { const r = await reserveSalesOrderTx(query, soId, whId, ADMIN); if (!r.ok) throw new Error(r.error) })
    const beforeCogs = await accountBalance('5000')
    const deliverRes = await deliverSalesOrder(soId, [{ lineId, qty: 15 }], ADMIN)
    ok(deliverRes.ok, `${method}: delivery succeeded`)
    const afterCogs = await accountBalance('5000')
    ok(close(afterCogs - beforeCogs, ref.totalCost, 0.5), `${method}: COGS booked (${(afterCogs - beforeCogs).toFixed(2)}) matches issueCost's own figure (${ref.totalCost}) — never the static cost (999)`)
    const issueMove = (await one<{ unit_cost: number }>(`SELECT unit_cost::float AS unit_cost FROM inv_moves WHERE product_id=$1 AND type='issue' LIMIT 1`, [productId]))
    ok(close(issueMove.unit_cost, ref.unitCost, 0.5), `${method}: the issue move's own unit_cost (${issueMove.unit_cost}) matches issueCost's unit figure (${ref.unitCost}), not 999`)
  }

  // ══ BUG-ERP-12: inventory ↔ GL reconciliation ══
  console.log('— BUG-ERP-12: inventory valuation reconciles with the GL 1200 balance —')
  const vendorId = (await one<{ id: number }>(`INSERT INTO purchase_vendors (code, name) VALUES ('EF6VEND','EF6 Vendor') RETURNING id`)).id
  const reconBefore = await inventoryGlReconciliation()
  // A fully invoiced GRN cycle: receipt + confirmed invoice sourced FROM it
  // (so 1200 is debited through the SAME amount the move ledger carries).
  const grnId = await savePurchaseDoc({ docType: 'receipt', vendorId, date: today(), warehouseId: whId, lines: [
    { description: 'EF6 recon product', qty: 5, unitPrice: 300, discountPct: 0, taxPct: 0 },
  ] } as never, ADMIN)
  // receipt doc needs a product line to move stock — reuse the first WAVG product.
  const reconProductId = (await one<{ id: number }>(`SELECT id FROM inv_products WHERE sku='EF6SKU-wavg'`)).id
  await pgQuery(`UPDATE purchase_document_lines SET product_id=$2 WHERE document_id=$1`, [grnId, reconProductId])
  await receiveDocument(grnId, whId, undefined, ADMIN)
  const reconMid = await inventoryGlReconciliation()
  ok(close(reconMid.unbilledReceiptsValue, reconBefore.unbilledReceiptsValue + 1500, 1),
    `an un-invoiced GRN (5×300=1500) shows up as an unbilled receipt — before ${reconBefore.unbilledReceiptsValue}, after ${reconMid.unbilledReceiptsValue}`)
  // Assert the DELTA, not an absolute 0 — this script's own earlier fixtures
  // (raw inv_moves inserted directly for the COGS proofs above, with no
  // purchase_documents behind them at all) are themselves genuinely
  // unexplained noise unrelated to THIS scenario; the reconciliation must
  // not move by more than rounding once this GRN is fully explained by the
  // unbilled-receipt component.
  ok(close(reconMid.unexplained, reconBefore.unexplained, 1), `the gap is fully EXPLAINED by the unbilled-receipt component — unexplained unchanged by this GRN (before ${reconBefore.unexplained}, after ${reconMid.unexplained})`)
  const invId = await savePurchaseDoc({ docType: 'invoice', vendorId, date: today(), sourceId: grnId, lines: [
    { description: 'EF6 recon product', qty: 5, unitPrice: 300, discountPct: 0, taxPct: 0, productId: reconProductId, receiptLineId: (await one<{ id: number }>(`SELECT id FROM purchase_document_lines WHERE document_id=$1`, [grnId])).id },
  ] } as never, ADMIN)
  await confirmPurchaseInvoice(invId, ADMIN)
  const reconAfter = await inventoryGlReconciliation()
  ok(close(reconAfter.unbilledReceiptsValue, reconBefore.unbilledReceiptsValue, 1), `once invoiced, the receipt leaves the unbilled bucket — back to ${reconBefore.unbilledReceiptsValue}`)
  ok(close(reconAfter.unexplained, reconBefore.unexplained, 1), `after invoicing, inventory and the GL agree exactly as well as they did before this scenario — unexplained unchanged (before ${reconBefore.unexplained}, after ${reconAfter.unexplained})`)

  // ══ BUG-ERP-07: a direct invoice's stock lines, by mode ══
  console.log('— BUG-ERP-07: direct-invoice stock handling by invoice_stock_mode —')
  const productDirId = (await one<{ id: number }>(
    `INSERT INTO inv_products (sku, name_en, cost, price, active, valuation_method) VALUES ('EF6DIRSKU','EF6 Direct Product',50,80,1,'wavg') RETURNING id`)).id
  await pgQuery(`INSERT INTO inv_moves (product_id, warehouse_id, type, qty, unit_cost, ref, created_at) VALUES ($1,$2,'receipt',20,60,'EF6-DIR-R',${"to_char(now(),'YYYY-MM-DD HH24:MI:SS')"})`, [productDirId, whId])

  const directInvId = (await one<{ id: number }>(
    `INSERT INTO sales_documents (doc_type, doc_no, customer_id, date, status, subtotal, discount_total, tax_total, total, warehouse_id, currency, exchange_rate, base_total)
     VALUES ('invoice','EF6-DIR-INV',$1,$2,'draft',800,0,0,800,$3,'IRR',1,800) RETURNING id`, [customerId, today(), whId])).id
  await pgQuery(`INSERT INTO sales_document_lines (document_id, description, qty, unit_price, discount_pct, tax_pct, line_total, line_no, product_id)
     VALUES ($1,'EF6 direct line',10,80,0,0,800,0,$2)`, [directInvId, productDirId])

  const stockLines = await directInvoiceStockLines(directInvId)
  ok(stockLines.length === 1 && stockLines[0].productId === productDirId, '1. a direct invoice (no source_id) with a stock line is detected')

  // auto_issue
  const autoIssueRes = await withTransaction(query => autoIssueDirectInvoiceStock(query, directInvId, ADMIN))
  ok(autoIssueRes.issued && !!autoIssueRes.cogsEntryId, `2. auto_issue mode issues stock and posts a COGS entry — got ${JSON.stringify(autoIssueRes)}`)
  ok(close(autoIssueRes.totalCost, 10 * 60, 0.5), `3. COGS for the direct invoice uses issueCost (10×60=600), not inv_products.cost (50) — got ${autoIssueRes.totalCost}`)
  const retryIssue = await withTransaction(query => autoIssueDirectInvoiceStock(query, directInvId, ADMIN))
  ok(retryIssue.totalCost === 0, '4. re-running auto-issue for the same invoice is idempotent (no double-issue)')

  // insufficient stock → throws, caller maps to a 409
  const productShortId = (await one<{ id: number }>(
    `INSERT INTO inv_products (sku, name_en, cost, price, active, valuation_method) VALUES ('EF6SHORTSKU','EF6 Short Product',50,80,1,'wavg') RETURNING id`)).id
  await pgQuery(`INSERT INTO inv_moves (product_id, warehouse_id, type, qty, unit_cost, ref, created_at) VALUES ($1,$2,'receipt',3,60,'EF6-SHORT-R',${"to_char(now(),'YYYY-MM-DD HH24:MI:SS')"})`, [productShortId, whId])
  const shortInvId = (await one<{ id: number }>(
    `INSERT INTO sales_documents (doc_type, doc_no, customer_id, date, status, subtotal, discount_total, tax_total, total, warehouse_id, currency, exchange_rate, base_total)
     VALUES ('invoice','EF6-SHORT-INV',$1,$2,'draft',800,0,0,800,$3,'IRR',1,800) RETURNING id`, [customerId, today(), whId])).id
  await pgQuery(`INSERT INTO sales_document_lines (document_id, description, qty, unit_price, discount_pct, tax_pct, line_total, line_no, product_id)
     VALUES ($1,'EF6 short line',10,80,0,0,800,0,$2)`, [shortInvId, productShortId])
  let rejectedInsufficient = false
  try { await withTransaction(query => autoIssueDirectInvoiceStock(query, shortInvId, ADMIN)) } catch { rejectedInsufficient = true }
  ok(rejectedInsufficient, '5. auto_issue rejects outright when stock is insufficient (requesting 10, only 3 on hand) — never goes negative')

  // no warehouse set → throws
  const noWhInvId = (await one<{ id: number }>(
    `INSERT INTO sales_documents (doc_type, doc_no, customer_id, date, status, subtotal, discount_total, tax_total, total, currency, exchange_rate, base_total)
     VALUES ('invoice','EF6-NOWH-INV',$1,$2,'draft',800,0,0,800,'IRR',1,800) RETURNING id`, [customerId, today()])).id
  await pgQuery(`INSERT INTO sales_document_lines (document_id, description, qty, unit_price, discount_pct, tax_pct, line_total, line_no, product_id)
     VALUES ($1,'EF6 nowh line',1,80,0,0,80,0,$2)`, [noWhInvId, productDirId])
  let rejectedNoWh = false
  try { await withTransaction(query => autoIssueDirectInvoiceStock(query, noWhInvId, ADMIN)) } catch { rejectedNoWh = true }
  ok(rejectedNoWh, '6. auto_issue rejects a direct invoice with no fulfillment warehouse set')

  // invoice converted from a delivered order → never re-issues (do_not).
  const orderForInvId = (await one<{ id: number }>(
    `INSERT INTO sales_documents (doc_type, doc_no, customer_id, date, status, subtotal, discount_total, tax_total, total, warehouse_id, currency, exchange_rate, base_total)
     VALUES ('order','EF6-ORD-FOR-INV',$1,$2,'confirmed',480,0,0,480,$3,'IRR',1,480) RETURNING id`, [customerId, today(), whId])).id
  const orderForInvLineId = (await one<{ id: number }>(
    `INSERT INTO sales_document_lines (document_id, description, qty, unit_price, discount_pct, tax_pct, line_total, line_no, product_id)
     VALUES ($1,'EF6 ord-for-inv line',8,60,0,0,480,0,$2) RETURNING id`, [orderForInvId, productDirId])).id
  await withTransaction(async query => { const r = await reserveSalesOrderTx(query, orderForInvId, whId, ADMIN); if (!r.ok) throw new Error(r.error) })
  await deliverSalesOrder(orderForInvId, [{ lineId: orderForInvLineId, qty: 8 }], ADMIN)
  const invoiceFromDeliveredOrderId = (await one<{ id: number }>(
    `INSERT INTO sales_documents (doc_type, doc_no, customer_id, date, status, subtotal, discount_total, tax_total, total, source_id, currency, exchange_rate, base_total)
     VALUES ('invoice','EF6-INV-FROM-ORD',$1,$2,'draft',480,0,0,480,$3,'IRR',1,480) RETURNING id`, [customerId, today(), orderForInvId])).id
  await pgQuery(`INSERT INTO sales_document_lines (document_id, description, qty, unit_price, discount_pct, tax_pct, line_total, line_no, product_id)
     VALUES ($1,'EF6 ord-for-inv line',8,60,0,0,480,0,$2)`, [invoiceFromDeliveredOrderId, productDirId])
  const linesOfConverted = await directInvoiceStockLines(invoiceFromDeliveredOrderId)
  ok(linesOfConverted.length === 0, '7. an invoice converted from a delivered order (source_id set) is NEVER subject to invoice_stock_mode — no re-issue')

  // ══ Sales-return restock (audit_first finding, decision_gate answered) ══
  console.log('— sales return restocks at the ORIGINAL issue cost —')
  await pgQuery(`UPDATE sales_documents SET status='confirmed' WHERE id=$1`, [directInvId])
  const onHandBeforeReturn = (await one<{ s: number }>(`SELECT COALESCE(SUM(qty),0)::float AS s FROM inv_moves WHERE product_id=$1`, [productDirId])).s
  const cnRes = await createSalesReturn(directInvId, { userId: ADMIN })
  ok(!!cnRes.ok && !!cnRes.id, '8. a return credit note is created against the direct invoice')
  await pgQuery(`UPDATE sales_documents SET status='confirmed' WHERE id=$1`, [cnRes.id])
  const restockRes = await restockSalesReturn(cnRes.id!, ADMIN)
  ok(restockRes.restocked.length === 1 && restockRes.restocked[0].productId === productDirId, `9. the return restocked the exact product line — got ${JSON.stringify(restockRes.restocked)}`)
  ok(close(restockRes.restocked[0].unitCost, 60, 0.5), `10. restocked at the ORIGINAL issue cost (60), not a freshly recomputed one — got ${restockRes.restocked[0].unitCost}`)
  const onHandAfterReturn = (await one<{ s: number }>(`SELECT COALESCE(SUM(qty),0)::float AS s FROM inv_moves WHERE product_id=$1`, [productDirId])).s
  ok(close(onHandAfterReturn, onHandBeforeReturn + 10, 0.01), `11. on-hand increases by the full returned qty (10) — before ${onHandBeforeReturn}, after ${onHandAfterReturn}`)
  const retryRestock = await restockSalesReturn(cnRes.id!, ADMIN)
  ok(retryRestock.restocked.length === 0, '12. re-running the restock for the same credit note is idempotent (no double-restock)')

  console.log(`\nTotal: ${n}, Passed: ${n - failed}, Failed: ${failed}`)
  if (failed > 0) process.exit(1)
}
main().catch(e => { console.error(e); process.exit(1) })
