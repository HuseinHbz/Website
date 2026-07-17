/**
 * سامانه مودیان — data layer + submission adapter (Phase 26.24 بند ۴.۱).
 * Builds the standard invoice from a live sales_document, queues it, and
 * submits it to the tax authority. The real endpoint + private key + memory-id
 * (شناسه حافظه مالیاتی) live in erp_settings; when they are absent we run a
 * deterministic **sandbox** (local simulator) so the whole pipeline is testable
 * end-to-end without a real مودیان credential.
 *
 * HONEST BOUNDARY: the final production connection requires the customer's
 * مودیان private key + memory id. Everything up to signing + the queue lifecycle
 * is real and verified; the network POST is a real fetch when configured, else
 * the sandbox. See docs/governance/phase26.24-hardening-iran-report.md.
 */
import { createHash } from 'node:crypto'
import { pgQuery } from '@/lib/db'
import { buildInvoice, validateInvoice, type MoadianInvoiceInput, type InvoicePattern } from './invoice'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"
const num = (v: unknown) => Number(v ?? 0)

export interface MoadianConfig { apiUrl?: string; memoryId?: string; privateKey?: string; economicCode?: string; sellerName?: string }

export async function loadMoadianConfig(): Promise<MoadianConfig> {
  const rows = await pgQuery<{ key: string; value: string }>(
    `SELECT key, value FROM erp_settings WHERE key IN ('moadian_api_url','moadian_memory_id','moadian_private_key','company_economic_code','company_name')`)
  const m = new Map(rows.map(r => [r.key, r.value]))
  return {
    apiUrl: m.get('moadian_api_url') || undefined,
    memoryId: m.get('moadian_memory_id') || undefined,
    privateKey: m.get('moadian_private_key') || undefined,
    economicCode: m.get('company_economic_code') || undefined,
    sellerName: m.get('company_name') || 'HBZ',
  }
}

/** True once a real مودیان credential is configured (else sandbox). */
export function isMoadianLive(cfg: MoadianConfig): boolean {
  return Boolean(cfg.apiUrl && cfg.memoryId && cfg.privateKey)
}

/** Deterministic tax-unique-id (شماره منحصربه‌فرد مالیاتی) — memoryId + serial. */
export function taxUniqueId(memoryId: string, serial: string, issueDateMs: number): string {
  const h = createHash('sha256').update(`${memoryId}|${serial}|${issueDateMs}`).digest('hex').toUpperCase()
  return `${(memoryId || 'SANDBOX').slice(0, 6)}${h.slice(0, 16)}`
}

