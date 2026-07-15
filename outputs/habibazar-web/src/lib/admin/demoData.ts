/**
 * Demo data seed/reset (Phase 26.25b بند ۲). Every demo row is tagged with a
 * 'DEMO-' code/doc_no prefix (or a 'DEMO ' name prefix where there is no code), so
 * `resetDemo` can delete ONLY demo rows and NEVER touches real business data. Used
 * by `npm run seed:demo` / `npm run reset:demo` for pilot walkthroughs.
 */
import { pgQuery } from '@/lib/db'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"
export const DEMO_PREFIX = 'DEMO-'

async function one<T>(sql: string, p: unknown[] = []): Promise<T> { return (await pgQuery<T>(sql, p))[0] }

/** Seed a small, self-contained demo dataset. Idempotent (clears demo rows first). */
export async function seedDemo(): Promise<{ customers: number; products: number; leads: number; invoices: number; tickets: number }> {
  await resetDemo() // start clean so re-seeding never duplicates

  const custIds: number[] = []
  for (const [i, name] of [['DEMO- Acme Co', 'DEMO- شرکت آلفا'], ['DEMO- Beta LLC', 'DEMO- شرکت بتا'], ['DEMO- Gamma Ltd', 'DEMO- گاما']].entries()) {
    const c = await one<{ id: number }>(
      `INSERT INTO sales_customers (code, name, kind, phone, credit_limit, updated_at)
       VALUES ($1,$2,'company',$3,50000000,${NOW}) RETURNING id`,
      [`${DEMO_PREFIX}C${i + 1}`, name[0], `0912000${1000 + i}`])
    custIds.push(c.id)
  }

  let products = 0
  for (const [i, sku] of ['DEMO-P1', 'DEMO-P2', 'DEMO-P3'].entries()) {
    await pgQuery(`INSERT INTO inv_products (sku, name_en, name_fa, unit, price, active, updated_at) VALUES ($1,$2,$3,'pcs',$4,1,${NOW})`,
      [sku, `DEMO- Product ${i + 1}`, `DEMO- کالای ${i + 1}`, (i + 1) * 1000000])
    products++
  }

  let leads = 0
  for (const [i, st] of ['new', 'qualified', 'proposal', 'won', 'lost'].entries()) {
    await pgQuery(`INSERT INTO crm_leads (name, source, status, score, value, updated_at) VALUES ($1,'website',$2,$3,$4,${NOW})`,
      [`DEMO Lead ${i + 1}`, st, 50 + i * 10, (i + 1) * 5000000])
    leads++
  }

  let invoices = 0
  for (const [i, cid] of custIds.entries()) {
    await pgQuery(
      `INSERT INTO sales_documents (doc_type, doc_no, customer_id, date, status, subtotal, total, exchange_rate, updated_at)
       VALUES ('invoice',$1,$2,substr(${NOW},1,10),'confirmed',$3,$3,1,${NOW})`,
      [`${DEMO_PREFIX}INV${i + 1}`, cid, (i + 1) * 10000000])
    invoices++
  }

  let tickets = 0
  for (const [i, cid] of custIds.slice(0, 2).entries()) {
    const t = await one<{ id: number }>(
      `INSERT INTO crm_tickets (ticket_no, customer_id, subject, category, priority, status, source, updated_at)
       VALUES ($1,$2,$3,'general','normal','open','portal',${NOW}) RETURNING id`,
      [`${DEMO_PREFIX}TK${i + 1}`, cid, `DEMO- support request ${i + 1}`])
    await pgQuery(`INSERT INTO crm_ticket_messages (ticket_id, author_kind, body, internal) VALUES ($1,'customer','DEMO message',0)`, [t.id])
    tickets++
  }

  return { customers: custIds.length, products, leads, invoices, tickets }
}

/** Delete ONLY demo rows (DEMO- prefix). Real business data is never touched. */
export async function resetDemo(): Promise<{ deleted: number }> {
  let deleted = 0
  const del = async (sql: string) => { const r = await pgQuery<{ x: number }>(sql + ' RETURNING 1 AS x'); deleted += r.length }
  // Children first (FK-safe).
  await del(`DELETE FROM sales_payments WHERE document_id IN (SELECT id FROM sales_documents WHERE doc_no LIKE '${DEMO_PREFIX}%')`)
  await del(`DELETE FROM sales_document_lines WHERE document_id IN (SELECT id FROM sales_documents WHERE doc_no LIKE '${DEMO_PREFIX}%')`)
  await del(`DELETE FROM sales_documents WHERE doc_no LIKE '${DEMO_PREFIX}%'`)
  await del(`DELETE FROM crm_ticket_messages WHERE ticket_id IN (SELECT id FROM crm_tickets WHERE ticket_no LIKE '${DEMO_PREFIX}%')`)
  await del(`DELETE FROM crm_tickets WHERE ticket_no LIKE '${DEMO_PREFIX}%'`)
  await del(`DELETE FROM crm_leads WHERE name LIKE 'DEMO %'`)
  await del(`DELETE FROM inv_products WHERE sku LIKE '${DEMO_PREFIX}%'`)
  await del(`DELETE FROM sales_customers WHERE code LIKE '${DEMO_PREFIX}%'`)
  return { deleted }
}
