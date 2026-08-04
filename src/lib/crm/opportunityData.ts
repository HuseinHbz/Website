/**
 * Phase 27 بند۱ — opportunity server layer.
 *
 * Reuses what already exists rather than building beside it: the numbering
 * engine for document numbers, the sales document tables for conversion, and
 * the RBAC row-scope helper for visibility. There is no second way to create a
 * sales document here — a won opportunity produces a normal draft quotation or
 * invoice that the Sales Center then owns.
 */
import { pgQuery } from '@/lib/db'
import { nextNumber } from '@/lib/numbering/integrate'
import {
  pipelineSummary, lossBreakdown, itemsTotal, itemTotal,
  type Opportunity, type OpportunityStage,
} from './opportunities'

const NOW = `to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`

export interface OpportunityRow extends Opportunity {
  id: number
  customerName: string | null
  ownerName: string | null
  currency: string
  salesDocumentId: number | null
  salesDocNo: string | null
  leadId: number | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface OpportunityInput {
  title: string
  amount?: number
  currency?: string
  probability?: number
  stage?: OpportunityStage
  expectedCloseDate?: string | null
  customerId?: number | null
  leadId?: number | null
  ownerId?: string | null
  outcomeReason?: string | null
  notes?: string | null
}

/**
 * List opportunities, scoped. `scopeClause`/`scopeParams` come from the shared
 * `rowScopeSql` helper so a rep with `scope=own` sees only their own deals —
 * enforced in the WHERE, never as a UI filter (26.28).
 */
export async function listOpportunities(
  opts: { scopeClause?: string; scopeParams?: unknown[]; stage?: string; customerId?: number } = {},
): Promise<OpportunityRow[]> {
  const params: unknown[] = []
  let where = '1=1'
  if (opts.customerId) { params.push(opts.customerId); where += ` AND o.customer_id=$${params.length}` }
  if (opts.stage) { params.push(opts.stage); where += ` AND o.stage=$${params.length}` }
  const scope = opts.scopeClause ?? ''
  const rows = await pgQuery<Record<string, unknown>>(
    `SELECT o.id, o.title, o.amount::float AS amount, o.currency, o.probability, o.stage,
            o.expected_close_date AS "expectedCloseDate", o.customer_id AS "customerId",
            o.lead_id AS "leadId", o.owner_id AS "ownerId", o.outcome_reason AS "outcomeReason",
            o.sales_document_id AS "salesDocumentId", o.notes,
            o.created_at AS "createdAt", o.updated_at AS "updatedAt",
            c.name AS "customerName", u.name AS "ownerName", sd.doc_no AS "salesDocNo"
     FROM crm_opportunities o
     LEFT JOIN sales_customers c ON c.id = o.customer_id
     LEFT JOIN users u ON u.id = o.owner_id
     LEFT JOIN sales_documents sd ON sd.id = o.sales_document_id
     WHERE ${where}${scope}
     ORDER BY o.updated_at DESC`,
    [...params, ...(opts.scopeParams ?? [])],
  )
  return rows as unknown as OpportunityRow[]
}

export async function overview(scopeClause = '', scopeParams: unknown[] = []) {
  const rows = await listOpportunities({ scopeClause, scopeParams })
  return {
    opportunities: rows,
    summary: pipelineSummary(rows),
    losses: lossBreakdown(rows),
  }
}

export async function lossReasons() {
  return await pgQuery<{ id: number; labelEn: string; labelFa: string }>(
    `SELECT id, label_en AS "labelEn", label_fa AS "labelFa" FROM crm_loss_reasons
     WHERE active=1 ORDER BY sort_order, id`)
}

export async function createOpportunity(d: OpportunityInput, userId: string): Promise<number> {
  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO crm_opportunities
       (customer_id, lead_id, title, amount, currency, probability, stage,
        expected_close_date, owner_id, outcome_reason, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [d.customerId ?? null, d.leadId ?? null, d.title, d.amount ?? 0, d.currency ?? 'IRR',
      d.probability ?? 10, d.stage ?? 'identified', d.expectedCloseDate ?? null,
      d.ownerId ?? userId, d.outcomeReason ?? null, d.notes ?? null, userId],
  ))[0]
  return row.id
}

export async function updateOpportunity(id: number, d: Partial<OpportunityInput>) {
  // COALESCE on every field so a partial update (the kanban sends only a stage)
  // never blanks out the rest — the 26.30 BUG-206 lesson, applied up front.
  await pgQuery(
    `UPDATE crm_opportunities SET
       title = COALESCE($2, title),
       amount = COALESCE($3, amount),
       currency = COALESCE($4, currency),
       probability = COALESCE($5, probability),
       stage = COALESCE($6, stage),
       expected_close_date = COALESCE($7, expected_close_date),
       customer_id = COALESCE($8, customer_id),
       owner_id = COALESCE($9, owner_id),
       outcome_reason = COALESCE($10, outcome_reason),
       notes = COALESCE($11, notes),
       updated_at = ${NOW}
     WHERE id=$1`,
    [id, d.title ?? null, d.amount ?? null, d.currency ?? null, d.probability ?? null,
      d.stage ?? null, d.expectedCloseDate ?? null, d.customerId ?? null,
      d.ownerId ?? null, d.outcomeReason ?? null, d.notes ?? null],
  )
}

export async function getOpportunity(id: number): Promise<OpportunityRow | null> {
  const rows = await listOpportunities()
  return rows.find(r => r.id === id) ?? null
}

