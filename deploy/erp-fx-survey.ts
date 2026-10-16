/**
 * ERPFIX-2 (BUG-ERP-03) — READ-ONLY survey of the current database's
 * exposure to the pre-fix behaviour (GL lines posted in transaction
 * currency instead of Rial base). Run with: npx tsx deploy/erp-fx-survey.ts
 * Never mutates anything.
 */
import { pgQuery } from '@/lib/db'

async function main() {
  const nonIrrDocs = await pgQuery<{ kind: string; n: number }>(`
    SELECT 'sales'::text AS kind, count(*)::int AS n FROM sales_documents WHERE currency IS NOT NULL AND currency<>'IRR'
    UNION ALL
    SELECT 'purchase', count(*)::int FROM purchase_documents WHERE currency IS NOT NULL AND currency<>'IRR'
  `)
  const nonIrrPayments = await pgQuery<{ kind: string; n: number }>(`
    SELECT 'sales_payment'::text AS kind, count(*)::int AS n FROM sales_payments WHERE currency IS NOT NULL AND currency<>'IRR'
    UNION ALL
    SELECT 'purchase_payment', count(*)::int FROM purchase_payments WHERE currency IS NOT NULL AND currency<>'IRR'
  `)
  const glNonIrr = (await pgQuery<{ n: number }>(`SELECT count(*)::int AS n FROM gl_journal_entries WHERE currency IS NOT NULL AND currency<>'IRR'`))[0]?.n ?? 0
  const zeroRate = await pgQuery<{ kind: string; n: number }>(`
    SELECT 'sales_documents'::text AS kind, count(*)::int AS n FROM sales_documents WHERE exchange_rate IS NULL OR exchange_rate<=0
    UNION ALL
    SELECT 'purchase_documents', count(*)::int FROM purchase_documents WHERE exchange_rate IS NULL OR exchange_rate<=0
    UNION ALL
    SELECT 'sales_payments', count(*)::int FROM sales_payments WHERE exchange_rate IS NULL OR exchange_rate<=0
    UNION ALL
    SELECT 'purchase_payments', count(*)::int FROM purchase_payments WHERE exchange_rate IS NULL OR exchange_rate<=0
  `)
  // Distortion: for non-IRR posted invoices, compare the AR/revenue GL line
  // amount that was actually written against the document's own base_total
  // (a pre-fix row will show line ≈ raw total, not total*rate).
  const distortion = await pgQuery<{ doc_no: string | null; currency: string; rate: number; base_total: number; gl_ar_line: number | null }>(`
    SELECT d.doc_no, d.currency, d.exchange_rate::float AS rate, d.base_total::float AS base_total,
           l.debit::float AS gl_ar_line
    FROM sales_documents d
    JOIN gl_journal_entries e ON e.id = d.gl_entry_id
    JOIN gl_journal_lines l ON l.entry_id = e.id AND l.account_id = (SELECT id FROM gl_accounts WHERE code='1100')
    WHERE d.currency IS NOT NULL AND d.currency<>'IRR'
  `)
  console.log('=== ERPFIX-2 FX survey (read-only) ===')
  console.log('Non-IRR documents:', nonIrrDocs)
  console.log('Non-IRR payments:', nonIrrPayments)
  console.log('Non-IRR posted GL entries:', glNonIrr)
  console.log('Zero/null exchange_rate rows (per stop_conditions — list, never auto-correct):', zeroRate)
  console.log('AR-line distortion check (pre-fix rows show gl_ar_line ≈ raw total, not total*rate):')
  for (const r of distortion) {
    const expected = Number(r.base_total)
    const got = Number(r.gl_ar_line ?? 0)
    const distorted = Math.abs(expected - got) > 1
    console.log(`  ${r.doc_no} currency=${r.currency} rate=${r.rate} base_total=${expected} gl_ar_debit=${got}${distorted ? '  <-- DISTORTED (needs deploy/erp-fx-remediate.ts)' : '  ok'}`)
  }
  if (distortion.length === 0) console.log('  (none — no non-IRR invoice has posted to the GL yet)')
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
