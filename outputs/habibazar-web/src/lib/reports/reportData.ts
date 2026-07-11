/**
 * Reporting Platform — report catalog + server data layer (Phase 21.9).
 *
 * A fixed catalog of reports (no arbitrary SQL → no injection surface), each
 * backed by an existing module's data layer. `runReport` returns flat rows +
 * typed columns + a summary; the pure pivot/CSV helpers do the rest. Reports span
 * Financial / Sales / Purchasing / Inventory / Assets / Projects.
 */
import { pgQuery } from '@/lib/db'
import { financeReports } from '@/lib/erp/ledgerData'
import { loadCustomers } from '@/lib/erp/salesData'
import { loadProductLevels } from '@/lib/erp/inventoryData'
import { loadAssets } from '@/lib/erp/assetData'
import { costingPortfolio } from '@/lib/erp/costingData'
import type { Row, Column } from './pivot'

export interface ReportDef {
  id: string
  module: 'financial' | 'sales' | 'purchasing' | 'inventory' | 'assets' | 'projects'
  nameEn: string; nameFa: string
  /** sensible defaults for the pivot/chart UI */
  groupField?: string
  measureField?: string
}

export const REPORTS: ReportDef[] = [
  { id: 'fin_trial_balance', module: 'financial', nameEn: 'Trial Balance', nameFa: 'تراز آزمایشی', groupField: 'type', measureField: 'debit' },
  { id: 'fin_income', module: 'financial', nameEn: 'Income Statement', nameFa: 'صورت سود و زیان', groupField: 'kind', measureField: 'amount' },
  { id: 'sales_by_customer', module: 'sales', nameEn: 'Sales by Customer', nameFa: 'فروش به تفکیک مشتری', groupField: 'name', measureField: 'invoiced' },
  { id: 'sales_invoices', module: 'sales', nameEn: 'Invoice Register', nameFa: 'دفتر فاکتورها', groupField: 'status', measureField: 'total' },
  { id: 'purchase_register', module: 'purchasing', nameEn: 'Purchase Register', nameFa: 'دفتر خرید', groupField: 'status', measureField: 'total' },
  { id: 'purchase_by_vendor', module: 'purchasing', nameEn: 'Spend by Vendor', nameFa: 'خرید به تفکیک تأمین‌کننده', groupField: 'vendor', measureField: 'total' },
  { id: 'inv_valuation', module: 'inventory', nameEn: 'Inventory Valuation', nameFa: 'ارزش‌گذاری انبار', groupField: 'category', measureField: 'value' },
  { id: 'assets_register', module: 'assets', nameEn: 'Asset Register', nameFa: 'دفتر دارایی‌ها', groupField: 'category', measureField: 'bookValue' },
  { id: 'projects_costing', module: 'projects', nameEn: 'Project Costing', nameFa: 'هزینه‌یابی پروژه', groupField: 'name', measureField: 'profit' },
  { id: 'currency_exposure', module: 'financial', nameEn: 'Currency Exposure', nameFa: 'پوشش ارزی', groupField: 'currency', measureField: 'gainLoss' },
  { id: 'currency_gain_loss', module: 'financial', nameEn: 'Currency Gain/Loss (Exchange Differences)', nameFa: 'سود/زیان تسعیر ارز', groupField: 'date', measureField: 'net' },
]

export interface ReportOutput { columns: Column[]; rows: Row[]; summary: { label: string; value: number }[] }

const money = (n: number) => Math.round(n * 100) / 100

