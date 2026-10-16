/**
 * ERPFIX-1 — live-PostgreSQL proof (regression suite, scripts/ci-regressions.ts).
 *
 *  BUG-ERP-08  the 5 period-lock bypasses (intercompany, FX revaluation, journal
 *              import, cycle-count adjustment, inventory revaluation) are refused
 *              and write NOTHING; year-end closing posts into a CLOSED period but
 *              never a LOCKED one; 'abc' and an out-of-period date are refused;
 *              a fresh install with no period still posts.
 *  BUG-ERP-21  the DB itself rejects a posted unbalanced entry, a duplicate
 *              entry_no and a negative / two-sided line; 20 concurrent system
 *              postings get unique numbers; concurrent year-end closing books
 *              exactly one entry; «30» and «2030» close independently; a DB that
 *              already holds duplicates migrates without failing and reports them.
 *  BUG-ERP-10  a payroll run lands on 6000 «Salaries Expense», 6100 stays 0;
 *              key balances asserted; legacy salary-on-rent entries are
 *              reclassified by the remediation (dry-run, then apply, idempotent)
 *              without touching the original posted entries.
 *  Gates       audit:gl-writes and audit:coa pass, and fail on a negative sample.
 *
 * Every financial assertion goes through production functions (loadTallies →
 * trialBalance / incomeStatement, insertPostedEntry, runYearEndClosing …);
 * hand SQL is used only to PREPARE data or to attack the DB directly.
 */
import { spawnSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery, withTransaction } from '@/lib/db'
import { createPeriod, transitionPeriod, assertPostable, runYearEndClosing, postOpeningBalance } from '@/lib/erp/accountingData'
import { bookIntercompany, loadTallies } from '@/lib/erp/ledgerData'
import { bookRevaluation } from '@/lib/erp/revaluationData'
import { setRate } from '@/lib/erp/currencyData'
import { insertPostedEntry, postEntryById, accountIdByCode } from '@/lib/erp/glPosting'
import { createJob, saveJobMapping, validateJob, approveJob, executeJob } from '@/lib/import/importData'
import { createCount, enterCount, transitionCount, postCount, revalueInventory } from '@/lib/inventory/inventoryOpsData'
import { createEmployee, addEmploymentRecord } from '@/lib/hr/employeeData'
import { openPeriod, calculatePeriod, approvePeriod, postPeriodToGl, periodTotals } from '@/lib/hr/payrollData'
import { trialBalance, incomeStatement } from '@/lib/erp/ledger'
import { remediateSalaryOnRent, salaryOnRentEntries } from '@/lib/erp/coaRemediation'
import { BusinessErrorException } from '@/lib/errors'

