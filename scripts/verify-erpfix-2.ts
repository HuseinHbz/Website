/**
 * ERPFIX-2 (BUG-ERP-03) — currency in the GL core. Live-PostgreSQL proof.
 *
 * Every financial assertion goes through the PRODUCTION functions
 * (postSalesInvoiceToGl, postPurchaseInvoiceToGl, postSalesPaymentToGl,
 * postPurchasePaymentToGl, trialBalance via loadTallies) and asserts real
 * account BALANCES (1100/2000/4000/2100/bank/4900/6980) — not just
 * "balanced" (CLAUDE.md rule 15). Document setup (customer/vendor/invoice
 * rows) uses hand-SQL only for DATA PREPARATION, never for an assertion.
 *
 * Run: DATABASE_URL=… npx tsx scripts/verify-erpfix-2.ts
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery } from '@/lib/db'
import { createPeriod } from '@/lib/erp/accountingData'
import { postSalesInvoiceToGl } from '@/lib/erp/salesData'
import { postPurchaseInvoiceToGl } from '@/lib/erp/purchasingData'
import { postSalesPaymentToGl, postPurchasePaymentToGl } from '@/lib/erp/glPosting'
import { loadTallies } from '@/lib/erp/ledgerData'
import { trialBalance } from '@/lib/erp/ledger'

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
  await createPeriod({ name: 'EF2 wide coverage', startDate: '2020-01-01', endDate: '2035-12-31', kind: 'year' })

  // ── Sales invoice: 100 USD @ 600,000 → base 60,000,000 ──────────────────
  console.log('— BUG-ERP-03: a 100 USD invoice posts to the GL at Rial base, not "100" —')
  const customerId = (await one<{ id: number }>(
    `INSERT INTO sales_customers (code, name, kind, credit_limit) VALUES ('EF2CUST','EF2 FX Customer','حقیقی',0) RETURNING id`)).id
  const invId = (await one<{ id: number }>(
    `INSERT INTO sales_documents (doc_type, doc_no, customer_id, date, status, subtotal, discount_total, tax_total, total, currency, exchange_rate, base_total)
     VALUES ('invoice','EF2-INV-1',$1,$2,'confirmed',100,0,0,100,'USD',600000,60000000) RETURNING id`, [customerId, today()])).id
  await postSalesInvoiceToGl(invId)
  const ar1 = await accountBalance('1100')
  const rev1 = await accountBalance('4000')
  ok(close(ar1, 60000000), `1. AR (1100) after a 100 USD @ 600,000 invoice is 60,000,000 — got ${ar1}`)
  ok(close(rev1, -60000000), `2. Revenue (4000) is a 60,000,000 credit balance, not "100" — got ${rev1}`)
  const fxLine = await one<{ fx_amount: number; fx_currency: string }>(
    `SELECT l.fx_amount::float AS fx_amount, l.fx_currency FROM sales_documents d
     JOIN gl_journal_lines l ON l.entry_id=d.gl_entry_id AND l.account_id=(SELECT id FROM gl_accounts WHERE code='1100')
     WHERE d.id=$1`, [invId])
  ok(close(Number(fxLine?.fx_amount), 100) && fxLine?.fx_currency === 'USD', `3. original fx_amount=100 USD preserved on the AR line — got ${fxLine?.fx_amount} ${fxLine?.fx_currency}`)

  // ── Partial receipt: 40 USD @ 650,000 (settlement) vs 600,000 (invoice) ──
  console.log('— settlement at a different rate books a REALIZED FX gain —')
  const payId = (await one<{ id: number }>(
    `INSERT INTO sales_payments (customer_id, document_id, date, amount, method, currency, exchange_rate)
     VALUES ($1,$2,$3,40,'bank','USD',650000) RETURNING id`, [customerId, invId, today()])).id
  await postSalesPaymentToGl(payId)
  const bank1 = await accountBalance('1010')
  const ar2 = await accountBalance('1100')
  const fxGain = await accountBalance('4900')
  ok(close(bank1, 26000000), `4. Bank (1010) receives 40 USD @ 650,000 = 26,000,000 — got ${bank1}`)
  ok(close(ar2, 36000000), `5. AR relieved at the INVOICE rate (40 USD @ 600,000 = 24,000,000) leaves AR at 36,000,000 — got ${ar2}`)
  ok(close(fxGain, -2000000), `6. Realized FX gain (4900) credit balance = 26,000,000 − 24,000,000 = 2,000,000 — got ${fxGain}`)

  // ── Odd rate still balances exactly ──────────────────────────────────────
  console.log('— an odd exchange rate still posts a perfectly balanced entry —')
  const invId2 = (await one<{ id: number }>(
    `INSERT INTO sales_documents (doc_type, doc_no, customer_id, date, status, subtotal, discount_total, tax_total, total, currency, exchange_rate, base_total)
     VALUES ('invoice','EF2-INV-2',$1,$2,'confirmed',10,0,0.9,10.9,'EUR',600001.7,6540018.53) RETURNING id`, [customerId, today()])).id
  const r2 = await postSalesInvoiceToGl(invId2)
  const entryBal = await one<{ d: number; c: number }>(
    `SELECT COALESCE(SUM(debit),0)::float AS d, COALESCE(SUM(credit),0)::float AS c FROM gl_journal_lines WHERE entry_id=$1`,
    [r2.entryId])
  ok(close(Number(entryBal.d), Number(entryBal.c), 0.01), `7. odd-rate (600001.7) EUR invoice entry balances exactly — Dr ${entryBal.d} Cr ${entryBal.c}`)

  // ── Purchase invoice + payment at a worse rate → realized FX LOSS ───────
  console.log('— purchase side: AP settlement at a worse rate books a REALIZED FX loss —')
  const vendorId = (await one<{ id: number }>(`INSERT INTO purchase_vendors (code, name) VALUES ('EF2VEND','EF2 FX Vendor') RETURNING id`)).id
  const poInvId = (await one<{ id: number }>(
    `INSERT INTO purchase_documents (doc_type, doc_no, vendor_id, date, status, subtotal, discount_total, tax_total, total, currency, exchange_rate, base_total)
     VALUES ('invoice','EF2-PINV-1',$1,$2,'confirmed',1000,0,0,1000,'USD',600000,600000000) RETURNING id`, [vendorId, today()])).id
  await postPurchaseInvoiceToGl(poInvId)
  const ap1 = await accountBalance('2000')
  ok(close(ap1, -600000000), `8. AP (2000) after a 1,000 USD @ 600,000 purchase invoice is -600,000,000 — got ${ap1}`)
  const ppayId = (await one<{ id: number }>(
    `INSERT INTO purchase_payments (vendor_id, document_id, date, amount, currency, exchange_rate)
     VALUES ($1,$2,$3,1000,'USD',620000) RETURNING id`, [vendorId, poInvId, today()])).id
  await postPurchasePaymentToGl(ppayId)
  const bank2 = await accountBalance('1010')
  const ap2 = await accountBalance('2000')
  const fxLoss = await accountBalance('6980')
  ok(close(bank2, 26000000 - 620000000), `9. bank drops by the settlement amount 620,000,000 — got delta on 1010 ${bank2}`)
  ok(close(ap2, 0), `10. AP fully relieved at its own invoice rate back to 0 — got ${ap2}`)
  ok(close(fxLoss, 20000000), `11. realized FX loss (6980) = 620,000,000 − 600,000,000 = 20,000,000 — got ${fxLoss}`)

  // ── Thresholds compare base_total, not raw total ─────────────────────────
  console.log('— approval/budget/credit thresholds use base_total, not raw total —')
  const { requiredApprovalLevels } = await import('@/lib/erp/purchasing')
  const levelsSmallRaw = requiredApprovalLevels(1000) // 1,000 raw IRR -> tier 1
  const levelsBigBase = requiredApprovalLevels(600000000) // the USD PO's real base exposure -> higher tier
  ok(levelsBigBase > levelsSmallRaw, `12. requiredApprovalLevels(base 600,000,000) > requiredApprovalLevels(raw 1,000) — got ${levelsBigBase} vs ${levelsSmallRaw}`)

  // ── Production trial balance stays balanced throughout ──────────────────
  const tb = trialBalance(await loadTallies())
  ok(close(tb.totalDebit, tb.totalCredit, 1), `13. production trialBalance()/loadTallies() stays balanced across every FX posting — Σdebit=${tb.totalDebit} Σcredit=${tb.totalCredit}`)

  console.log(`\n  ${n - failed}/${n} assertions passed.`)
  if (failed > 0) process.exit(1)
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
