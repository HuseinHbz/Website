/**
 * گزارش معاملات فصلی (TTMS — Seasonal Transactions) — Phase 26.24 بند ۴.۳.
 * Standard quarterly purchase/sales listing for the Iranian tax authority,
 * bounded by Persian (Jalali) quarter. Reads confirmed sales + purchase
 * documents in the Gregorian window that maps to the chosen شمسی quarter.
 * Pure aggregation over the already-verified document tables.
 */
import { pgQuery } from '@/lib/db'
import { quarterBounds, jalaliQuarter } from './jalali'

const num = (v: unknown) => Number(v ?? 0)

export interface TtmsRow {
  partyName: string
  economicCode: string | null
  nationalId: string | null
  count: number
  totalBeforeTax: number
  totalDiscount: number
  totalVat: number
  total: number
}
export interface TtmsReport {
  quarter: { jYear: number; quarter: number; label: string; from: string; to: string }
  sales: TtmsRow[]
  purchases: TtmsRow[]
  summary: { salesCount: number; salesTotal: number; salesVat: number; purchaseCount: number; purchaseTotal: number; purchaseVat: number }
}

/** Build the seasonal report for a Persian year + quarter (1..4). */
export async function ttmsReport(jYear: number, quarter: 1 | 2 | 3 | 4): Promise<TtmsReport> {
  const { from, to } = quarterBounds(jYear, quarter)
  const label = jalaliQuarter(from).label

  // Sales grouped by customer (confirmed/paid invoices only, exclude drafts/void/deleted).
  const salesRows = await pgQuery<{ name: string; economic_code: string | null; national_id: string | null; count: number; subtotal: number; discount_total: number; tax_total: number; total: number }>(
    `SELECT COALESCE(c.name,'مصرف‌کننده نهایی') AS name, c.economic_code, c.national_id,
            COUNT(*)::int AS count,
            COALESCE(SUM(d.subtotal),0)::float AS subtotal,
            COALESCE(SUM(d.discount_total),0)::float AS discount_total,
            COALESCE(SUM(d.tax_total),0)::float AS tax_total,
            COALESCE(SUM(d.total),0)::float AS total
     FROM sales_documents d LEFT JOIN sales_customers c ON c.id=d.customer_id
     WHERE d.doc_type='invoice' AND d.status NOT IN ('draft','void') AND d.deleted_at IS NULL
       AND d.date >= $1 AND d.date <= $2
     GROUP BY c.name, c.economic_code, c.national_id
     ORDER BY total DESC`, [from, to])

  const purchaseRows = await pgQuery<{ name: string; economic_code: string | null; tax_id: string | null; count: number; subtotal: number; discount_total: number; tax_total: number; total: number }>(
    `SELECT COALESCE(v.name,'؟') AS name, v.economic_code, v.tax_id,
            COUNT(*)::int AS count,
            COALESCE(SUM(d.subtotal),0)::float AS subtotal,
            COALESCE(SUM(d.discount_total),0)::float AS discount_total,
            COALESCE(SUM(d.tax_total),0)::float AS tax_total,
            COALESCE(SUM(d.total),0)::float AS total
     FROM purchase_documents d LEFT JOIN purchase_vendors v ON v.id=d.vendor_id
     WHERE d.doc_type='invoice' AND d.status NOT IN ('draft','void','rejected')
       AND d.date >= $1 AND d.date <= $2
     GROUP BY v.name, v.economic_code, v.tax_id
     ORDER BY total DESC`, [from, to])

  const sales: TtmsRow[] = salesRows.map(r => ({
    partyName: r.name, economicCode: r.economic_code, nationalId: r.national_id,
    count: Number(r.count), totalBeforeTax: num(r.subtotal) - num(r.discount_total),
    totalDiscount: num(r.discount_total), totalVat: num(r.tax_total), total: num(r.total),
  }))
  const purchases: TtmsRow[] = purchaseRows.map(r => ({
    partyName: r.name, economicCode: r.economic_code, nationalId: r.tax_id,
    count: Number(r.count), totalBeforeTax: num(r.subtotal) - num(r.discount_total),
    totalDiscount: num(r.discount_total), totalVat: num(r.tax_total), total: num(r.total),
  }))

  return {
    quarter: { jYear, quarter, label, from, to },
    sales, purchases,
    summary: {
      salesCount: sales.reduce((s, r) => s + r.count, 0),
      salesTotal: sales.reduce((s, r) => s + r.total, 0),
      salesVat: sales.reduce((s, r) => s + r.totalVat, 0),
      purchaseCount: purchases.reduce((s, r) => s + r.count, 0),
      purchaseTotal: purchases.reduce((s, r) => s + r.total, 0),
      purchaseVat: purchases.reduce((s, r) => s + r.totalVat, 0),
    },
  }
}

/** RFC-4180 CSV (importable into the tax portal), one section per direction. */
export function ttmsCsv(report: TtmsReport): string {
  const esc = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const header = 'direction,party,economic_code,national_id,count,before_tax,discount,vat,total'
  const rows = [
    ...report.sales.map(r => ['sale', r.partyName, r.economicCode, r.nationalId, r.count, r.totalBeforeTax, r.totalDiscount, r.totalVat, r.total]),
    ...report.purchases.map(r => ['purchase', r.partyName, r.economicCode, r.nationalId, r.count, r.totalBeforeTax, r.totalDiscount, r.totalVat, r.total]),
  ]
  return [header, ...rows.map(r => r.map(esc).join(','))].join('\n')
}