let pass = 0, fail = 0
function ok(cond: boolean, label: string, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { fail++; console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`) }
}
const one = async <T,>(sql: string, p: unknown[] = []) => (await pgQuery<T>(sql, p))[0]
const today = new Date().toISOString().slice(0, 10)
const year = today.slice(0, 4)
const entryCount = async () => (await one<{ n: number }>(`SELECT COUNT(*)::int AS n FROM gl_journal_entries`))!.n
async function balance(code: string): Promise<number> {
  const r = trialBalance(await loadTallies()).rows.find(x => x.code === code)
  return r ? Math.round((r.debit - r.credit) * 100) / 100 : 0
}
async function codeOf(fn: () => Promise<unknown>): Promise<string> {
  try { await fn(); return 'ok' } catch (e) {
    if (e instanceof BusinessErrorException) return e.built.code
    const pg = e as { code?: string; message?: string }
    return pg.code ? `pg:${pg.code}` : `err:${pg.message ?? String(e)}`
  }
}

async function main() {
  console.log('\n══ ERPFIX-1 — GL core (live PostgreSQL) ══')
  await runMigrations(); await seedDatabase()
  const ADMIN = (await one<{ id: string }>(`SELECT id FROM users LIMIT 1`))!.id
  const APPROVER = (await one<{ id: string }>(
    `INSERT INTO users (id,email,name,password_hash,role,active,created_at) VALUES ('erpfix1-approver','ef1@t.l','EF1','x','administrator',true,to_char(now(),'YYYY-MM-DD HH24:MI:SS'))
     ON CONFLICT (id) DO UPDATE SET active=true RETURNING id`))!.id
  const id1010 = await accountIdByCode('1010'), id4000 = await accountIdByCode('4000'), id3000 = await accountIdByCode('3000')

  console.log('\n— seeds (assert name + type after seeding) —')
  const s = await pgQuery<{ code: string; name_en: string; type: string }>(`SELECT code, name_en, type FROM gl_accounts WHERE code IN ('6000','6100') ORDER BY code`)
  ok(s[0]?.name_en === 'Salaries Expense' && s[0]?.type === 'expense', '6000 is «Salaries Expense» (expense)')
  ok(s[1]?.name_en === 'Rent Expense' && s[1]?.type === 'expense', '6100 is still «Rent Expense» (expense) — never renamed')
  const settings = Object.fromEntries((await pgQuery<{ key: string; value: string }>(`SELECT key, value FROM erp_settings WHERE key IN ('gl_map_payroll_expense','gl_require_period')`)).map(r => [r.key, r.value]))
  ok(settings.gl_map_payroll_expense === '6000', 'payroll-expense map defaults to 6000', settings.gl_map_payroll_expense)
  ok(settings.gl_require_period === 'strict', "gl_require_period seeded 'strict'")
  const fmts = await pgQuery<{ doc_type: string }>(`SELECT doc_type FROM numbering_formats WHERE doc_type IN ('gl_opening','gl_year_end','gl_intercompany','gl_revaluation')`)
  ok(fmts.length === 4, 'Numbering Engine formats seeded for OB/YEC/IC/FXR', fmts.map(f => f.doc_type).join(','))

  // ── fresh install, no fiscal period at all → still posts ───────────────────
  console.log('\n— BUG-ERP-08: a fresh install with no period still posts —')
  const co1 = (await one<{ id: number }>(`SELECT id FROM erp_companies WHERE is_default`))!.id
  const co2 = (await one<{ id: number }>(`INSERT INTO erp_companies (code,name_en,name_fa) VALUES ('EF1B','ERPFIX Two','دوم') RETURNING id`))!.id
  const icFresh = await bookIntercompany({ kind: 'transfer', fromCompanyId: co1, toCompanyId: co2, amount: 5000, date: today }, ADMIN)
  ok(icFresh.entryIds.length === 2, 'intercompany posts with zero periods defined', icFresh.entryNos.join(', '))
  ok(icFresh.entryNos.every(n => /^IC-\d{4}-\d{5}$/.test(n)), 'IC numbers come from the Numbering Engine, not Date.now()', icFresh.entryNos.join(', '))

  // ── BUG-ERP-10: payroll lands on salaries ─────────────────────────────────
  console.log('\n— BUG-ERP-10: payroll posts to 6000, not 6100 —')
  const emp = await createEmployee({ firstName: 'حقوق', lastName: 'سبز', hireDate: '2024-01-01', status: 'active', maritalStatus: 'single', childrenCount: 0 }, ADMIN)
  await addEmploymentRecord(emp, { startDate: '2024-01-01', baseSalary: 300_000_000, contractType: 'permanent' }, ADMIN)
  const p1 = await openPeriod(1405, 5, ADMIN); await calculatePeriod(p1.id!, ADMIN); await approvePeriod(p1.id!, APPROVER)
  const post1 = await postPeriodToGl(p1.id!, APPROVER)
  ok(post1.ok === true, 'payroll period posts', JSON.stringify(post1))
  const t1 = await periodTotals(p1.id!)
  const is1 = incomeStatement(await loadTallies())
  const sal = is1.expenses.find(r => r.code === '6000'), rent = is1.expenses.find(r => r.code === '6100')
  ok(sal?.amount === t1.gross, '🔴 income statement: «Salaries Expense» 6000 carries the gross', `${sal?.amount} = ${t1.gross}`)
  ok(!rent || rent.amount === 0, '🔴 income statement: 6100 «Rent Expense» carries nothing', String(rent?.amount ?? 0))
  ok(await balance('6100') === 0, '6100 balance is 0')
  ok(Math.abs(await balance('2300') + (t1.net + t1.otherDeductions)) < 0.01, 'salaries payable 2300 credited with the net', String(await balance('2300')))
  ok(Math.abs(await balance('2310') + (t1.employeeInsurance + t1.employerInsurance + t1.unemploymentInsurance)) < 0.01, 'insurance payable 2310 carries both shares', String(await balance('2310')))
  ok(Math.abs(await balance('2320') + t1.tax) < 0.01, 'payroll tax payable 2320 carries the withheld tax', String(await balance('2320')))
  ok(trialBalance(await loadTallies()).balanced, 'trial balance balanced')
  const again = await postPeriodToGl(p1.id!, APPROVER)
  ok(again.alreadyPosted === true && await balance('6000') === t1.gross, 'payroll posting stays idempotent (gl_entry_id under lock)')

  console.log('\n— BUG-ERP-10: legacy salary-on-rent entries are reclassified (dry-run → apply) —')
  // Simulate a pre-fix posting: the map pointed at 6100 when this month posted.
  await pgQuery(`UPDATE erp_settings SET value='6100' WHERE key='gl_map_payroll_expense'`)
  const p2 = await openPeriod(1405, 6, ADMIN); await calculatePeriod(p2.id!, ADMIN); await approvePeriod(p2.id!, APPROVER)
  const post2 = await postPeriodToGl(p2.id!, APPROVER)
  await pgQuery(`UPDATE erp_settings SET value='6000' WHERE key='gl_map_payroll_expense'`)
  const t2 = await periodTotals(p2.id!)
  ok(await balance('6100') === t2.gross, 'legacy fixture: a month of salaries sits on 6100', String(await balance('6100')))
  const legacyLinesBefore = await pgQuery(`SELECT account_id, debit::float, credit::float FROM gl_journal_lines WHERE entry_id=$1 ORDER BY line_no`, [post2.entryId])
  const dry = await remediateSalaryOnRent({ apply: false })
  ok(dry.groups.length === 1 && dry.groups[0].entries.length === 1 && dry.groups[0].entries[0].entryId === post2.entryId, 'dry-run lists exactly the legacy payroll entry', JSON.stringify(dry.groups.map(g => g.entries.map(e => e.entryNo))))
  ok(await balance('6100') === t2.gross && dry.posted.length === 0, 'dry-run wrote nothing')
  const applied = await remediateSalaryOnRent({ apply: true, userId: ADMIN })
  ok(applied.posted.length === 1, 'apply books ONE corrective entry for the open period', JSON.stringify(applied.posted))
  ok(await balance('6100') === 0, '🔴 after apply the salary part of 6100 is 0')
  ok(await balance('6000') === Math.round((t1.gross + t2.gross) * 100) / 100, '6000 now carries both months', String(await balance('6000')))
  const legacyLinesAfter = await pgQuery(`SELECT account_id, debit::float, credit::float FROM gl_journal_lines WHERE entry_id=$1 ORDER BY line_no`, [post2.entryId])
  const legacyEntry = await one<{ status: string; reversed_by: number | null }>(`SELECT status, reversed_by FROM gl_journal_entries WHERE id=$1`, [post2.entryId])
  ok(JSON.stringify(legacyLinesBefore) === JSON.stringify(legacyLinesAfter) && legacyEntry?.status === 'posted' && legacyEntry.reversed_by == null, 'the original posted entry is untouched (no edit, no void)')
  const rerun = await remediateSalaryOnRent({ apply: true, userId: ADMIN })
  ok(rerun.posted.length === 0 && (await salaryOnRentEntries()).length === 0, 'remediation is idempotent (second apply posts nothing)')
  ok(trialBalance(await loadTallies()).balanced, 'trial balance balanced after remediation')

  // ── BUG-ERP-08: the five bypasses ─────────────────────────────────────────
  console.log('\n— BUG-ERP-08: a closed period refuses all five former bypasses —')
  await pgQuery(`INSERT INTO assets (name, currency, purchase_price, exchange_rate, status) VALUES ('EF1 USD server','USD',1000,500000,'active')`)
  await setRate('USD', today, 600000, ADMIN)
  const wh = (await one<{ id: number }>(`INSERT INTO inv_warehouses (code,name_en) VALUES ('EF1-WH','EF1 WH') RETURNING id`))!.id
  const prod = (await one<{ id: number }>(`INSERT INTO inv_products (sku,name_en,cost) VALUES ('EF1-SKU','EF1 product',1000) RETURNING id`))!.id
  await pgQuery(`INSERT INTO inv_moves (product_id, warehouse_id, type, qty, unit_cost, ref, created_at) VALUES ($1,$2,'receipt',10,1000,'ef1',to_char(now(),'YYYY-MM-DD HH24:MI:SS'))`, [prod, wh])
  const count = await createCount(wh, ADMIN)
  await enterCount(count.id, [{ productId: prod, countedQty: 8 }])
  await transitionCount(count.id, 'submitted', ADMIN); await transitionCount(count.id, 'approved', ADMIN)
  const csv = `ref,date,account,debit,credit,memo\nEV1,${today},1010,500,0,ef1\nEV1,${today},3000,0,500,ef1\n`
  const job = await createJob({ entityType: 'journal', name: 'ef1.csv', fileName: 'ef1.csv', content: csv }, ADMIN)
  await saveJobMapping(job.id, job.suggested, 'skip'); await validateJob(job.id); await approveJob(job.id, { id: ADMIN, role: 'super_admin' })
  // An open year covering the payroll months + today, then a CLOSED month around today.
  const fyNow = await createPeriod({ name: `FY${year}`, startDate: `${year}-01-01`, endDate: `${year}-12-31`, kind: 'year' })
  const closedMonth = await createPeriod({ name: `${year}-10 closed`, startDate: `${year}-10-01`, endDate: `${year}-10-31`, kind: 'period', parentId: fyNow })
  await transitionPeriod(closedMonth, 'closed', ADMIN)
  const movesBefore = (await one<{ n: number }>(`SELECT COUNT(*)::int AS n FROM inv_moves`))!.n
  const paths: [string, () => Promise<unknown>][] = [
    ['intercompany', () => bookIntercompany({ kind: 'transfer', fromCompanyId: co1, toCompanyId: co2, amount: 1000, date: today }, ADMIN)],
    ['fx revaluation', () => bookRevaluation(ADMIN)],
    ['journal import', () => executeJob(job.id, ADMIN)],
    ['cycle-count adjustment', () => postCount(count.id, ADMIN)],
    ['inventory revaluation', () => revalueInventory({ productId: prod, warehouseId: wh, newUnitCost: 1200 }, ADMIN)],
  ]
  for (const [name, fn] of paths) {
    const before = await entryCount()
    const code = await codeOf(fn)
    const after = await entryCount()
    ok(code === 'ERP-FINANCE-PERIOD-CLOSED' && after === before, `🔴 ${name} is refused in the closed period and writes no entry`, `${code}, entries ${before}→${after}`)
  }
  ok((await one<{ n: number }>(`SELECT COUNT(*)::int AS n FROM inv_moves`))!.n === movesBefore, 'the refused count wrote no adjustment move')
  ok((await one<{ status: string }>(`SELECT status FROM inv_counts WHERE id=$1`, [count.id]))!.status === 'approved', 'the refused count stays approved (retryable)')
  ok(Number((await one<{ cost: string }>(`SELECT cost FROM inv_products WHERE id=$1`, [prod]))!.cost) === 1000, 'the refused revaluation did not change the product cost')
  ok((await one<{ status: string }>(`SELECT status FROM import_jobs WHERE id=$1`, [job.id]))!.status === 'failed', 'the refused import job is marked failed (nothing imported)')

  console.log('\n— BUG-ERP-08: date validation + strict periods —')
  ok(await codeOf(() => withTransaction(q => insertPostedEntry(q, 'abc', 'x', 'x', ADMIN, [{ accountId: id1010, debit: 1, credit: 0 }, { accountId: id3000, debit: 0, credit: 1 }]))) === 'ERP-FINANCE-INVALID-DATE', "🔴 date 'abc' is refused")
  ok((await assertPostable('2025-02-30')).block === 'invalid_date', "assertPostable('2025-02-30') → invalid_date")
  ok(await codeOf(() => withTransaction(q => insertPostedEntry(q, '2031-03-03', 'x', 'x', ADMIN, [{ accountId: id1010, debit: 1, credit: 0 }, { accountId: id3000, debit: 0, credit: 1 }]))) === 'ERP-FINANCE-DATE-OUTSIDE-PERIODS', '🔴 a date outside every defined period is refused (strict)')
  await pgQuery(`UPDATE erp_settings SET value='off' WHERE key='gl_require_period'`)
  ok((await assertPostable('2031-03-03')).ok === true, "gl_require_period='off' restores the legacy rule")
  await pgQuery(`UPDATE erp_settings SET value='strict' WHERE key='gl_require_period'`)
  ok(await codeOf(() => withTransaction(q => insertPostedEntry(q, today, 'x', 'x', ADMIN, [{ accountId: id1010, debit: 5, credit: 0 }, { accountId: id3000, debit: 0, credit: 4 }]))) === 'ERP-FINANCE-JOURNAL-UNBALANCED', 'the core refuses an unbalanced entry')
  ok(await codeOf(() => withTransaction(q => insertPostedEntry(q, `${year}-03-03`, 'x', 'x', ADMIN, [{ accountId: id1010, debit: 5, credit: 0 }, { accountId: id3000, debit: -5, credit: 0 }]))) === 'ERP-FINANCE-JOURNAL-UNBALANCED', 'the core refuses a negative line')

  console.log('\n— BUG-ERP-08: year-end closing — closed OK, locked never —')
  const fy27 = await createPeriod({ name: 'FY2027', startDate: '2027-01-01', endDate: '2027-12-31', kind: 'year' })
  await withTransaction(q => insertPostedEntry(q, '2027-03-03', 'EF1 revenue 2027', 'ef1', ADMIN, [{ accountId: id1010, debit: 1000, credit: 0 }, { accountId: id4000, debit: 0, credit: 1000 }]))
  await transitionPeriod(fy27, 'closed', ADMIN)
  const close27 = await runYearEndClosing(fy27, ADMIN)
  ok(close27.ok === true && close27.netIncome === 1000, '🔴 year-end closing posts into a CLOSED year', JSON.stringify(close27))
  const yecNo = (await one<{ entry_no: string; reference: string }>(`SELECT entry_no, reference FROM gl_journal_entries WHERE id=$1`, [close27.entryId]))!
  ok(/^YEC-\d{4}-\d{5}$/.test(yecNo.entry_no) && yecNo.reference === `year-end-close:${fy27}`, 'closing is numbered by the engine + keyed year-end-close:<period id>', `${yecNo.entry_no} ${yecNo.reference}`)
  const fy28 = await createPeriod({ name: 'FY2028', startDate: '2028-01-01', endDate: '2028-12-31', kind: 'year' })
  await withTransaction(q => insertPostedEntry(q, '2028-03-03', 'EF1 revenue 2028', 'ef1', ADMIN, [{ accountId: id1010, debit: 700, credit: 0 }, { accountId: id4000, debit: 0, credit: 700 }]))
  await transitionPeriod(fy28, 'closed', ADMIN); await transitionPeriod(fy28, 'locked', ADMIN)
  const before28 = await entryCount()
  ok(await codeOf(() => runYearEndClosing(fy28, ADMIN)) === 'ERP-FINANCE-PERIOD-CLOSED' && await entryCount() === before28, '🔴 year-end closing is refused in a LOCKED year and writes nothing')
  ok(await codeOf(() => postOpeningBalance({ date: '2028-01-01', entries: [{ accountId: id1010, amount: 10 }, { accountId: id3000, amount: 10 }] }, ADMIN)) === 'ERP-FINANCE-PERIOD-CLOSED', 'opening balance is refused in a LOCKED year')
  const ob27 = await postOpeningBalance({ date: '2027-01-01', entries: [{ accountId: id1010, amount: 10 }, { accountId: id3000, amount: 10 }] }, ADMIN)
  ok(/^OB-\d{4}-\d{5}$/.test(ob27.entryNo), 'opening balance posts into a CLOSED year (explicit allowClosedPeriod) with an engine number', ob27.entryNo)
  ok(await codeOf(() => withTransaction(q => insertPostedEntry(q, '2027-06-06', 'x', 'x', ADMIN, [{ accountId: id1010, debit: 1, credit: 0 }, { accountId: id3000, debit: 0, credit: 1 }]))) === 'ERP-FINANCE-PERIOD-CLOSED', 'an ordinary posting is still refused in the closed year')

  // ── BUG-ERP-21: DB invariants ─────────────────────────────────────────────
  console.log('\n— BUG-ERP-21: the database itself enforces the invariants —')
  const rawUnbal = await codeOf(() => withTransaction(async q => {
    const e = (await q<{ id: number }>(`INSERT INTO gl_journal_entries (entry_no,date,memo,status,total) VALUES ('EF1-RAW','${year}-03-03','raw','posted',100) RETURNING id`))[0]
    await q(`INSERT INTO gl_journal_lines (entry_id,account_id,debit,credit,line_no) VALUES ($1,$2,100,0,0)`, [e.id, id1010])
  }))
  ok(rawUnbal === 'pg:23514' && !(await one(`SELECT 1 FROM gl_journal_entries WHERE entry_no='EF1-RAW'`)), '🔴 a raw unbalanced POSTED entry is rejected at COMMIT', rawUnbal)
  const draftOk = await codeOf(() => withTransaction(async q => {
    const e = (await q<{ id: number }>(`INSERT INTO gl_journal_entries (entry_no,date,memo,status,total) VALUES ('EF1-DRAFT','${year}-03-03','draft','draft',100) RETURNING id`))[0]
    await q(`INSERT INTO gl_journal_lines (entry_id,account_id,debit,credit,line_no) VALUES ($1,$2,100,0,0)`, [e.id, id1010])
  }))
  ok(draftOk === 'ok', 'an unbalanced DRAFT is still allowed (drafts are free)')
  const draftId = (await one<{ id: number }>(`SELECT id FROM gl_journal_entries WHERE entry_no='EF1-DRAFT'`))!.id
  const flip = await codeOf(() => pgQuery(`UPDATE gl_journal_entries SET status='posted' WHERE id=$1`, [draftId]))
  ok(flip === 'pg:23514', '🔴 flipping that draft to posted with raw SQL is rejected at commit', flip)
  const viaCore = await postEntryById(draftId)
  ok(viaCore.ok === false, 'postEntryById refuses it too', viaCore.error)
  const dupNo = await codeOf(() => pgQuery(`INSERT INTO gl_journal_entries (entry_no,date,memo,status,total) VALUES ('EF1-DUP','${year}-03-03','a','draft',0),('EF1-DUP','${year}-03-03','b','draft',0)`))
  ok(dupNo === 'pg:23505', '🔴 a duplicate entry_no is rejected', dupNo)
  const neg = await codeOf(() => pgQuery(`INSERT INTO gl_journal_lines (entry_id,account_id,debit,credit,line_no) VALUES ($1,$2,-5,0,9)`, [draftId, id1010]))
  ok(neg === 'pg:23514', '🔴 a negative line amount is rejected (CHECK)', neg)
  const twoSided = await codeOf(() => pgQuery(`INSERT INTO gl_journal_lines (entry_id,account_id,debit,credit,line_no) VALUES ($1,$2,5,5,9)`, [draftId, id1010]))
  ok(twoSided === 'pg:23514', 'a two-sided line is rejected (CHECK)', twoSided)

  console.log('\n— BUG-ERP-21: concurrency —')
  const fy29 = await createPeriod({ name: 'FY2029', startDate: '2029-01-01', endDate: '2029-12-31', kind: 'year' })
  await withTransaction(q => insertPostedEntry(q, '2029-03-03', 'EF1 revenue 2029', 'ef1', ADMIN, [{ accountId: id1010, debit: 300, credit: 0 }, { accountId: id4000, debit: 0, credit: 300 }]))
  const burst = await Promise.allSettled([
    ...Array.from({ length: 10 }, () => postOpeningBalance({ date: '2029-01-01', entries: [{ accountId: id1010, amount: 1 }, { accountId: id3000, amount: 1 }] }, ADMIN).then(r => [r.entryNo])),
    ...Array.from({ length: 10 }, () => bookIntercompany({ kind: 'transfer', fromCompanyId: co1, toCompanyId: co2, amount: 7, date: '2029-02-02' }, ADMIN).then(r => r.entryNos)),
  ])
  const minted = burst.flatMap(b => b.status === 'fulfilled' ? b.value : [])
  ok(burst.every(b => b.status === 'fulfilled') && minted.length === 30, '20 concurrent opening/intercompany postings all succeed', `${minted.length} entries`)
  ok(new Set(minted).size === minted.length, '🔴 every concurrent posting got a UNIQUE number', `${new Set(minted).size}/${minted.length}`)
  await transitionPeriod(fy29, 'closed', ADMIN)
  const yec = await Promise.allSettled(Array.from({ length: 6 }, () => runYearEndClosing(fy29, ADMIN)))
  const closings29 = (await one<{ n: number }>(`SELECT COUNT(*)::int AS n FROM gl_journal_entries WHERE reference=$1 AND status='posted'`, [`year-end-close:${fy29}`]))!.n
  ok(closings29 === 1, '🔴 6 concurrent year-end closings book EXACTLY one entry', `${closings29} entry; ${yec.filter(r => r.status === 'fulfilled' && (r.value as { ok: boolean }).ok).length} reported ok`)
  const p2030 = await createPeriod({ name: '2030', startDate: '2030-01-01', endDate: '2030-12-31', kind: 'year' })
  const p30 = await createPeriod({ name: '30', startDate: '2031-01-01', endDate: '2031-12-31', kind: 'year' })
  await withTransaction(q => insertPostedEntry(q, '2030-03-03', 'r30', 'ef1', ADMIN, [{ accountId: id1010, debit: 10, credit: 0 }, { accountId: id4000, debit: 0, credit: 10 }]))
  await withTransaction(q => insertPostedEntry(q, '2031-03-03', 'r31', 'ef1', ADMIN, [{ accountId: id1010, debit: 20, credit: 0 }, { accountId: id4000, debit: 0, credit: 20 }]))
  const c2030 = await runYearEndClosing(p2030, ADMIN), c30 = await runYearEndClosing(p30, ADMIN)
  ok(c2030.ok && c30.ok && c2030.netIncome === 10 && c30.netIncome === 20, '🔴 closing «2030» does not block closing «30»', `${JSON.stringify(c2030)} · ${JSON.stringify(c30)}`)
  const secondClose = await runYearEndClosing(p30, ADMIN)
  ok(secondClose.ok === false && secondClose.code === 'ERP-FINANCE-YEAR-ALREADY-CLOSED', 'a second close of «30» is refused with a bilingual catalog error', secondClose.errorFa)
  const allNos = await pgQuery<{ entry_no: string }>(`SELECT entry_no FROM gl_journal_entries WHERE reference IN ('opening') OR reference LIKE 'year-end-close:%' OR reference LIKE 'intercompany:%'`)
  ok(allNos.every(r => !/\d{6,}$/.test(r.entry_no.split('-').pop() ?? '')), 'no system entry number carries a Date.now() suffix', `${allNos.length} checked`)

  console.log('\n— BUG-ERP-21: migrating a DB that already holds duplicates —')
  await pgQuery(`DROP INDEX IF EXISTS idx_gl_entries_entry_no_unique`)
  await pgQuery(`INSERT INTO gl_journal_entries (entry_no,date,memo,status,total) VALUES ('EF1-LEGACY-DUP','${year}-03-03','a','draft',0),('EF1-LEGACY-DUP','${year}-03-03','b','draft',0)`)
  const migErr = await codeOf(() => runMigrations())
  ok(migErr === 'ok', '🔴 migration does NOT fail on existing duplicate numbers', migErr)
  ok(!(await one(`SELECT 1 FROM pg_indexes WHERE indexname='idx_gl_entries_entry_no_unique'`)), 'the unique index is not created while duplicates exist (no renumbering)')
  const alert = await one<{ status: string; metric_value: string; detail: string }>(`SELECT status, metric_value, detail FROM business_alerts WHERE fingerprint='erpfix1:gl_duplicate_entry_no'`)
  ok(alert?.status === 'open' && Number(alert.metric_value) === 1 && /EF1-LEGACY-DUP/.test(alert.detail), 'the duplicates are reported as a business alert naming the number', alert?.detail)
  ok((await one<{ n: number }>(`SELECT COUNT(*)::int AS n FROM gl_journal_entries WHERE entry_no='EF1-LEGACY-DUP'`))!.n === 2, 'no number was changed automatically')
  await pgQuery(`DELETE FROM gl_journal_entries WHERE entry_no='EF1-LEGACY-DUP'`)
  await runMigrations()
  ok(!!(await one(`SELECT 1 FROM pg_indexes WHERE indexname='idx_gl_entries_entry_no_unique'`)), 'once cleaned, the next boot creates the unique index')
  ok((await one<{ status: string }>(`SELECT status FROM business_alerts WHERE fingerprint='erpfix1:gl_duplicate_entry_no'`))?.status === 'resolved', 'and resolves the alert')

  // ── final books ────────────────────────────────────────────────────────────
  const tb = trialBalance(await loadTallies())
  ok(tb.balanced, 'trial balance balanced at the end', `${tb.totalDebit} = ${tb.totalCredit}`)
  ok(await balance('6100') === 0, '6100 «Rent Expense» still 0 at the end')

  // ── gates ──────────────────────────────────────────────────────────────────
  console.log('\n— CI gates (positive + negative) —')
  const run = (args: string[]) => spawnSync('npx', ['tsx', ...args], { encoding: 'utf8' }).status
  ok(run(['scripts/gl-writes-audit.ts']) === 0, 'audit:gl-writes passes on the code')
  writeFileSync('src/lib/__erpfix1_neg.ts', "import { pgQuery } from '@/lib/db'\nexport const bad = () => pgQuery(`INSERT INTO gl_journal_entries (entry_no,status) VALUES ('x','posted')`)\n")
  try { ok(run(['scripts/gl-writes-audit.ts']) === 1, 'audit:gl-writes FAILS on a direct INSERT') } finally { unlinkSync('src/lib/__erpfix1_neg.ts') }
  ok(run(['scripts/coa-audit.ts']) === 0, 'audit:coa passes on the code')
  writeFileSync('scripts/__erpfix1_neg.sql', "INSERT INTO gl_accounts (code, name_en, name_fa, type) VALUES ('6100','Salaries','حقوق','expense') ON CONFLICT (code) DO NOTHING;\n")
  try { ok(run(['scripts/coa-audit.ts', '--seed', 'scripts/__erpfix1_neg.sql']) === 1, 'audit:coa FAILS on a colliding seed (6100 Rent vs Salaries)') } finally { unlinkSync('scripts/__erpfix1_neg.sql') }

  console.log(`\n  ${pass}/${pass + fail} assertions passed.`)
  process.exit(fail ? 1 : 0)
}
main().catch(e => { console.error(e); process.exit(1) })
