/**
 * Phase 26.20 live-PG verification — company simulation with injected broken
 * states → self-heal detects + auto-fixes → health center assembles → books
 * reconcile. Run against an ephemeral PostgreSQL database.
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery } from '@/lib/db'
import { runSelfHeal, lastRun } from '@/lib/health/selfhealData'
import { healthOverview } from '@/lib/health/healthData'

let n = 0, failed = 0
function ok(cond: boolean, label: string) {
  n++
  if (cond) console.log(`  ✅ ${n}. ${label}`)
  else { failed++; console.error(`  ❌ ${n}. ${label}`) }
}
const one = async <T>(sql: string, p: unknown[] = []) => (await pgQuery<T>(sql, p))[0]

async function main() {
  console.log('— migrate + seed —')
  await runMigrations()
  await seedDatabase()

  console.log('— PART 1: simulate company + inject broken states —')
  // Customers (2 sharing a national_id → duplicate identities) + a normal one.
  const c1 = await one<{ id: number }>(`INSERT INTO sales_customers (code,name,kind,national_id) VALUES ('C-1','Alpha Co','company','1111111111') RETURNING id`)
  await pgQuery(`INSERT INTO sales_customers (code,name,kind,national_id) VALUES ('C-2','Alpha Co (dup)','company','1111111111')`)
  // Supplier + expired-but-active contract.
  const v1 = await one<{ id: number }>(`INSERT INTO purchase_vendors (code,name) VALUES ('V-1','Beta Supplies') RETURNING id`)
  await pgQuery(`INSERT INTO vendor_contracts (vendor_id,title,start_date,end_date,status,value) VALUES ($1,'Maintenance','2025-01-01','2026-01-01','active',5000000)`, [v1.id])
  // Products: one negative-margin, plus warehouse + negative stock injection.
  const w = await one<{ id: number }>(`INSERT INTO inv_warehouses (code,name_en) VALUES ('W-1','Main') RETURNING id`)
  const p1 = await one<{ id: number }>(`INSERT INTO inv_products (sku,name_en,cost,price,active) VALUES ('P-1','Widget',100,90,1) RETURNING id`)
  await pgQuery(`INSERT INTO inv_moves (product_id,warehouse_id,type,qty,unit_cost,ref) VALUES ($1,$2,'issue',-5,100,'manual bypass')`, [p1.id, w.id])
  // Confirmed sales invoice WITHOUT GL (the 26.15.1 latent gap, injected deliberately).
  const inv = await one<{ id: number }>(
    `INSERT INTO sales_documents (doc_type,doc_no,customer_id,date,status,subtotal,tax_total,total)
     VALUES ('invoice','INV-SIM-1',$1,'2026-07-10','confirmed',1000000,90000,1090000) RETURNING id`, [c1.id])
  // Confirmed purchase invoice WITHOUT GL.
  const pinv = await one<{ id: number }>(
    `INSERT INTO purchase_documents (doc_type,doc_no,vendor_id,date,status,subtotal,tax_total,total)
     VALUES ('invoice','PINV-SIM-1',$1,'2026-07-10','approved',500000,45000,545000) RETURNING id`, [v1.id])
  // Duplicate payment (same invoice, amount, date — classic double pay).
  await pgQuery(`INSERT INTO sales_payments (document_id,customer_id,amount,date,method) VALUES ($1,$2,545000,'2026-07-11','bank'),($1,$2,545000,'2026-07-11','bank')`, [inv.id, c1.id])
  // Stuck import job (processing > 2h).
  await pgQuery(`INSERT INTO import_jobs (entity_type,name,file_hash,status,total_rows,created_at,updated_at)
    VALUES ('customer','legacy.csv','h','processing',10, to_char(now()-interval '3 hours','YYYY-MM-DD HH24:MI:SS'), to_char(now()-interval '3 hours','YYYY-MM-DD HH24:MI:SS'))`)
  // Orphan hold: delivered shipment with an active reservation.
  const shp = await one<{ id: number }>(`INSERT INTO inv_shipments (shipment_no,warehouse_id,status) VALUES ('SHP-SIM',$1,'delivered') RETURNING id`, [w.id])
  await pgQuery(`INSERT INTO inv_reservations (product_id,warehouse_id,kind,qty,ref,status) VALUES ($1,$2,'reserve',3,$3,'active')`, [p1.id, w.id, `SHP-${shp.id}`])

  console.log('— PART 10: self-heal run #1 (detect + auto-fix) —')
  const r1 = await runSelfHeal()
  const f = (code: string) => r1.findings.find(x => x.code === code)!
  ok(f('sales_invoice_unposted').count === 1 && f('sales_invoice_unposted').fixed === 1 && f('sales_invoice_unposted').action === 'auto_fixed', 'sales invoice detected + auto-posted to GL')
  ok(f('purchase_invoice_unposted').count === 1 && f('purchase_invoice_unposted').fixed === 1, 'purchase invoice detected + auto-posted to GL')
  ok(f('contract_expired_active').count === 1 && f('contract_expired_active').fixed === 1, 'expired-active contract auto-expired')
  ok(f('import_job_stuck').count === 1 && f('import_job_stuck').fixed === 1, 'stuck import job auto-failed')
  ok(f('orphan_holds').count === 1 && f('orphan_holds').fixed === 1, 'orphan shipment hold auto-released')
  ok(f('negative_stock').count === 1 && f('negative_stock').action === 'alert', 'negative stock detected → alert (human fix)')
  ok(f('duplicate_payments').count === 1 && f('duplicate_payments').action === 'alert', 'duplicate payment detected → alert')
  ok(f('duplicate_customers').count === 1 && f('duplicate_customers').action === 'recommendation', 'duplicate customer identity → recommendation')
  ok(f('negative_margin').count === 1, 'negative-margin product detected')
  ok(f('gl_unbalanced').count === 0, 'no unbalanced posted entries (books clean)')
  ok(r1.risk > 0 && r1.risk <= 100, `risk score computed (${r1.risk})`)

  console.log('— PART 4: accounting integrity after auto-fix —')
  const sd = await one<{ gl_entry_id: number | null }>(`SELECT gl_entry_id FROM sales_documents WHERE id=$1`, [inv.id])
  const pd = await one<{ gl_entry_id: number | null }>(`SELECT gl_entry_id FROM purchase_documents WHERE id=$1`, [pinv.id])
  ok(!!sd.gl_entry_id && !!pd.gl_entry_id, 'both invoices now carry gl_entry_id')
  const bal = await one<{ dr: number; cr: number }>(
    `SELECT COALESCE(SUM(l.debit),0)::float AS dr, COALESCE(SUM(l.credit),0)::float AS cr
     FROM gl_journal_lines l JOIN gl_journal_entries e ON e.id=l.entry_id WHERE e.status='posted'`)
  ok(Math.abs(bal.dr - bal.cr) < 0.001 && bal.dr > 0, `posted ledger balances (Dr ${bal.dr} = Cr ${bal.cr})`)
  const rev = await one<{ t: number }>(
    `SELECT COALESCE(SUM(l.credit-l.debit),0)::float AS t FROM gl_journal_lines l
     JOIN gl_accounts a ON a.id=l.account_id JOIN gl_journal_entries e ON e.id=l.entry_id
     WHERE a.code='4000' AND e.status='posted'`)
  ok(rev.t === 1000000, `revenue reached the income statement (${rev.t})`)
  const contract = await one<{ status: string }>(`SELECT status FROM vendor_contracts WHERE vendor_id=$1`, [v1.id])
  ok(contract.status === 'expired', 'contract status persisted as expired')
  const hold = await one<{ status: string }>(`SELECT status FROM inv_reservations WHERE ref=$1`, [`SHP-${shp.id}`])
  ok(hold.status === 'released', 'orphan hold persisted as released')
  const job = await one<{ status: string }>(`SELECT status FROM import_jobs WHERE name='legacy.csv'`)
  ok(job.status === 'failed', 'stuck job persisted as failed')

  console.log('— idempotency: self-heal run #2 books nothing twice —')
  const r2 = await runSelfHeal()
  const g = (code: string) => r2.findings.find(x => x.code === code)!
  ok(g('sales_invoice_unposted').count === 0 && g('purchase_invoice_unposted').count === 0, 'no unposted invoices remain (no double posting)')
  ok(g('contract_expired_active').count === 0 && g('orphan_holds').count === 0 && g('import_job_stuck').count === 0, 'auto-fixed states do not re-trigger')
  const entries = await one<{ n: number }>(`SELECT COUNT(*)::int AS n FROM gl_journal_entries WHERE reference LIKE 'SAL-%' OR reference LIKE 'PUR-%'`)
  ok(entries.n === 2, `exactly 2 GL entries exist (${entries.n}) — idempotent`)
  // Auto-fixed findings never add risk (open = count - fixed), so risk reflects
  // only the human-decision alerts and must not grow across runs.
  ok(r2.risk <= r1.risk, `risk did not grow across runs (${r1.risk} → ${r2.risk})`)
  ok(r2.totalFixed === 0, 'run #2 auto-fixed nothing (nothing left to fix)')

  console.log('— PART 11: Operational Health Center assembly —')
  const h = await healthOverview()
  ok(h.components.length === 8, '8 health components assembled')
  ok(h.overall >= 0 && h.overall <= 100 && ['healthy', 'degraded', 'at_risk', 'critical'].includes(h.grade), `overall health ${h.overall} (${h.grade})`)
  ok(h.risk === r2.risk, 'health risk mirrors the latest self-heal run')
  ok(h.selfheal.run?.id === r2.runId, 'last run surfaced in the overview')
  const fin = h.components.find(c => c.key === 'financial')!
  ok(fin.score === 100, `financial health 100 (posted ledger clean)`)
  const trail = await lastRun()
  ok(trail.findings.length > 0 && trail.findings.every(x => ['critical', 'warning', 'info'].includes(x.severity)), 'audit trail persisted in selfheal_findings')

  console.log(`\n${failed === 0 ? `✅ ALL ${n} ASSERTIONS PASSED` : `❌ ${failed}/${n} FAILED`}`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch(e => { console.error(e); process.exit(1) })
