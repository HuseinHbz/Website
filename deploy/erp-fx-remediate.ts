/**
 * ERPFIX-2 (BUG-ERP-03) — correction script for a posted GL entry that was
 * written BEFORE this fix (AR/revenue/VAT lines in the document's raw
 * transaction-currency amount instead of Rial base).
 *
 * Dry-run by default. Only --apply (after accountant sign-off) writes
 * anything. Never edits or voids the original posted entry (BUG-020
 * discipline) — books a REVERSAL of the distorted entry plus a correct
 * re-post through insertPostedEntry, only for documents in an OPEN period.
 * A document in a CLOSED/LOCKED period is reported, never auto-corrected.
 *
 * Usage: npx tsx deploy/erp-fx-remediate.ts [--apply]
 */
import { pgQuery, withTransaction } from '@/lib/db'
import { insertPostedEntry, loadGlMap, applyGlMap, accountIdByCode } from '@/lib/erp/glPosting'
import { salesInvoicePostingLines, postingBalanced } from '@/lib/erp/sales'
import { toBase } from '@/lib/erp/money'
import { assertPostable } from '@/lib/erp/accountingData'
import { reverseEntry } from '@/lib/erp/glPosting'

const APPLY = process.argv.includes('--apply')
const num = (v: unknown) => Number(v ?? 0)

async function main() {
  const candidates = await pgQuery<{ id: number; doc_no: string | null; currency: string; rate: number; subtotal: number; discount_total: number; tax_total: number; total: number; base_total: number; gl_entry_id: number; date: string }>(`
    SELECT d.id, d.doc_no, d.currency, d.exchange_rate::float AS rate, d.subtotal::float AS subtotal,
           d.discount_total::float AS discount_total, d.tax_total::float AS tax_total, d.total::float AS total,
           d.base_total::float AS base_total, d.gl_entry_id, d.date
    FROM sales_documents d
    JOIN gl_journal_entries e ON e.id = d.gl_entry_id
    JOIN gl_journal_lines l ON l.entry_id = e.id AND l.account_id = (SELECT id FROM gl_accounts WHERE code='1100')
    WHERE d.currency IS NOT NULL AND d.currency<>'IRR' AND d.doc_type='invoice'
      AND abs(COALESCE(d.base_total,0) - l.debit::float) > 1
  `)
  if (candidates.length === 0) { console.log('No distorted FX invoice postings found. Nothing to do.'); return }
  console.log(`Found ${candidates.length} distorted posting(s).`)
  for (const d of candidates) {
    const gate = await assertPostable(d.date)
    if (!gate.ok) {
      console.log(`  SKIP doc ${d.doc_no} (id ${d.id}): fiscal period for ${d.date} is not open — ${gate.error}. Report to accountant, do not auto-correct.`)
      continue
    }
    const net = num(d.subtotal) - num(d.discount_total)
    const tax = num(d.tax_total)
    const rate = num(d.rate) || 1
    const baseNet = toBase(net, rate)
    const baseTax = toBase(tax, rate)
    const baseTotal = baseNet + baseTax
    console.log(`  doc ${d.doc_no} (id ${d.id}): currency=${d.currency} rate=${rate} raw_total=${d.total} -> base_total=${baseTotal} (old distorted entry ${d.gl_entry_id})`)
    if (!APPLY) continue
    const lines = applyGlMap(salesInvoicePostingLines(baseNet, baseTax, baseTotal, 'invoice'), await loadGlMap())
    if (!postingBalanced(lines)) { console.log('    posting does not balance, skipping'); continue }
    const codes = [...new Set(lines.map(l => l.accountCode))]
    const ids = await Promise.all(codes.map(c => accountIdByCode(c)))
    const idOf = new Map(codes.map((c, i) => [c, ids[i]]))
    // 1. Reverse the distorted original (status stays posted; two-way linked reversal) — its own transaction.
    await reverseEntry(d.gl_entry_id, 'erpfix-2-remediation')
    // 2. Re-post correctly, at base, and relink the document — one transaction.
    await withTransaction(async query => {
      await query(`UPDATE sales_documents SET gl_entry_id=NULL WHERE id=$1`, [d.id])
      const e = await insertPostedEntry(query, d.date, `FX correction — ${d.doc_no}`, `FXFIX-${d.id}`, baseTotal, undefined,
        lines.map(l => ({ accountId: idOf.get(l.accountCode)!, debit: l.debit, credit: l.credit, memo: l.memo })),
        { currency: d.currency, exchangeRate: rate })
      await query(`UPDATE sales_documents SET gl_entry_id=$2 WHERE id=$1`, [d.id, e.id])
      console.log(`    APPLIED: reversed ${d.gl_entry_id}, re-posted as entry ${e.id}`)
    })
  }
  if (!APPLY) console.log('\nDRY RUN ONLY. Re-run with --apply after accountant/owner sign-off.')
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
