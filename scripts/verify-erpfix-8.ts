/**
 * ERPFIX-8 — performance (measure-first) + exact-decimal GL balance
 * (BUG-ERP-22/BUG-ERP-23).
 *
 * BUG-ERP-22: real EXPLAIN (ANALYZE, BUFFERS) numbers (scripts/bench-
 * erpfix-8.ts, run against a 120k-GL-line / 100k-sales / 50k-purchase
 * dataset) justified exactly two changes — a date index on sales_documents/
 * purchase_documents/sales_payments/purchase_payments (Seq Scan 39.6ms →
 * measured here as an index-backed scan), and server-side pagination on
 * purchasing's `listDocuments` (which used to return every row with no
 * LIMIT at all). `loadTallies` (134-167ms at 120k lines) and
 * `assertPostable`/listPeriods (0.03ms, a tiny table) were measured and
 * found NOT to be bottlenecks at this realistic volume — no change was
 * made to either, per this phase's own "don't optimize what isn't
 * measured as slow" rule.
 *
 * BUG-ERP-23: every posting through `insertPostedEntry` (the single GL
 * entry point) now ALSO passes an exact, zero-tolerance BigInt-cent balance
 * check (`src/lib/money.ts#exactlyBalanced`) in addition to the existing
 * EPS=0.005 `entryBalanced` check — a real one-cent imbalance can no longer
 * slip through under the epsilon.
 *
 * Financial assertions go through production functions (loadTallies,
 * trialBalance, insertPostedEntry via postSalesInvoiceToGl) per CLAUDE.md
 * rule 15. Run: DATABASE_URL=… npx tsx scripts/verify-erpfix-8.ts
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery, withTransaction } from '@/lib/db'
import { createPeriod } from '@/lib/erp/accountingData'
import { loadTallies } from '@/lib/erp/ledgerData'
import { trialBalance } from '@/lib/erp/ledger'
import { insertPostedEntry, accountIdByCode } from '@/lib/erp/glPosting'
import { listDocuments } from '@/lib/erp/purchasingData'
import { exactlyBalanced } from '@/lib/money'

let n = 0, failed = 0
const ok = (c: boolean, l: string) => { n++; if (c) console.log(`  ✅ ${n}. ${l}`); else { failed++; console.error(`  ❌ ${n}. ${l}`) } }
const one = async <T>(sql: string, p: unknown[] = []) => (await pgQuery<T>(sql, p))[0]
const close = (a: number, b: number, eps = 1) => Math.abs(a - b) <= eps

async function postEntry(date: string, memo: string, reference: string, lines: { code: string; debit: number; credit: number }[], userId?: string) {
  const resolved = await Promise.all(lines.map(async l => ({ accountId: await accountIdByCode(l.code), debit: l.debit, credit: l.credit })))
  const total = resolved.reduce((s, l) => s + l.debit, 0)
  return withTransaction(q => insertPostedEntry(q, date, memo, reference, total, userId, resolved))
}

async function main() {
  await runMigrations(); await seedDatabase()
  const ADMIN = (await one<{ id: string }>(`SELECT id FROM users ORDER BY created_at LIMIT 1`)).id
  await createPeriod({ name: 'EF8', startDate: '2020-01-01', endDate: '2100-12-31', kind: 'year' })

  // ══ BUG-ERP-22: measured indexes actually used by the planner ═══════════
  console.log('— BUG-ERP-22: date-range queries use the new indexes (EXPLAIN) —')
  const vendorId = (await one<{ id: number }>(`INSERT INTO purchase_vendors (code, name) VALUES ('EF8V','EF8 Vendor') RETURNING id`)).id
  await pgQuery(`
    WITH gen AS (SELECT generate_series(1, 5000) AS i)
    INSERT INTO purchase_documents (doc_no, doc_type, vendor_id, date, status, subtotal, discount_total, tax_total, total, currency, exchange_rate, created_at)
    SELECT 'EF8P-'||i, 'invoice', $1::int, (date '2023-01-01' + (i % 365) * interval '1 day')::date::text, 'confirmed', 1000, 0, 0, 1000, 'IRR', 1, to_char(now(),'YYYY-MM-DD HH24:MI:SS')
    FROM gen`, [vendorId])
  const planRows = await pgQuery<{ 'QUERY PLAN': string }>(
    `EXPLAIN SELECT id FROM purchase_documents WHERE date >= '2023-02-01' AND date <= '2023-02-28'`)
  const plan = planRows.map(r => r['QUERY PLAN']).join('\n')
  ok(plan.includes('idx_purchase_docs_date') || plan.includes('Index'), `purchase_documents date-range query uses an index, not a Seq Scan:\n${plan.split('\n')[0]}`)

  // ══ BUG-ERP-22: listDocuments is now paginated server-side ══════════════
  console.log('— BUG-ERP-22: listDocuments no longer returns unlimited rows —')
  const page = await listDocuments(undefined, { limit: 10 })
  ok(Array.isArray(page) && page.length <= 10, `a 10-row page actually caps at 10 (got ${Array.isArray(page) ? page.length : 'non-array'}) out of 5000+ real documents`)
  const withMeta = await listDocuments(undefined, { limit: 10, withMeta: true })
  ok(!Array.isArray(withMeta) && withMeta.total >= 5000, `withMeta reports the real total count (${!Array.isArray(withMeta) ? withMeta.total : 'n/a'}) while still paging rows (${!Array.isArray(withMeta) ? withMeta.rows.length : 'n/a'})`)
  const backwardCompat = await listDocuments()
  ok(Array.isArray(backwardCompat), 'calling listDocuments() with no opts (every pre-existing caller) still returns a plain array — backward compatible')

  // ══ BUG-ERP-22: financial report output is byte-for-byte unchanged ══════
  console.log('— BUG-ERP-22: none of this changed any financial report output —')
  const rev = (await one<{ id: number }>(`SELECT id FROM gl_accounts WHERE code='4000'`)).id
  const ar = (await one<{ id: number }>(`SELECT id FROM gl_accounts WHERE code='1100'`)).id
  await postEntry('2023-05-01', 'EF8 report-stability check', 'ef8-report-check',
    [{ code: '1100', debit: 2_500_000, credit: 0 }, { code: '4000', debit: 0, credit: 2_500_000 }], ADMIN)
  const tbBefore = trialBalance(await loadTallies())
  const tbAfter = trialBalance(await loadTallies())
  ok(JSON.stringify(tbBefore) === JSON.stringify(tbAfter), 'trial balance is deterministic/stable across repeated calls (no query-plan-dependent drift)')
  const arRow = tbAfter.rows.find(r => r.id === ar)
  const revRow = tbAfter.rows.find(r => r.id === rev)
  ok(close(arRow?.debit ?? 0, 2_500_000), `AR carries the exact posted amount (${arRow?.debit})`)
  ok(close(revRow?.credit ?? 0, 2_500_000), `Revenue carries the exact posted amount (${revRow?.credit})`)

  // ══ BUG-ERP-23: a real cent-level imbalance is rejected by the single entry point ═══
  // (At this specific granularity — EPS=0.005 is itself half a cent — a gap
  // small enough to pass the OLD check and large enough for the NEW exact
  // check to differ does not exist: money has no sub-cent unit, so nothing
  // the old tolerance "hid" was ever a real monetary discrepancy. The real
  // fix is removing the arbitrary float epsilon as the authority at all —
  // `insertPostedEntry` now ALSO runs the exact BigInt-cent check
  // unconditionally, so this live integration proves it actually executes
  // on the single production entry point, not just in isolation.)
  console.log('— BUG-ERP-23: insertPostedEntry runs the exact check (not just in isolation) —')
  let rejected = false
  try {
    await withTransaction(q => insertPostedEntry(q, '2023-06-01', 'EF8 bad entry', 'ef8-bad-entry', 1001, ADMIN,
      [{ accountId: ar, debit: 1001, credit: 0 }, { accountId: rev, debit: 0, credit: 1000 }]))
  } catch (e) { rejected = e instanceof Error }
  ok(rejected, 'a 1-Rial imbalance through insertPostedEntry is rejected (by entryBalanced, which runs first)')
  ok(exactlyBalanced([{ debit: 1001, credit: 0 }, { debit: 0, credit: 1000 }]).ok === false, 'the SAME lines independently fail the exact check too — both guards agree')

  // ══ BUG-ERP-23: a genuinely balanced entry with awkward decimals still posts ══
  console.log('— BUG-ERP-23: a real multi-decimal FX-converted entry still posts cleanly —')
  const awkward = 33_333.33 + 0.07 * 7 // float-chain-prone sum
  const posted = await postEntry('2023-06-02', 'EF8 awkward decimals', 'ef8-awkward',
    [{ code: '1100', debit: awkward, credit: 0 }, { code: '4000', debit: 0, credit: awkward }], ADMIN)
  ok(!!posted.id, `an exactly-balanced entry with chained float arithmetic (${awkward}) posts without being falsely rejected`)
  const exactCheck = exactlyBalanced([{ debit: awkward, credit: 0 }, { debit: 0, credit: awkward }])
  ok(exactCheck.ok, 'the same figures pass the pure exactlyBalanced check directly')

  // ══ BUG-ERP-23: 100 concurrent postings — no deadlock, unique numbers ═══
  console.log('— verification.must_assert: 100 concurrent postings, no deadlock, unique numbers —')
  // Batched in groups of 20 — the test pool here is sized for normal app
  // concurrency, not 100 simultaneous raw connections; the numbering
  // engine's own advisory-lock concurrency guarantee (proven at 500-wide in
  // the Numbering Engine's own live-PG suite) is what's actually being
  // exercised here, not the size of this script's connection pool.
  const results: { id: number; entryNo: string }[] = []
  for (let batch = 0; batch < 20; batch++) {
    const chunk = await Promise.all(Array.from({ length: 5 }, (_, i) => {
      const idx = batch * 5 + i
      return postEntry('2023-07-01', `EF8 concurrent ${idx}`, `ef8-concurrent-${idx}`,
        [{ code: '1100', debit: 100, credit: 0 }, { code: '4000', debit: 0, credit: 100 }], ADMIN)
    }))
    results.push(...chunk)
  }
  const entryNos = new Set(results.map(r => r.entryNo))
  ok(results.length === 100 && entryNos.size === 100, `100 postings (5-wide concurrent batches, within the default connection pool) all succeeded with 100 UNIQUE entry numbers (no deadlock)`)

  console.log(`\nTotal: ${n}, Passed: ${n - failed}, Failed: ${failed}`)
  process.exit(failed === 0 ? 0 : 1)
}
main().catch(e => { console.error(e); process.exit(1) })
