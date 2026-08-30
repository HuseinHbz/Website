/**
 * Phase 6 live-PG verification — Sales ↔ Inventory ↔ Fulfillment.
 * Committed as a permanent regression suite (rule 6: the full regression
 * history stays green in CI). Covers: reservation invariants, real
 * concurrent-transaction reservation race (Stock=10/A wants 7/B wants 7),
 * forced-failure rollback (zero partial reservation), 5 concurrent distinct
 * holds, the full order→reserve→deliver→COGS chain including a partial
 * delivery shrinking the reservation and an over-delivery rejection,
 * concurrent delivery against the same reservation, cancel before/after
 * reservation, and a final trial-balance reconciliation.
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery } from '@/lib/db'
import { createHold, stockStateFor } from '@/lib/inventory/inventoryOpsData'
import { reserveSalesOrderTx, releaseSalesOrderReservation, deliverSalesOrder } from '@/lib/erp/salesFulfillment'
import { withTransaction } from '@/lib/db'
import { trialBalance } from '@/lib/erp/ledger'
import { loadTallies } from '@/lib/erp/ledgerData'

let n = 0, failed = 0
const ok = (c: boolean, l: string) => { n++; if (c) console.log(`  ✅ ${n}. ${l}`); else { failed++; console.error(`  ❌ ${n}. ${l}`) } }
const one = async <T>(sql: string, p: unknown[] = []) => (await pgQuery<T>(sql, p))[0]

async function main() {
  await runMigrations()
  await seedDatabase()
  const ADMIN = (await one<{ id: string }>(`SELECT id FROM users ORDER BY created_at LIMIT 1`)).id
  await pgQuery(`INSERT INTO inv_warehouses (code,name_en,name_fa,active) VALUES ('WH6','Phase6 WH','Phase6 WH',1)`)
  const wh = (await one<{ id: number }>(`SELECT id FROM inv_warehouses WHERE code='WH6'`)).id
  const prod = (await pgQuery<{ id: number }>(`INSERT INTO inv_products (sku,name_en,name_fa,active,cost,created_at) VALUES ('SKU-P6','P6 Product','P6 Product',1,15000,to_char(now(),'YYYY-MM-DD HH24:MI:SS')) RETURNING id`))[0].id
  const cust = (await pgQuery<{ id: number }>(`INSERT INTO sales_customers (code,name,active,created_at,updated_at) VALUES ('CUST-P6','P6 Customer',1,to_char(now(),'YYYY-MM-DD HH24:MI:SS'),to_char(now(),'YYYY-MM-DD HH24:MI:SS')) RETURNING id`))[0].id
  // seed 10 units of stock via a direct receipt move
  await pgQuery(`INSERT INTO inv_moves (product_id,warehouse_id,type,qty,unit_cost,ref,created_by,created_at) VALUES ($1,$2,'receipt',10,15000,'SEED',$3,to_char(now(),'YYYY-MM-DD HH24:MI:SS'))`, [prod, wh, ADMIN])

  console.log('— بند 6B: reservation invariants —')
  {
    const state = await stockStateFor(prod, wh)
    ok(state.onHand === 10 && state.available === 10, `initial stock: onHand=10, available=10 — ${JSON.stringify(state)}`)
  }

  console.log('— بند 6B: RESERVATION CONCURRENCY (real PG, Stock=10, A wants 7, B wants 7) —')
  {
    const results = await Promise.allSettled([
      createHold({ productId: prod, warehouseId: wh, kind: 'reserve', qty: 7, ref: 'CONC-A' }, ADMIN),
      createHold({ productId: prod, warehouseId: wh, kind: 'reserve', qty: 7, ref: 'CONC-B' }, ADMIN),
    ])
    const succeeded = results.filter(r => r.status === 'fulfilled').length
    const failedCt = results.filter(r => r.status === 'rejected').length
    ok(succeeded === 1 && failedCt === 1, `exactly one of two concurrent 7-unit holds succeeded (stock=10) — succeeded=${succeeded} failed=${failedCt}`)
    const state = await stockStateFor(prod, wh)
    ok(state.reserved === 7 && state.available === 3, `reserved=7, available=3 (never 14/‑4) — ${JSON.stringify(state)}`)
    // clean up for the next section
    await pgQuery(`UPDATE inv_reservations SET status='released' WHERE product_id=$1 AND warehouse_id=$2 AND status='active'`, [prod, wh])
  }

  console.log('— بند 6B: reservation rollback (forced failure) —')
  {
    const before = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM inv_reservations WHERE product_id=$1`, [prod])
    let threw = false
    try {
      await withTransaction(async query => {
        await query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [`stock:${prod}:${wh}`])
        await query(`INSERT INTO inv_reservations (product_id,warehouse_id,kind,qty,ref,status,created_by,created_at) VALUES ($1,$2,'reserve',3,'RBTEST','active',$3,to_char(now(),'YYYY-MM-DD HH24:MI:SS'))`, [prod, wh, ADMIN])
        await query(`INSERT INTO inv_reservations (product_id,warehouse_id,kind,qty,ref,status,created_by) VALUES ($1,$2,'reserve',3,'RBTEST2','active',999999)`, [999999999, wh]) // FK violation forces rollback
      })
    } catch { threw = true }
    ok(threw, 'forced failure threw')
    const after = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM inv_reservations WHERE product_id=$1`, [prod])
    ok(after.c === before.c, `reservation count unchanged — no partial reservation survived (before=${before.c}, after=${after.c})`)
  }

  console.log('— بند 6B/6N: 5 concurrent identical reservation requests —')
  {
    await pgQuery(`INSERT INTO inv_moves (product_id,warehouse_id,type,qty,unit_cost,ref,created_by,created_at) VALUES ($1,$2,'receipt',90,15000,'SEED2',$3,to_char(now(),'YYYY-MM-DD HH24:MI:SS'))`, [prod, wh, ADMIN])
    // 5 DIFFERENT concurrent holds against ample stock (100 total) — proves
    // the lock serializes without deadlocking / losing writes, all 5 succeed.
    const results = await Promise.allSettled(Array.from({ length: 5 }, (_, i) =>
      createHold({ productId: prod, warehouseId: wh, kind: 'reserve', qty: 5, ref: `IDEM-${i}` }, ADMIN)))
    const succeeded = results.filter(r => r.status === 'fulfilled').length
    ok(succeeded === 5, `5 concurrent distinct holds against ample stock all succeed without lost writes — ${succeeded}/5`)
    await pgQuery(`UPDATE inv_reservations SET status='released' WHERE product_id=$1 AND status='active'`, [prod])
  }

  console.log('— بند 6C/6D: full sales order → reserve → deliver → COGS chain —')
  let orderId = 0, lineId = 0
  {
    const docNo = 'SO-P6-TEST'
    const order = (await pgQuery<{ id: number }>(
      `INSERT INTO sales_documents (doc_type,doc_no,customer_id,date,status,subtotal,discount_total,tax_total,total,warehouse_id,created_by,currency,exchange_rate,base_total,created_at,updated_at)
       VALUES ('order',$1,$2,to_char(now(),'YYYY-MM-DD'),'draft',60000,0,0,60000,$3,$4,'IRR',1,60000,to_char(now(),'YYYY-MM-DD HH24:MI:SS'),to_char(now(),'YYYY-MM-DD HH24:MI:SS')) RETURNING id`,
      [docNo, cust, wh, ADMIN]))[0]
    orderId = order.id
    const line = (await pgQuery<{ id: number }>(
      `INSERT INTO sales_document_lines (document_id,description,qty,unit_price,discount_pct,tax_pct,line_total,line_no,product_id) VALUES ($1,'P6 item',4,15000,0,0,60000,0,$2) RETURNING id`,
      [orderId, prod]))[0]
    lineId = line.id

    // confirm -> reserve (mirrors the route's logic directly against the data layer)
    const reserveFailure = await withTransaction(async query => {
      const r = await reserveSalesOrderTx(query, orderId, wh, ADMIN)
      if (!r.ok) return r.error
      await query(`UPDATE sales_documents SET status='confirmed' WHERE id=$1`, [orderId])
      return null
    })
    ok(reserveFailure === null, `order confirm reserves the line — ${reserveFailure}`)
    const state1 = await stockStateFor(prod, wh)
    ok(state1.reserved === 4, `4 units now reserved for the order — reserved=${state1.reserved}`)

    // deliver 3 of 4 (partial)
    const d1 = await deliverSalesOrder(orderId, [{ lineId, qty: 3 }], ADMIN)
    ok(d1.ok === true, `partial delivery of 3/4 succeeds — ${d1.error ?? ''}`)
    const state2 = await stockStateFor(prod, wh)
    ok(state2.reserved === 1, `reservation shrinks to the remainder (1) after partial delivery — reserved=${state2.reserved}`)
    ok(state2.onHand === 10 + 90 - 3, `onHand reflects the real issue move — onHand=${state2.onHand}`)

    // over-deliver the remainder -> rejected
    const dBad = await deliverSalesOrder(orderId, [{ lineId, qty: 5 }], ADMIN)
    ok(dBad.ok === false && (dBad.error ?? '').includes('exceeds reserved_remaining'), `delivering more than reserved_remaining (5 > 1) is rejected — ${dBad.error}`)

    // deliver the exact remainder
    const d2 = await deliverSalesOrder(orderId, [{ lineId, qty: 1 }], ADMIN)
    ok(d2.ok === true, `final delivery of the remaining 1 unit succeeds`)
    const state3 = await stockStateFor(prod, wh)
    ok(state3.reserved === 0, `reservation fully consumed — reserved=${state3.reserved}`)

    // COGS reconciliation: 4 units * 15000 cost = 60000
    const cogsSum = await one<{ s: number }>(
      `SELECT COALESCE(SUM(l.debit),0)::float AS s FROM gl_journal_lines l JOIN gl_journal_entries e ON e.id=l.entry_id JOIN gl_accounts a ON a.id=l.account_id WHERE a.code='5000' AND e.reference LIKE $1`, [`SHP-COGS-%`])
    ok(cogsSum.s === 60000, `total COGS posted for this order's deliveries = 4*15000 = 60000 — actual ${cogsSum.s}`)
    const invCredit = await one<{ s: number }>(
      `SELECT COALESCE(SUM(l.credit),0)::float AS s FROM gl_journal_lines l JOIN gl_journal_entries e ON e.id=l.entry_id JOIN gl_accounts a ON a.id=l.account_id WHERE a.code='1200' AND e.reference LIKE $1`, [`SHP-COGS-%`])
    ok(invCredit.s === 60000, `inventory asset credited by the same total — Dr COGS = Cr Inventory (${invCredit.s})`)
  }

  console.log('— بند 6D: DELIVERY CONCURRENCY (Reserved=10, A delivers 7, B delivers 7) —')
  {
    await pgQuery(`INSERT INTO inv_moves (product_id,warehouse_id,type,qty,unit_cost,ref,created_by,created_at) VALUES ($1,$2,'receipt',20,15000,'SEED3',$3,to_char(now(),'YYYY-MM-DD HH24:MI:SS'))`, [prod, wh, ADMIN])
    const order = (await pgQuery<{ id: number }>(
      `INSERT INTO sales_documents (doc_type,doc_no,customer_id,date,status,subtotal,discount_total,tax_total,total,warehouse_id,created_by,currency,exchange_rate,base_total,created_at,updated_at)
       VALUES ('order','SO-P6-CONC',$1,to_char(now(),'YYYY-MM-DD'),'confirmed',150000,0,0,150000,$2,$3,'IRR',1,150000,to_char(now(),'YYYY-MM-DD HH24:MI:SS'),to_char(now(),'YYYY-MM-DD HH24:MI:SS')) RETURNING id`,
      [cust, wh, ADMIN]))[0]
    const line = (await pgQuery<{ id: number }>(
      `INSERT INTO sales_document_lines (document_id,description,qty,unit_price,discount_pct,tax_pct,line_total,line_no,product_id) VALUES ($1,'P6 conc item',10,15000,0,0,150000,0,$2) RETURNING id`,
      [order.id, prod]))[0]
    await createHold({ productId: prod, warehouseId: wh, kind: 'reserve', qty: 10, ref: `SO-${order.id}-${line.id}` }, ADMIN)

    const results = await Promise.allSettled([
      deliverSalesOrder(order.id, [{ lineId: line.id, qty: 7 }], ADMIN),
      deliverSalesOrder(order.id, [{ lineId: line.id, qty: 7 }], ADMIN),
    ])
    const oks = results.filter(r => r.status === 'fulfilled' && (r.value as { ok: boolean }).ok).length
    ok(oks === 1, `exactly one of two concurrent 7-unit deliveries (reserved=10) succeeded — ${oks}/2`)
    const totalDelivered = await one<{ s: number }>(
      `SELECT COALESCE(SUM(-qty),0)::float AS s FROM inv_moves WHERE product_id=$1 AND warehouse_id=$2 AND type='issue' AND ref LIKE $3`,
      [prod, wh, `SHP-%`])
    // total issue moves across ALL tests so far in this product — restrict window: just check this order's shipments
    const thisOrderDelivered = await one<{ s: number }>(
      `SELECT COALESCE(SUM(shl.qty),0)::float AS s FROM inv_shipment_lines shl JOIN inv_shipments sh ON sh.id=shl.shipment_id WHERE sh.sales_document_id=$1`, [order.id])
    ok(thisOrderDelivered.s <= 10 + 0.001, `total delivered for this order never exceeds reserved (10) — delivered=${thisOrderDelivered.s}`)
    ok(thisOrderDelivered.s === 7, `total delivered for this order is exactly 7 (one success, one rejected) — delivered=${thisOrderDelivered.s}`)
    void totalDelivered
  }

  console.log('— بند 6H: cancel before/after reservation —')
  {
    const order = (await pgQuery<{ id: number }>(
      `INSERT INTO sales_documents (doc_type,doc_no,customer_id,date,status,subtotal,discount_total,tax_total,total,warehouse_id,created_by,currency,exchange_rate,base_total,created_at,updated_at)
       VALUES ('order','SO-P6-CANCEL',$1,to_char(now(),'YYYY-MM-DD'),'draft',30000,0,0,30000,$2,$3,'IRR',1,30000,to_char(now(),'YYYY-MM-DD HH24:MI:SS'),to_char(now(),'YYYY-MM-DD HH24:MI:SS')) RETURNING id`,
      [cust, wh, ADMIN]))[0]
    const line = (await pgQuery<{ id: number }>(
      `INSERT INTO sales_document_lines (document_id,description,qty,unit_price,discount_pct,tax_pct,line_total,line_no,product_id) VALUES ($1,'cancel item',2,15000,0,0,30000,0,$2) RETURNING id`,
      [order.id, prod]))[0]
    // cancel before reservation -> nothing to release
    const releasedBefore = await releaseSalesOrderReservation(order.id)
    ok(releasedBefore === 0, 'cancel before reservation releases zero rows (nothing was ever reserved)')
    // now confirm+reserve, then cancel -> reservation released
    await withTransaction(async query => {
      await reserveSalesOrderTx(query, order.id, wh, ADMIN)
      await query(`UPDATE sales_documents SET status='confirmed' WHERE id=$1`, [order.id])
    })
    const stateReserved = await stockStateFor(prod, wh)
    ok(stateReserved.reserved >= 2, `reservation created before cancel — reserved=${stateReserved.reserved}`)
    const releasedAfter = await releaseSalesOrderReservation(order.id)
    ok(releasedAfter === 1, `cancel after reservation releases exactly 1 row — ${releasedAfter}`)
    void line
  }

  console.log('— بند 6L: final trial balance —')
  const tallies = await loadTallies()
  const tb = trialBalance(tallies)
  ok(Math.abs(tb.totalDebit - tb.totalCredit) < 0.01, `trial balance ties out — debit ${tb.totalDebit} vs credit ${tb.totalCredit}`)

  console.log(failed === 0 ? `\n✅ Phase 6 live verification: ${n}/${n} passed` : `\n❌ Phase 6 live verification: ${failed}/${n} FAILED`)
  process.exit(failed === 0 ? 0 : 1)
}
main().catch(e => { console.error(e); process.exit(1) })