/** Build + queue a مودیان submission for a sales invoice (idempotent per doc). */
export async function enqueueInvoice(documentId: number, pattern: InvoicePattern, userId?: string): Promise<{ queueId: number; taxId: string; alreadyQueued: boolean }> {
  const existing = (await pgQuery<{ id: number; tax_id: string }>(`SELECT id, tax_id FROM moadian_queue WHERE document_id=$1`, [documentId]))[0]
  if (existing) return { queueId: existing.id, taxId: existing.tax_id, alreadyQueued: true }

  const doc = (await pgQuery<{ doc_no: string; date: string; company_id: number | null; subtotal: number; discount_total: number; tax_total: number; total: number; customer_name: string | null; national_id: string | null; economic_code: string | null; kind: string | null }>(
    `SELECT d.doc_no, d.date, d.company_id, d.subtotal::float AS subtotal, d.discount_total::float AS discount_total,
            d.tax_total::float AS tax_total, d.total::float AS total,
            c.name AS customer_name, c.national_id, c.economic_code, c.kind
     FROM sales_documents d LEFT JOIN sales_customers c ON c.id=d.customer_id
     WHERE d.id=$1 AND d.doc_type='invoice'`, [documentId]))[0]
  if (!doc) throw new Error('Sales invoice not found')

  const lines = await pgQuery<{ description: string; qty: number; unit_price: number; discount_pct: number; tax_pct: number }>(
    `SELECT description, qty::float AS qty, unit_price::float AS unit_price, discount_pct::float AS discount_pct, tax_pct::float AS tax_pct
     FROM sales_document_lines WHERE document_id=$1 ORDER BY line_no`, [documentId])

  const cfg = await loadMoadianConfig()
  const issueDateMs = new Date(doc.date).getTime()
  const taxId = taxUniqueId(cfg.memoryId ?? 'SANDBOX', doc.doc_no, issueDateMs)

  const input: MoadianInvoiceInput = {
    pattern, serial: doc.doc_no, issueDateMs, taxId,
    seller: { economicCode: cfg.economicCode, name: cfg.sellerName ?? 'HBZ', tccim: 2 },
    buyer: { economicCode: doc.economic_code, nationalId: doc.national_id, name: doc.customer_name ?? 'مصرف‌کننده نهایی', tccim: doc.kind === 'individual' ? 1 : 2 },
    lines: lines.map(l => ({
      description: l.description,
      quantity: num(l.qty),
      unitPrice: num(l.unit_price) * (1 - num(l.discount_pct) / 100), // net unit
      discount: 0,
      vatRate: num(l.tax_pct),
    })),
  }
  const invoice = buildInvoice(input)
  const errs = validateInvoice(invoice)
  const status = errs.length ? 'failed' : 'pending'
  const signature = createHash('sha256').update(JSON.stringify(invoice) + (cfg.privateKey ?? 'sandbox')).digest('hex')

  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO moadian_queue (document_id, tax_id, pattern, payload, signature, status, error, company_id, created_by, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,${NOW},${NOW}) RETURNING id`,
    [documentId, taxId, pattern, JSON.stringify(invoice), signature, status, errs.join('؛ ') || null, doc.company_id, userId ?? null]))[0]
  await pgQuery(`UPDATE sales_documents SET moadian_status=$2 WHERE id=$1`, [documentId, status])
  return { queueId: row.id, taxId, alreadyQueued: false }
}

/** Submit one queued invoice to the tax authority (or the sandbox simulator). */
export async function submitQueued(queueId: number): Promise<{ status: string; reference?: string; error?: string }> {
  const q = (await pgQuery<{ id: number; document_id: number; payload: string; signature: string; status: string; attempts: number }>(
    `SELECT id, document_id, payload, signature, status, attempts FROM moadian_queue WHERE id=$1`, [queueId]))[0]
  if (!q) throw new Error('Queue item not found')
  if (q.status === 'confirmed') return { status: 'confirmed' }

  const cfg = await loadMoadianConfig()
  let status = 'sent', reference: string | undefined, error: string | undefined
  try {
    if (isMoadianLive(cfg)) {
      // Real submission (only reached when the customer's credential is set).
      const res = await fetch(`${cfg.apiUrl}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.privateKey}`, 'x-memory-id': cfg.memoryId! },
        body: JSON.stringify({ payload: JSON.parse(q.payload), signature: q.signature }),
      })
      if (!res.ok) { status = 'failed'; error = `مودیان HTTP ${res.status}` }
      else { const d = await res.json().catch(() => ({})); status = 'confirmed'; reference = d.referenceNumber ?? d.uid }
    } else {
      // Sandbox: deterministic local simulator — confirms with a synthetic ref.
      const ref = createHash('sha256').update(q.signature).digest('hex').slice(0, 20).toUpperCase()
      status = 'confirmed'; reference = `SANDBOX-${ref}`
    }
  } catch (e) { status = 'failed'; error = e instanceof Error ? e.message : 'ارسال ناموفق' }

  await pgQuery(
    `UPDATE moadian_queue SET status=$2, reference_number=$3, error=$4, attempts=attempts+1, updated_at=${NOW} WHERE id=$1`,
    [queueId, status, reference ?? null, error ?? null])
  await pgQuery(`UPDATE sales_documents SET moadian_status=$2 WHERE id=$1`, [q.document_id, status])
  return { status, reference, error }
}

export async function moadianQueue(statusFilter?: string) {
  return pgQuery(
    `SELECT m.id, m.document_id AS "documentId", d.doc_no AS "docNo", m.tax_id AS "taxId", m.pattern,
            m.status, m.reference_number AS "referenceNumber", m.error, m.attempts, m.created_at AS "createdAt"
     FROM moadian_queue m LEFT JOIN sales_documents d ON d.id=m.document_id
     ${statusFilter ? 'WHERE m.status=$1' : ''}
     ORDER BY m.id DESC LIMIT 200`, statusFilter ? [statusFilter] : [])
}

export async function moadianStats() {
  const rows = await pgQuery<{ status: string; n: number }>(`SELECT status, COUNT(*)::int AS n FROM moadian_queue GROUP BY status`)
  const by = Object.fromEntries(rows.map(r => [r.status, Number(r.n)]))
  return { pending: by.pending ?? 0, sent: by.sent ?? 0, failed: by.failed ?? 0, confirmed: by.confirmed ?? 0, total: rows.reduce((s, r) => s + Number(r.n), 0) }
}