export async function itemsOf(opportunityId: number) {
  return await pgQuery<{ id: number; description: string; qty: number; unitPrice: number; discountPct: number; taxPct: number; productId: number | null; lineNo: number }>(
    `SELECT id, description, qty::float AS qty, unit_price::float AS "unitPrice",
            discount_pct::float AS "discountPct", tax_pct::float AS "taxPct",
            product_id AS "productId", line_no AS "lineNo"
     FROM crm_opportunity_items WHERE opportunity_id=$1 ORDER BY line_no`, [opportunityId])
}

export async function setItems(
  opportunityId: number,
  items: { description: string; qty: number; unitPrice: number; discountPct?: number; taxPct?: number; productId?: number | null }[],
) {
  await pgQuery(`DELETE FROM crm_opportunity_items WHERE opportunity_id=$1`, [opportunityId])
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    await pgQuery(
      `INSERT INTO crm_opportunity_items (opportunity_id, description, qty, unit_price, discount_pct, tax_pct, product_id, line_no)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [opportunityId, it.description, it.qty, it.unitPrice, it.discountPct ?? 0, it.taxPct ?? 0, it.productId ?? null, i])
  }
  // Keep the headline amount consistent with the lines the operator just typed.
  await pgQuery(`UPDATE crm_opportunities SET amount=$2, updated_at=${NOW} WHERE id=$1`,
    [opportunityId, itemsTotal(items)])
}

/**
 * Convert a won opportunity into a sales document.
 *
 * Deliberately produces a DRAFT quote/invoice: conversion is a hand-off to
 * Sales, not an
 * accounting event. Posting to the GL stays where it already lives (confirming
 * the invoice), so there is exactly one path into the ledger.
 *
 * Idempotent — a second call returns the document already linked, so a
 * double-click cannot create two quotations for one deal.
 */
export async function convertToSalesDocument(
  opportunityId: number,
  docType: 'quote' | 'invoice',
  userId: string,
): Promise<{ ok: boolean; error?: string; documentId?: number; docNo?: string; alreadyConverted?: boolean }> {
  const opp = (await pgQuery<{ id: number; customer_id: number | null; title: string; amount: number; currency: string; sales_document_id: number | null; notes: string | null }>(
    `SELECT id, customer_id, title, amount::float AS amount, currency, sales_document_id, notes
     FROM crm_opportunities WHERE id=$1`, [opportunityId]))[0]
  if (!opp) return { ok: false, error: 'Opportunity not found' }

  if (opp.sales_document_id) {
    const existing = (await pgQuery<{ doc_no: string }>(
      `SELECT doc_no FROM sales_documents WHERE id=$1`, [opp.sales_document_id]))[0]
    return { ok: true, documentId: opp.sales_document_id, docNo: existing?.doc_no, alreadyConverted: true }
  }
  if (!opp.customer_id) {
    return { ok: false, error: 'Opportunity has no customer — link a customer before converting' }
  }

  const items = await itemsOf(opportunityId)
  // With no proposed lines, the headline amount becomes a single line so the
  // document is never empty and its total always matches the deal.
  const lines = items.length > 0
    ? items.map(i => ({ description: i.description, qty: i.qty, unitPrice: i.unitPrice, discountPct: i.discountPct, taxPct: i.taxPct, productId: i.productId }))
    : [{ description: opp.title, qty: 1, unitPrice: opp.amount, discountPct: 0, taxPct: 0, productId: null }]

  const subtotal = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0)
  const total = lines.reduce((s, l) => s + itemTotal(l), 0)
  const taxTotal = Math.round((total - lines.reduce((s, l) => {
    const gross = l.qty * l.unitPrice
    return s + (gross - gross * ((l.discountPct || 0) / 100))
  }, 0)) * 100) / 100
  const discountTotal = Math.round((subtotal - lines.reduce((s, l) => {
    const gross = l.qty * l.unitPrice
    return s + (gross - gross * ((l.discountPct || 0) / 100))
  }, 0)) * 100) / 100

  // Same call the Sales Center makes — one numbering contract, not a second.
  const docNo = await nextNumber(docType, {
    module: 'sales', userId,
    legacyPrefix: docType === 'invoice' ? 'INV' : 'QT',
  })
  const doc = (await pgQuery<{ id: number }>(
    `INSERT INTO sales_documents
       (doc_type, doc_no, customer_id, date, status, subtotal, discount_total, tax_total, total,
        notes, created_by, currency, exchange_rate, base_total, updated_at)
     VALUES ($1,$2,$3,to_char(now(),'YYYY-MM-DD'),'draft',$4,$5,$6,$7,$8,$9,$10,1,$7,${NOW})
     RETURNING id`,
    [docType, docNo, opp.customer_id, subtotal, discountTotal, taxTotal, total,
      opp.notes ?? `Opportunity #${opportunityId}: ${opp.title}`, userId, opp.currency],
  ))[0]

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    await pgQuery(
      `INSERT INTO sales_document_lines (document_id, description, qty, unit_price, discount_pct, tax_pct, line_total, line_no, product_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [doc.id, l.description, l.qty, l.unitPrice, l.discountPct ?? 0, l.taxPct ?? 0, itemTotal(l), i, l.productId ?? null])
  }

  // Two-way link, so the deal shows its document and the document its deal.
  await pgQuery(`UPDATE crm_opportunities SET sales_document_id=$2, updated_at=${NOW} WHERE id=$1`,
    [opportunityId, doc.id])

  return { ok: true, documentId: doc.id, docNo }
}

export async function deleteOpportunity(id: number) {
  await pgQuery(`DELETE FROM crm_opportunities WHERE id=$1`, [id])
}

/** Open opportunities for the Customer 360 panel. */
export async function customerOpportunities(customerId: number) {
  const rows = await listOpportunities({ customerId })
  return { opportunities: rows, summary: pipelineSummary(rows) }
}
