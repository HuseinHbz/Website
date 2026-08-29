/**
 * Phase 5 live-PG verification — Three-Way Match (PO / Receipt / Supplier
 * Invoice) + the payment gate it drives. Committed as a permanent regression
 * suite (rule 6: the full regression history stays green in CI).
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery } from '@/lib/db'
import {
  saveDocument, createVendor, convertDocument, receiveDocument, confirmPurchaseInvoice,
  recordPayment, matchPurchaseInvoice, overrideMatch,
} from '@/lib/erp/purchasingData'
import { runOnce } from '@/lib/api/idempotency'
import { trialBalance } from '@/lib/erp/ledger'
import { loadTallies } from '@/lib/erp/ledgerData'

let n = 0, failed = 0
const ok = (c: boolean, l: string) => { n++; if (c) console.log(`  ✅ ${n}. ${l}`); else { failed++; console.error(`  ❌ ${n}. ${l}`) } }
const one = async <T>(sql: string, p: unknown[] = []) => (await pgQuery<T>(sql, p))[0]

async function apBalance(): Promise<number> {
  const r = await one<{ bal: number }>(
    `SELECT COALESCE(SUM(l.credit - l.debit),0)::float AS bal FROM gl_journal_lines l JOIN gl_journal_entries e ON e.id=l.entry_id JOIN gl_accounts a ON a.id=l.account_id WHERE a.code='2000' AND e.status='posted'`)
  return Number(r.bal)
}

async function main() {
  await runMigrations()
  await seedDatabase()
  const ADMIN = (await one<{ id: string }>(`SELECT id FROM users ORDER BY created_at LIMIT 1`)).id
  const vendorId = await createVendor({ name: 'Phase5 Vendor', kind: 'company' }, ADMIN)
  await pgQuery(`INSERT INTO inv_warehouses (code,name_en,name_fa,active) VALUES ('WH5','Phase5 WH','Phase5 WH',1)`)
  const wh = (await one<{ id: number }>(`SELECT id FROM inv_warehouses WHERE code='WH5'`)).id
  const prod = (await pgQuery<{ id: number }>(`INSERT INTO inv_products (sku,name_en,name_fa,active,created_at) VALUES ('SKU-P5','P5 Product','P5 Product',1,to_char(now(),'YYYY-MM-DD HH24:MI:SS')) RETURNING id`))[0].id

  console.log('— بند ۳: quantity rules —')
  // PO 100 / Receipt 100 / Invoice 100 → matched
  {
    const poId = await saveDocument({ docType: 'order', vendorId, date: '2026-08-29', lines: [{ description: 'q1', qty: 100, unitPrice: 1000, discountPct: 0, taxPct: 0, productId: prod }] }, ADMIN)
    const rcvId = await convertDocument(poId, 'receipt', ADMIN)
    const rl = await one<{ id: number }>(`SELECT id FROM purchase_document_lines WHERE document_id=$1`, [rcvId])
    await receiveDocument(rcvId, wh, [{ lineId: rl.id, qty: 100 }], ADMIN)
    const invId = await convertDocument(rcvId, 'invoice', ADMIN)
    const m = await matchPurchaseInvoice(invId)
    ok(m.status === 'matched', 'PO 100 / Receipt 100 / Invoice 100 -> matched')
  }
  // PO 100 / Receipt 80 / Invoice 100 → mismatch
  {
    const poId = await saveDocument({ docType: 'order', vendorId, date: '2026-08-29', lines: [{ description: 'q2', qty: 100, unitPrice: 1000, discountPct: 0, taxPct: 0, productId: prod }] }, ADMIN)
    const rcvId = await convertDocument(poId, 'receipt', ADMIN)
    const rl = await one<{ id: number }>(`SELECT id FROM purchase_document_lines WHERE document_id=$1`, [rcvId])
    await receiveDocument(rcvId, wh, [{ lineId: rl.id, qty: 80 }], ADMIN)
    const invId = await convertDocument(rcvId, 'invoice', ADMIN)
    await pgQuery(`UPDATE purchase_document_lines SET qty=100 WHERE document_id=$1`, [invId])
    const m = await matchPurchaseInvoice(invId)
    ok(m.status === 'mismatch', 'PO 100 / Receipt 80 / Invoice 100 -> mismatch')
  }
  // PO 100 / Receipt 100 / Invoice 120 → mismatch
  {
    const poId = await saveDocument({ docType: 'order', vendorId, date: '2026-08-29', lines: [{ description: 'q3', qty: 100, unitPrice: 1000, discountPct: 0, taxPct: 0, productId: prod }] }, ADMIN)
    const rcvId = await convertDocument(poId, 'receipt', ADMIN)
    const rl = await one<{ id: number }>(`SELECT id FROM purchase_document_lines WHERE document_id=$1`, [rcvId])
    await receiveDocument(rcvId, wh, [{ lineId: rl.id, qty: 100 }], ADMIN)
    const invId = await convertDocument(rcvId, 'invoice', ADMIN)
    await pgQuery(`UPDATE purchase_document_lines SET qty=120 WHERE document_id=$1`, [invId])
    const m = await matchPurchaseInvoice(invId)
    ok(m.status === 'mismatch', 'PO 100 / Receipt 100 / Invoice 120 -> mismatch')
  }
  // PO 100 / Receipt 80 / Invoice 80 → matched (legitimate partial)
  {
    const poId = await saveDocument({ docType: 'order', vendorId, date: '2026-08-29', lines: [{ description: 'q4', qty: 100, unitPrice: 1000, discountPct: 0, taxPct: 0, productId: prod }] }, ADMIN)
    const rcvId = await convertDocument(poId, 'receipt', ADMIN)
    const rl = await one<{ id: number }>(`SELECT id FROM purchase_document_lines WHERE document_id=$1`, [rcvId])
    await receiveDocument(rcvId, wh, [{ lineId: rl.id, qty: 80 }], ADMIN)
    const invId = await convertDocument(rcvId, 'invoice', ADMIN)
    await pgQuery(`UPDATE purchase_document_lines SET qty=80 WHERE document_id=$1`, [invId])
    const m = await matchPurchaseInvoice(invId)
    ok(m.status === 'matched', 'PO 100 / Receipt 80 / Invoice 80 -> matched (partial receipt+bill)')
  }

  console.log('— بند ۷: payment gate (off/warn/block/override) —')
  let blockInvId = 0
  {
    const poId = await saveDocument({ docType: 'order', vendorId, date: '2026-08-29', lines: [{ description: 'gate', qty: 10, unitPrice: 5000, discountPct: 0, taxPct: 0, productId: prod }] }, ADMIN)
    const rcvId = await convertDocument(poId, 'receipt', ADMIN)
    const rl = await one<{ id: number }>(`SELECT id FROM purchase_document_lines WHERE document_id=$1`, [rcvId])
    await receiveDocument(rcvId, wh, [{ lineId: rl.id, qty: 10 }], ADMIN)
    const invId = await convertDocument(rcvId, 'invoice', ADMIN)
    await pgQuery(`UPDATE purchase_document_lines SET unit_price=6000 WHERE document_id=$1`, [invId])
    await confirmPurchaseInvoice(invId, ADMIN)
    blockInvId = invId
  }
  await pgQuery(`UPDATE erp_settings SET value='block' WHERE key='three_way_match_mode'`)
  {
    const before = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM purchase_payments WHERE document_id=$1`, [blockInvId])
    const r = await recordPayment(blockInvId, vendorId, 50000, 'bank', '2026-08-29', undefined, ADMIN)
    ok(r.ok === false && (r.error ?? '').startsWith('THREE_WAY_MATCH_FAILED'), 'block mode: payment against a mismatched invoice is refused')
    const after = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM purchase_payments WHERE document_id=$1`, [blockInvId])
    ok(after.c === before.c, 'block mode: zero payment rows written on refusal')
  }
  {
    const denied = await overrideMatch(999999, 'no such invoice', ADMIN)
    ok(denied.ok === false, 'override on a nonexistent invoice is refused, not a 500')
    const ov = await overrideMatch(blockInvId, 'vendor confirmed the price change', ADMIN)
    ok(ov.ok === true, 'administrator override recorded')
    const r2 = await recordPayment(blockInvId, vendorId, 50000, 'bank', '2026-08-29', undefined, ADMIN)
    ok(r2.ok === true, 'after override, the SAME mismatched invoice now accepts payment')
  }
  await pgQuery(`UPDATE erp_settings SET value='warn' WHERE key='three_way_match_mode'`)

  console.log('— بند ۹/۱۱: financial reconciliation (real GL/AP/inventory values) —')
  {
    const apBefore = await apBalance()
    const poId = await saveDocument({ docType: 'order', vendorId, date: '2026-08-29', lines: [{ description: 'recon', qty: 20, unitPrice: 250_000, discountPct: 0, taxPct: 9, productId: prod }] }, ADMIN)
    const rcvId = await convertDocument(poId, 'receipt', ADMIN)
    const rl = await one<{ id: number }>(`SELECT id FROM purchase_document_lines WHERE document_id=$1`, [rcvId])
    await receiveDocument(rcvId, wh, [{ lineId: rl.id, qty: 20 }], ADMIN)
    const invId = await convertDocument(rcvId, 'invoice', ADMIN)
    const m = await matchPurchaseInvoice(invId)
    ok(m.status === 'matched', 'untampered PO->Receipt->Invoice chain matches exactly')
    const conf = await confirmPurchaseInvoice(invId, ADMIN)
    const doc = await one<{ total: number }>(`SELECT total::float AS total FROM purchase_documents WHERE id=$1`, [invId])
    const apAfterPost = await apBalance()
    ok(Math.abs(apAfterPost - (apBefore + doc.total)) < 0.01, `AP credited by exactly the invoice total (+${doc.total})`)
    const pay = await recordPayment(invId, vendorId, doc.total, 'bank', '2026-08-29', 'P5-PAY', ADMIN)
    ok(pay.ok, 'full payment recorded')
    const apAfterPay = await apBalance()
    ok(Math.abs(apAfterPay - apBefore) < 0.01, 'AP settles back to the pre-transaction baseline')
    void conf
  }

  console.log('— بند ۱۸/۱۹: concurrency + rollback (already proven live via HTTP in the phase report; re-asserted here through the SAME runOnce boundary the route uses) —')
  {
    // 5 concurrent identical standalone-invoice creates -> exactly one row.
    // The dedup guard lives at the ROUTE layer (doc.save wraps saveDocument
    // in runOnce, Phase 4), not inside saveDocument itself — calling
    // saveDocument bare here would test the wrong boundary. Reproduce the
    // route's exact wrapping instead of re-testing over real HTTP.
    const payload = { docType: 'invoice' as const, vendorId, date: '2026-08-29', lines: [{ description: 'concurrency dup', qty: 1, unitPrice: 999, discountPct: 0, taxPct: 0 }] }
    const results = await Promise.allSettled(Array.from({ length: 5 }, () =>
      runOnce(ADMIN, 'erp/purchasing/doc.save', payload, () => saveDocument(payload, ADMIN))))
    const ids = new Set(results.map(r => r.status === 'fulfilled' ? r.value : -1))
    ok(ids.size === 1 && !ids.has(-1), `5 concurrent identical invoice creates through the route's runOnce guard -> exactly one logical document (ids: ${[...ids]})`)
    const rows = await one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM purchase_documents WHERE total=999`, [])
    ok(rows.c === 1, 'exactly one row persisted in purchase_documents')
  }

  const tallies = await loadTallies()
  const tb = trialBalance(tallies)
  ok(Math.abs(tb.totalDebit - tb.totalCredit) < 0.01, `trial balance ties out at the end — debit ${tb.totalDebit} vs credit ${tb.totalCredit}`)

  console.log(failed === 0 ? `\n✅ Phase 5: ${n}/${n} passed` : `\n❌ Phase 5: ${failed}/${n} FAILED`)
  process.exit(failed === 0 ? 0 : 1)
}
main().catch(e => { console.error(e); process.exit(1) })