export async function runReport(id: string): Promise<ReportOutput | null> {
  switch (id) {
    case 'fin_trial_balance': {
      const r = await financeReports()
      const rows: Row[] = r.trialBalance.rows.map(x => ({ code: x.code, name: x.nameEn, type: x.type, debit: x.debit, credit: x.credit }))
      return {
        columns: [{ key: 'code', label: 'Code' }, { key: 'name', label: 'Account' }, { key: 'type', label: 'Type' }, { key: 'debit', label: 'Debit' }, { key: 'credit', label: 'Credit' }],
        rows,
        summary: [{ label: 'Total debit', value: r.trialBalance.totalDebit }, { label: 'Total credit', value: r.trialBalance.totalCredit }],
      }
    }
    case 'fin_income': {
      const r = await financeReports()
      const rows: Row[] = [
        ...r.incomeStatement.revenue.map(l => ({ code: l.code, name: l.nameEn, kind: 'Revenue', amount: l.amount })),
        ...r.incomeStatement.expenses.map(l => ({ code: l.code, name: l.nameEn, kind: 'Expense', amount: l.amount })),
      ]
      return {
        columns: [{ key: 'code', label: 'Code' }, { key: 'name', label: 'Account' }, { key: 'kind', label: 'Kind' }, { key: 'amount', label: 'Amount' }],
        rows,
        summary: [{ label: 'Revenue', value: r.incomeStatement.totalRevenue }, { label: 'Expenses', value: r.incomeStatement.totalExpenses }, { label: 'Net income', value: r.incomeStatement.netIncome }],
      }
    }
    case 'sales_by_customer': {
      const c = await loadCustomers()
      const rows: Row[] = c.map(x => ({ code: x.code, name: x.name, invoiced: x.invoiced, paid: x.paid, outstanding: x.outstanding }))
      return {
        columns: [{ key: 'code', label: 'Code' }, { key: 'name', label: 'Customer' }, { key: 'invoiced', label: 'Invoiced' }, { key: 'paid', label: 'Paid' }, { key: 'outstanding', label: 'Outstanding' }],
        rows,
        summary: [{ label: 'Invoiced', value: money(c.reduce((s, x) => s + x.invoiced, 0)) }, { label: 'Outstanding', value: money(c.reduce((s, x) => s + x.outstanding, 0)) }],
      }
    }
    case 'currency_exposure': {
      const { previewRevaluation } = await import('@/lib/erp/revaluationData')
      const p = await previewRevaluation()
      const rows: Row[] = p.positions.map(x => ({ position: x.label, kind: x.kind, currency: x.currency, amountForeign: x.amountForeign, bookedRate: x.bookedRate, currentRate: x.currentRate, bookedValue: x.bookedValue, currentValue: x.currentValue, gainLoss: x.gainLoss }))
      return {
        columns: [{ key: 'position', label: 'Position' }, { key: 'kind', label: 'Kind' }, { key: 'currency', label: 'Currency' }, { key: 'amountForeign', label: 'Foreign amount' }, { key: 'bookedRate', label: 'Booked rate' }, { key: 'currentRate', label: 'Current rate' }, { key: 'bookedValue', label: 'Booked (IRR)' }, { key: 'currentValue', label: 'Current (IRR)' }, { key: 'gainLoss', label: 'Unrealized G/L (IRR)' }],
        rows,
        summary: [{ label: 'Unrealized gain', value: p.totalGain }, { label: 'Unrealized loss', value: p.totalLoss }, { label: 'Net', value: p.net }, { label: 'Already booked', value: p.alreadyBooked }],
      }
    }
    case 'currency_gain_loss': {
      const { revaluationHistory } = await import('@/lib/erp/revaluationData')
      const h = (await revaluationHistory(200)) as { entryNo: string; date: string; memo: string | null; gain: number; loss: number }[]
      const rows: Row[] = h.map(x => ({ entryNo: x.entryNo, date: x.date, memo: x.memo ?? '', gain: x.gain, loss: x.loss, net: Math.round(x.gain - x.loss) }))
      return {
        columns: [{ key: 'entryNo', label: 'Entry' }, { key: 'date', label: 'Date' }, { key: 'memo', label: 'Memo' }, { key: 'gain', label: 'Gain (IRR)' }, { key: 'loss', label: 'Loss (IRR)' }, { key: 'net', label: 'Net (IRR)' }],
        rows,
        summary: [
          { label: 'Total gain', value: rows.reduce((s2, r) => s2 + Number(r.gain), 0) },
          { label: 'Total loss', value: rows.reduce((s2, r) => s2 + Number(r.loss), 0) },
        ],
      }
    }
    case 'purchase_register': {
      const rows = (await pgQuery(
        `SELECT d.doc_no AS "docNo", COALESCE(v.name,'—') AS vendor, d.doc_type AS "docType", d.date, d.status, d.total::float AS total, d.paid_total::float AS paid
         FROM purchase_documents d LEFT JOIN purchase_vendors v ON v.id=d.vendor_id
         WHERE d.status <> 'draft' ORDER BY d.date DESC`, [])) as Row[]
      return {
        columns: [{ key: 'docNo', label: 'No.' }, { key: 'vendor', label: 'Vendor' }, { key: 'docType', label: 'Type' }, { key: 'date', label: 'Date' }, { key: 'status', label: 'Status' }, { key: 'total', label: 'Total' }, { key: 'paid', label: 'Paid' }],
        rows,
        summary: [{ label: 'Documents', value: rows.length }, { label: 'Total', value: money(rows.reduce((s, r) => s + Number(r.total), 0)) }, { label: 'Paid', value: money(rows.reduce((s, r) => s + Number(r.paid), 0)) }],
      }
    }
    case 'purchase_by_vendor': {
      const rows = (await pgQuery(
        `SELECT v.code, v.name AS vendor, v.grade,
                COALESCE(SUM(CASE WHEN d.doc_type IN ('order','invoice') AND d.status NOT IN ('draft','void','rejected') THEN d.total ELSE 0 END),0)::float AS total,
                COALESCE(SUM(CASE WHEN d.doc_type='invoice' AND d.status NOT IN ('draft','void') THEN d.total - d.paid_total ELSE 0 END),0)::float AS outstanding
         FROM purchase_vendors v LEFT JOIN purchase_documents d ON d.vendor_id = v.id
         GROUP BY v.id, v.code, v.name, v.grade ORDER BY total DESC`, [])) as Row[]
      return {
        columns: [{ key: 'code', label: 'Code' }, { key: 'vendor', label: 'Vendor' }, { key: 'grade', label: 'Grade' }, { key: 'total', label: 'Committed spend' }, { key: 'outstanding', label: 'Outstanding' }],
        rows,
        summary: [{ label: 'Vendors', value: rows.length }, { label: 'Spend', value: money(rows.reduce((s, r) => s + Number(r.total), 0)) }, { label: 'Outstanding', value: money(rows.reduce((s, r) => s + Number(r.outstanding), 0)) }],
      }
    }
    case 'sales_invoices': {
      const rows = (await pgQuery(
        `SELECT d.doc_no AS "docNo", c.name AS customer, d.date, d.status, d.total::float AS total
         FROM sales_documents d JOIN sales_customers c ON c.id=d.customer_id WHERE d.doc_type='invoice' ORDER BY d.date DESC`, [])) as Row[]
      return {
        columns: [{ key: 'docNo', label: 'No.' }, { key: 'customer', label: 'Customer' }, { key: 'date', label: 'Date' }, { key: 'status', label: 'Status' }, { key: 'total', label: 'Total' }],
        rows,
        summary: [{ label: 'Invoices', value: rows.length }, { label: 'Total', value: money(rows.reduce((s, r) => s + Number(r.total), 0)) }],
      }
    }
    case 'inv_valuation': {
      const p = await loadProductLevels()
      const rows: Row[] = p.map(x => ({ sku: x.sku, name: x.nameEn, category: x.category, onHand: x.onHand, avgCost: x.avgCost, value: x.value, status: x.status }))
      return {
        columns: [{ key: 'sku', label: 'SKU' }, { key: 'name', label: 'Product' }, { key: 'category', label: 'Category' }, { key: 'onHand', label: 'On hand' }, { key: 'avgCost', label: 'Avg cost' }, { key: 'value', label: 'Value' }, { key: 'status', label: 'Status' }],
        rows,
        summary: [{ label: 'Products', value: p.length }, { label: 'Total value', value: money(p.reduce((s, x) => s + x.value, 0)) }],
      }
    }
    case 'assets_register': {
      const a = await loadAssets()
      const rows: Row[] = a.map(x => ({ name: x.name, category: x.category ?? '—', status: x.status, purchasePrice: x.purchasePrice, bookValue: x.bookValue, warranty: x.warranty.state }))
      return {
        columns: [{ key: 'name', label: 'Asset' }, { key: 'category', label: 'Category' }, { key: 'status', label: 'Status' }, { key: 'purchasePrice', label: 'Cost' }, { key: 'bookValue', label: 'Book value' }, { key: 'warranty', label: 'Warranty' }],
        rows,
        summary: [{ label: 'Assets', value: a.length }, { label: 'Cost', value: money(a.reduce((s, x) => s + x.purchasePrice, 0)) }, { label: 'Book value', value: money(a.reduce((s, x) => s + x.bookValue, 0)) }],
      }
    }
    case 'projects_costing': {
      const p = await costingPortfolio()
      const rows: Row[] = p.rows.map(x => ({ code: x.code, name: x.name, budget: x.budget, cost: x.cost, revenue: x.revenue, profit: x.profit }))
      return {
        columns: [{ key: 'code', label: 'Code' }, { key: 'name', label: 'Project' }, { key: 'budget', label: 'Budget' }, { key: 'cost', label: 'Cost' }, { key: 'revenue', label: 'Revenue' }, { key: 'profit', label: 'Profit' }],
        rows,
        summary: [{ label: 'Budget', value: p.kpis.budget }, { label: 'Cost', value: p.kpis.cost }, { label: 'Profit', value: p.kpis.profit }],
      }
    }
    default: return null
  }
}
