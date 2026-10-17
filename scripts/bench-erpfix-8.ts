/**
 * ERPFIX-8 — one-off benchmark (not a CI regression): seeds a realistic
 * volume of GL lines + sales/purchase documents, then runs EXPLAIN (ANALYZE,
 * BUFFERS) on the exact production queries named in the master prompt's
 * `audit_first` list, so every performance claim in the governance report is
 * backed by a real number instead of an assumption.
 *
 * Run: DATABASE_URL=… npx tsx scripts/bench-erpfix-8.ts
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery } from '@/lib/db'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

async function explain(label: string, sql: string, params: unknown[] = []) {
  const rows = await pgQuery<{ 'QUERY PLAN': string }>(`EXPLAIN (ANALYZE, BUFFERS) ${sql}`, params)
  const text = rows.map(r => r['QUERY PLAN']).join('\n')
  const timeMatch = text.match(/Execution Time: ([\d.]+) ms/)
  console.log(`\n── ${label} ──`)
  console.log(text.split('\n').slice(0, 6).join('\n'))
  console.log(`  >>> Execution Time: ${timeMatch?.[1] ?? '?'} ms`)
  return timeMatch ? Number(timeMatch[1]) : null
}

async function main() {
  await runMigrations(); await seedDatabase()
  const ADMIN = (await pgQuery<{ id: string }>(`SELECT id FROM users ORDER BY created_at LIMIT 1`))[0].id
  const custId = (await pgQuery<{ id: number }>(`INSERT INTO sales_customers (code, name) VALUES ('BENCH','Bench Customer') RETURNING id`))[0].id
  const vendId = (await pgQuery<{ id: number }>(`INSERT INTO purchase_vendors (code, name) VALUES ('BENCHV','Bench Vendor') RETURNING id`))[0].id
  const arId = (await pgQuery<{ id: number }>(`SELECT id FROM gl_accounts WHERE code='1100'`))[0].id
  const revId = (await pgQuery<{ id: number }>(`SELECT id FROM gl_accounts WHERE code='4000'`))[0].id

  console.log('Seeding ~120k GL lines (60k entries) + 100k sales documents + 50k purchase documents…')
  const t0 = Date.now()
  await pgQuery(`
    WITH gen AS (SELECT generate_series(1, 60000) AS n)
    INSERT INTO gl_journal_entries (entry_no, date, memo, reference, status, total, currency, exchange_rate, created_by, created_at, posted_at)
    SELECT 'BENCH-'||n, (date '2020-01-01' + (n % 1800) * interval '1 day')::date::text, 'bench', 'bench:'||n, 'posted', 1000, 'IRR', 1, $1, ${NOW}, ${NOW}
    FROM gen`, [ADMIN])
  await pgQuery(`
    INSERT INTO gl_journal_lines (entry_id, account_id, debit, credit, line_no)
    SELECT id, $1::int, 1000, 0, 0 FROM gl_journal_entries WHERE reference LIKE 'bench:%'
    UNION ALL
    SELECT id, $2::int, 0, 1000, 1 FROM gl_journal_entries WHERE reference LIKE 'bench:%'`, [arId, revId])
  await pgQuery(`
    WITH gen AS (SELECT generate_series(1, 100000) AS n)
    INSERT INTO sales_documents (doc_no, doc_type, customer_id, date, status, subtotal, discount_total, tax_total, total, currency, exchange_rate, created_at)
    SELECT 'SBENCH-'||n, 'invoice', $1::int, (date '2020-01-01' + (n % 1800) * interval '1 day')::date::text, 'confirmed', 1000, 0, 90, 1090, 'IRR', 1, ${NOW}
    FROM gen`, [custId])
  await pgQuery(`
    WITH gen AS (SELECT generate_series(1, 50000) AS n)
    INSERT INTO purchase_documents (doc_no, doc_type, vendor_id, date, status, subtotal, discount_total, tax_total, total, currency, exchange_rate, created_at)
    SELECT 'PBENCH-'||n, 'invoice', $1::int, (date '2020-01-01' + (n % 1800) * interval '1 day')::date::text, 'confirmed', 1000, 0, 90, 1090, 'IRR', 1, ${NOW}
    FROM gen`, [vendId])
  console.log(`Seed done in ${Date.now() - t0}ms`)

  await explain('loadTallies-equivalent (gl_journal_lines join, no date bound)', `
    SELECT a.id, a.code,
           COALESCE(SUM(CASE WHEN e.status='posted' THEN l.debit ELSE 0 END),0) AS debit,
           COALESCE(SUM(CASE WHEN e.status='posted' THEN l.credit ELSE 0 END),0) AS credit
    FROM gl_accounts a
    LEFT JOIN gl_journal_lines l ON l.account_id=a.id
    LEFT JOIN gl_journal_entries e ON e.id=l.entry_id
    GROUP BY a.id, a.code`)

  await explain('loadTallies-equivalent (date-bounded, one quarter)', `
    SELECT a.id, a.code,
           COALESCE(SUM(CASE WHEN e.status='posted' AND e.date >= '2021-01-01' AND e.date <= '2021-03-31' THEN l.debit ELSE 0 END),0) AS debit,
           COALESCE(SUM(CASE WHEN e.status='posted' AND e.date >= '2021-01-01' AND e.date <= '2021-03-31' THEN l.credit ELSE 0 END),0) AS credit
    FROM gl_accounts a
    LEFT JOIN gl_journal_lines l ON l.account_id=a.id
    LEFT JOIN gl_journal_entries e ON e.id=l.entry_id
    GROUP BY a.id, a.code`)

  await explain('purchasing listDocuments-equivalent (no LIMIT, SELECT *)', `
    SELECT * FROM purchase_documents ORDER BY created_at DESC`)

  await explain('purchasing listDocuments-equivalent (LIMIT 50 OFFSET 0)', `
    SELECT id, doc_no, doc_type, status, total, date FROM purchase_documents ORDER BY created_at DESC LIMIT 50 OFFSET 0`)

  await explain('sales_documents date-range filter (no index)', `
    SELECT id FROM sales_documents WHERE date >= '2022-01-01' AND date <= '2022-03-31'`)

  await explain('assertPostable-equivalent (listPeriods, full table)', `
    SELECT id, start_date, end_date, status FROM gl_fiscal_periods ORDER BY start_date, kind`)

  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
