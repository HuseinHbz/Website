/**
 * ERPFIX-7 — standard financial statements + VAT structure.
 *
 * BUG-ERP-19: `loadTallies` gains a period window (`{from,to}`), so a
 * fiscal-year's revenue/expense are queryable for THAT period even after a
 * year-end closing entry nets the all-time cumulative figure to zero;
 * inactive accounts with a real posted balance no longer silently drop out
 * of the trial balance; `gl_accounts` gained a code-range-default
 * classification (current/non-current, cash-flow category) marked
 * unverified until an accountant confirms it; a pure indirect cash-flow
 * statement never silently plugs a discrepancy.
 *
 * BUG-ERP-20: the VAT rate is DATA (`tax_rates`, never seeded, fails closed
 * until confirmed); output/input VAT post through independently-configurable
 * accounts (`gl_map_vat_output`/`gl_map_vat_input`, both falling back to the
 * historical `gl_map_vat`); `runVatSettlement` nets them for a period,
 * idempotently.
 *
 * Financial assertions go through production functions (loadTallies,
 * trialBalance, classifiedBalanceSheetAsOf, cashFlowStatementFor,
 * runVatSettlement) per CLAUDE.md rule 15. Run:
 *   DATABASE_URL=… npx tsx scripts/verify-erpfix-7.ts
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery, withTransaction } from '@/lib/db'
import { createPeriod, runYearEndClosing } from '@/lib/erp/accountingData'
import { loadTallies, classifiedBalanceSheetAsOf, cashFlowStatementFor, classificationQueue } from '@/lib/erp/ledgerData'
import { trialBalance, incomeStatement } from '@/lib/erp/ledger'
import { insertPostedEntry, accountIdByCode, loadGlMap } from '@/lib/erp/glPosting'
import { currentVatRate, confirmVatRate, VatRateNotConfirmedError } from '@/lib/erp/taxData'
import { runVatSettlement } from '@/lib/erp/vatSettlement'

let n = 0, failed = 0
const ok = (c: boolean, l: string) => { n++; if (c) console.log(`  ✅ ${n}. ${l}`); else { failed++; console.error(`  ❌ ${n}. ${l}`) } }
const one = async <T>(sql: string, p: unknown[] = []) => (await pgQuery<T>(sql, p))[0]
const close = (a: number, b: number, eps = 1) => Math.abs(a - b) <= eps
const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

async function postEntry(date: string, memo: string, reference: string, lines: { code: string; debit: number; credit: number }[], userId?: string) {
  const resolved = await Promise.all(lines.map(async l => ({ accountId: await accountIdByCode(l.code), debit: l.debit, credit: l.credit })))
  const total = resolved.reduce((s, l) => s + l.debit, 0)
  return withTransaction(q => insertPostedEntry(q, date, memo, reference, total, userId, resolved))
}

async function main() {
  await runMigrations(); await seedDatabase()
  const ADMIN = (await one<{ id: string }>(`SELECT id FROM users ORDER BY created_at LIMIT 1`)).id
  await createPeriod({ name: 'EF7-2021', startDate: '2021-01-01', endDate: '2021-12-31', kind: 'year' })
  await createPeriod({ name: 'EF7-2022', startDate: '2022-01-01', endDate: '2022-12-31', kind: 'year' })

  // ══ BUG-ERP-19: period-bounded loadTallies ══════════════════════════════
  console.log('— BUG-ERP-19: a fiscal year keeps its own P&L visible after closing —')
  await postEntry('2021-06-15', 'EF7 2021 revenue', 'ef7-rev-2021',
    [{ code: '1010', debit: 5_000_000, credit: 0 }, { code: '4000', debit: 0, credit: 5_000_000 }], ADMIN)
  await postEntry('2022-03-10', 'EF7 2022 revenue', 'ef7-rev-2022',
    [{ code: '1010', debit: 7_000_000, credit: 0 }, { code: '4000', debit: 0, credit: 7_000_000 }], ADMIN)

  const all2021and2022 = incomeStatement(await loadTallies())
  ok(all2021and2022.totalRevenue >= 12_000_000, 'cumulative (no period) tally sums both years\' revenue')

  const fy2021 = (await one<{ id: number }>(`SELECT id FROM gl_fiscal_periods WHERE name='EF7-2021'`)).id
  const closeResult = await runYearEndClosing(fy2021, ADMIN)
  ok(closeResult.ok, `2021 closes cleanly (netIncome=${closeResult.netIncome})`)

  // Cumulative, all-time: the closing entry nets 2021's revenue/expense back
  // toward zero when summed together with everything else — THIS is the
  // historical behavior the bug report describes, and it is still true of
  // the all-time query by design (closing entries are real postings).
  const cumulativeAfterClose = incomeStatement(await loadTallies())
  ok(Math.abs(cumulativeAfterClose.totalRevenue - 7_000_000) < 1,
    `all-time revenue after closing 2021 reflects only the UNCLOSED year (${cumulativeAfterClose.totalRevenue})`)

  // The NEW capability: ask for exactly 2021's own activity (excluding the
  // closing entry itself, dated on the period's end date) — this is what
  // did not exist at all before this phase.
  const period2021 = incomeStatement(await loadTallies(undefined, { from: '2021-01-01', to: '2021-12-30' }))
  ok(close(period2021.totalRevenue, 5_000_000), `period-bounded query recovers 2021's own revenue (${period2021.totalRevenue})`)

  // ══ BUG-ERP-19: inactive accounts with a balance stay in the trial balance ══
  console.log('— BUG-ERP-19: a deactivated account with a real balance stays visible —')
  const dormantId = (await one<{ id: number }>(
    `INSERT INTO gl_accounts (code, name_en, name_fa, type, active) VALUES ('EF7DORM','EF7 Dormant','EF7 غیرفعال','asset',1) RETURNING id`)).id
  await postEntry('2022-01-05', 'EF7 dormant seed', 'ef7-dormant',
    [{ code: 'EF7DORM', debit: 1_234, credit: 0 }, { code: '4000', debit: 0, credit: 1_234 }], ADMIN)
  await pgQuery(`UPDATE gl_accounts SET active=0 WHERE id=$1`, [dormantId])
  const tbWithDormant = trialBalance(await loadTallies())
  ok(!!tbWithDormant.rows.find(r => r.code === 'EF7DORM'), 'deactivated account with a nonzero balance still appears in the trial balance')

  // ══ BUG-ERP-19: classification + classified balance sheet ══════════════
  console.log('— BUG-ERP-19: code-range default classification, unverified until confirmed —')
  const queue = await classificationQueue()
  ok(queue.length > 0, `classification queue is non-empty on a fresh seed (${queue.length} unverified accounts)`)
  const cbs = await classifiedBalanceSheetAsOf()
  ok(cbs.unverifiedCount === queue.length, 'classified balance sheet reports the same unverified count as the queue')
  ok(cbs.totalCurrentAssets !== 0 || cbs.totalNonCurrentAssets !== 0, 'classified balance sheet actually splits current/non-current (not a flat dump)')

  // ══ BUG-ERP-19: indirect cash-flow statement, reconciled, never plugged ══
  console.log('— BUG-ERP-19: indirect cash-flow statement reconciles real bank movement —')
  await createPeriod({ name: 'EF7-CF', startDate: '2023-01-01', endDate: '2023-12-31', kind: 'year' })
  await postEntry('2023-02-01', 'EF7 CF sale', 'ef7-cf-sale',
    [{ code: '1010', debit: 2_000_000, credit: 0 }, { code: '4000', debit: 0, credit: 2_000_000 }], ADMIN)
  await postEntry('2023-02-10', 'EF7 CF expense (cash)', 'ef7-cf-exp',
    [{ code: '6100', debit: 300_000, credit: 0 }, { code: '1010', debit: 0, credit: 300_000 }], ADMIN)
  const cf = await cashFlowStatementFor(undefined, '2023-01-01', '2023-12-31')
  ok(close(cf.actualCashChange, 1_700_000), `actual cash change matches the real bank movement (${cf.actualCashChange})`)
  ok(cf.reconciled, `cash-flow statement reconciles (unexplained=${cf.unexplained})`)

  // ══ BUG-ERP-20: VAT rate fails closed until confirmed ═══════════════════
  console.log('— BUG-ERP-20: VAT rate is data, fails closed until an accountant confirms it —')
  let failedClosed = false
  try { await currentVatRate('2024-01-01') } catch (e) { failedClosed = e instanceof VatRateNotConfirmedError }
  ok(failedClosed, 'currentVatRate throws (never guesses a default) when nothing is confirmed')
  await confirmVatRate(10, '2024-01-01', ADMIN)
  const confirmed = await currentVatRate('2024-06-01')
  ok(confirmed.rate === 10, `currentVatRate returns the confirmed rate for a date on/after effective_from (${confirmed.rate})`)
  let stillFailsBefore = false
  try { await currentVatRate('2023-01-01') } catch (e) { stillFailsBefore = e instanceof VatRateNotConfirmedError }
  ok(stillFailsBefore, 'a confirmed rate does not retroactively apply before its effective_from date')

  // ══ BUG-ERP-20: separate output/input VAT accounts ══════════════════════
  console.log('— BUG-ERP-20: output/input VAT post to independently-configurable accounts —')
  const mapDefault = await loadGlMap()
  ok(mapDefault.vatOutput === mapDefault.vat && mapDefault.vatInput === mapDefault.vat, 'un-configured install: both fall back to the single historical gl_map_vat account')
  const vatOutAccId = (await one<{ id: number }>(
    `INSERT INTO gl_accounts (code, name_en, name_fa, type, active) VALUES ('EF7VATOUT','EF7 VAT Output','EF7 مالیات خروجی','liability',1) RETURNING id`)).id
  const vatInAccId = (await one<{ id: number }>(
    `INSERT INTO gl_accounts (code, name_en, name_fa, type, active) VALUES ('EF7VATIN','EF7 VAT Input','EF7 مالیات ورودی','asset',1) RETURNING id`)).id
  void vatOutAccId; void vatInAccId
  await pgQuery(
    `INSERT INTO erp_settings (key, value, updated_at) VALUES ('gl_map_vat_output','EF7VATOUT',${NOW}),('gl_map_vat_input','EF7VATIN',${NOW})
     ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`)
  const mapSplit = await loadGlMap()
  ok(mapSplit.vatOutput === 'EF7VATOUT' && mapSplit.vatInput === 'EF7VATIN', 'configured install: output/input resolve to their own distinct accounts')

  // ══ BUG-ERP-20: periodic VAT settlement, idempotent ══════════════════════
  console.log('— BUG-ERP-20: VAT settlement nets output vs input for a period, idempotently —')
  await createPeriod({ name: 'EF7-VAT', startDate: '2025-01-01', endDate: '2025-12-31', kind: 'year' })
  await postEntry('2025-01-15', 'EF7 sale with output VAT', 'ef7-vat-sale',
    [{ code: '1010', debit: 1_100_000, credit: 0 }, { code: '4000', debit: 0, credit: 1_000_000 }, { code: 'EF7VATOUT', debit: 0, credit: 100_000 }], ADMIN)
  await postEntry('2025-01-20', 'EF7 purchase with input VAT', 'ef7-vat-purchase',
    [{ code: '6100', debit: 400_000, credit: 0 }, { code: 'EF7VATIN', debit: 40_000, credit: 0 }, { code: '2000', debit: 0, credit: 440_000 }], ADMIN)
  const settlement1 = await runVatSettlement('2025-01-01', '2025-01-31', undefined, ADMIN)
  ok(close(settlement1.outputVat, 100_000) && close(settlement1.inputVat, 40_000), `settlement nets the real period figures (out=${settlement1.outputVat}, in=${settlement1.inputVat})`)
  ok(close(settlement1.netPayable, 60_000), `net payable = output - input (${settlement1.netPayable})`)
  ok(!!settlement1.entryId, 'a balanced transfer entry is posted when output/input are different accounts')
  const settlement2 = await runVatSettlement('2025-01-01', '2025-01-31', undefined, ADMIN)
  ok(settlement2.alreadySettled === true && settlement2.entryId === settlement1.entryId, 'a retried settlement for the same period is idempotent — no second entry')
  const afterSettleTb = trialBalance(await loadTallies(undefined, { to: '2025-01-31' }))
  const outRow = afterSettleTb.rows.find(r => r.code === 'EF7VATOUT')
  const inRow = afterSettleTb.rows.find(r => r.code === 'EF7VATIN')
  ok(!outRow || close((outRow?.credit ?? 0) - (outRow?.debit ?? 0), 0), 'output VAT account nets to zero after settlement')
  ok(!inRow || close((inRow?.debit ?? 0) - (inRow?.credit ?? 0), 0), 'input VAT account nets to zero after settlement')

  console.log(`\nTotal: ${n}, Passed: ${n - failed}, Failed: ${failed}`)
  process.exit(failed === 0 ? 0 : 1)
}
main().catch(e => { console.error(e); process.exit(1) })
