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
import { budgetPortfolio } from '@/lib/erp/budgetData'
import { costCenterOverview } from '@/lib/erp/costCenterData'
import { assembleKpis, runForecast } from '@/lib/erp/financialIntelligenceData'
import { executiveCockpit } from '@/lib/bi/cockpitData'
import { stockIntelligence, listBatches } from '@/lib/inventory/inventoryOpsData'
import { bankBalances } from '@/lib/treasury/bankOpsData'
import { currentCashPosition, liquidity, chequeDashboard } from '@/lib/treasury/analyticsData'
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
  { id: 'inv_intelligence', module: 'inventory', nameEn: 'Stock Intelligence (ABC/XYZ/Aging/Turnover)', nameFa: 'هوش موجودی (ABC/XYZ/عمر/گردش)', groupField: 'abc', measureField: 'value' },
  { id: 'inv_expiry', module: 'inventory', nameEn: 'Batch Expiration Report', nameFa: 'گزارش انقضای بچ', groupField: 'status', measureField: 'qtyRemaining' },
  { id: 'assets_register', module: 'assets', nameEn: 'Asset Register', nameFa: 'دفتر دارایی‌ها', groupField: 'category', measureField: 'bookValue' },
  { id: 'projects_costing', module: 'projects', nameEn: 'Project Costing', nameFa: 'هزینه‌یابی پروژه', groupField: 'name', measureField: 'profit' },
  { id: 'currency_exposure', module: 'financial', nameEn: 'Currency Exposure', nameFa: 'پوشش ارزی', groupField: 'currency', measureField: 'gainLoss' },
  { id: 'currency_gain_loss', module: 'financial', nameEn: 'Currency Gain/Loss (Exchange Differences)', nameFa: 'سود/زیان تسعیر ارز', groupField: 'date', measureField: 'net' },
  // Phase 26.11 — Financial Intelligence reports.
  { id: 'budget_report', module: 'financial', nameEn: 'Budget Report', nameFa: 'گزارش بودجه', groupField: 'status', measureField: 'budget' },
  { id: 'variance_report', module: 'financial', nameEn: 'Budget Variance Report', nameFa: 'گزارش مغایرت بودجه', groupField: 'status', measureField: 'variance' },
  { id: 'cost_center_report', module: 'financial', nameEn: 'Cost Center Report', nameFa: 'گزارش مراکز هزینه', groupField: 'kind', measureField: 'cost' },
  { id: 'profit_center_report', module: 'financial', nameEn: 'Profit Center Report', nameFa: 'گزارش مراکز سود', groupField: 'name', measureField: 'profit' },
  { id: 'cfo_report', module: 'financial', nameEn: 'CFO Report', nameFa: 'گزارش مدیر مالی', groupField: 'group', measureField: 'value' },
  { id: 'forecast_report', module: 'financial', nameEn: 'Financial Forecast Report', nameFa: 'گزارش پیش‌بینی مالی', groupField: 'kind', measureField: 'value' },
  // Phase 26.13 — executive management reports (CFO/Sales/Procurement/Project reuse existing).
  { id: 'ceo_report', module: 'financial', nameEn: 'CEO Report', nameFa: 'گزارش مدیرعامل', groupField: 'group', measureField: 'value' },
  { id: 'coo_report', module: 'financial', nameEn: 'COO Report', nameFa: 'گزارش مدیر عملیات', groupField: 'group', measureField: 'value' },
  // Phase 26.14 — treasury reports (currency exposure + FX gain/loss already exist).
  { id: 'treasury_bank_balance', module: 'financial', nameEn: 'Bank Balance Report', nameFa: 'گزارش مانده بانکی', groupField: 'currency', measureField: 'balance' },
  { id: 'treasury_cash_position', module: 'financial', nameEn: 'Cash Position Report', nameFa: 'گزارش وضعیت نقدی', groupField: 'metric', measureField: 'value' },
  { id: 'treasury_liquidity', module: 'financial', nameEn: 'Liquidity Risk Report', nameFa: 'گزارش ریسک نقدینگی', groupField: 'horizon', measureField: 'expectedBalance' },
  { id: 'treasury_cheque_aging', module: 'financial', nameEn: 'Cheque Aging Report', nameFa: 'گزارش سنی چک', groupField: 'bucket', measureField: 'amount' },
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
    // Phase 26.19 — stock-intelligence reports (ABC/XYZ/aging/turnover + expiry).
    case 'inv_intelligence': {
      const intel = await stockIntelligence()
      const rows: Row[] = intel.rows.map(r => ({ sku: r.sku, name: r.name, onHand: r.onHand, value: r.value, abc: r.abc, xyz: r.xyz, movement: r.movement, turnover: r.turnover, aging: r.aging, eoq: r.eoq }))
      return {
        columns: [{ key: 'sku', label: 'SKU' }, { key: 'name', label: 'Product' }, { key: 'onHand', label: 'On hand' }, { key: 'value', label: 'Value' }, { key: 'abc', label: 'ABC' }, { key: 'xyz', label: 'XYZ' }, { key: 'movement', label: 'Movement' }, { key: 'turnover', label: 'Turnover' }, { key: 'aging', label: 'Aging' }, { key: 'eoq', label: 'EOQ' }],
        rows,
        summary: [
          { label: 'Products', value: intel.kpis.products }, { label: 'Class A', value: intel.kpis.aCount },
          { label: 'Dead stock', value: intel.kpis.deadCount }, { label: 'Below reorder', value: intel.kpis.belowReorder },
          { label: 'Avg turnover', value: intel.kpis.avgTurnover },
        ],
      }
    }
    case 'inv_expiry': {
      const batches = await listBatches()
      const rows: Row[] = batches.map(b => ({ sku: b.sku, product: b.nameEn, batchNo: b.batchNo, expiryDate: b.expiryDate ?? '—', qtyRemaining: b.qtyRemaining, status: b.expiry }))
      return {
        columns: [{ key: 'sku', label: 'SKU' }, { key: 'product', label: 'Product' }, { key: 'batchNo', label: 'Batch' }, { key: 'expiryDate', label: 'Expiry' }, { key: 'qtyRemaining', label: 'Remaining' }, { key: 'status', label: 'Status' }],
        rows,
        summary: [
          { label: 'Batches', value: batches.length },
          { label: 'Expired/near', value: batches.filter(b => b.expiry === 'expired' || b.expiry === 'near').length },
        ],
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
    case 'budget_report': {
      const p = await budgetPortfolio()
      const rows: Row[] = p.map(b => ({ name: b.name, status: b.status, budget: money(b.budget), actual: money(b.actual), consumptionPct: money(b.consumptionPct) }))
      return {
        columns: [{ key: 'name', label: 'Budget' }, { key: 'status', label: 'Status' }, { key: 'budget', label: 'Budget' }, { key: 'actual', label: 'Actual' }, { key: 'consumptionPct', label: 'Consumption %' }],
        rows,
        summary: [{ label: 'Total budget', value: money(p.reduce((s, b) => s + b.budget, 0)) }, { label: 'Total actual', value: money(p.reduce((s, b) => s + b.actual, 0)) }],
      }
    }
    case 'variance_report': {
      const p = await budgetPortfolio()
      const rows: Row[] = p.map(b => ({ name: b.name, status: b.status, budget: money(b.budget), actual: money(b.actual), variance: money(b.actual - b.budget) }))
      return {
        columns: [{ key: 'name', label: 'Budget' }, { key: 'status', label: 'Status' }, { key: 'budget', label: 'Budget' }, { key: 'actual', label: 'Actual' }, { key: 'variance', label: 'Variance' }],
        rows,
        summary: [{ label: 'Total variance', value: money(p.reduce((s, b) => s + (b.actual - b.budget), 0)) }],
      }
    }
    case 'cost_center_report': {
      const o = await costCenterOverview()
      const rows: Row[] = o.centers.map(c => ({ code: c.code, name: c.nameEn, kind: c.kind, revenue: c.revenue, cost: c.cost, profit: c.profit }))
      return {
        columns: [{ key: 'code', label: 'Code' }, { key: 'name', label: 'Cost Center' }, { key: 'kind', label: 'Kind' }, { key: 'revenue', label: 'Revenue' }, { key: 'cost', label: 'Cost' }, { key: 'profit', label: 'Profit' }],
        rows,
        summary: [{ label: 'Total cost', value: o.totals.cost }, { label: 'Total revenue', value: o.totals.revenue }],
      }
    }
    case 'profit_center_report': {
      const o = await costCenterOverview()
      const rows: Row[] = o.centers.filter(c => c.kind === 'profit').map(c => ({ code: c.code, name: c.nameEn, revenue: c.revenue, cost: c.cost, profit: c.profit, marginPct: c.marginPct }))
      return {
        columns: [{ key: 'code', label: 'Code' }, { key: 'name', label: 'Profit Center' }, { key: 'revenue', label: 'Revenue' }, { key: 'cost', label: 'Cost' }, { key: 'profit', label: 'Profit' }, { key: 'marginPct', label: 'Margin %' }],
        rows,
        summary: [{ label: 'Total profit', value: money(rows.reduce((s, r) => s + Number(r.profit), 0)) }],
      }
    }
    case 'cfo_report': {
      const { kpis } = await assembleKpis()
      const rows: Row[] = [
        { group: 'Revenue', metric: 'Monthly revenue', value: kpis.revenue.monthly },
        { group: 'Revenue', metric: 'Growth rate %', value: kpis.revenue.growthRatePct },
        { group: 'Profit', metric: 'Gross profit', value: kpis.profit.gross },
        { group: 'Profit', metric: 'Net profit', value: kpis.profit.net },
        { group: 'Profit', metric: 'Net margin %', value: kpis.profit.netMarginPct },
        { group: 'Cash', metric: 'Cash position', value: kpis.cash.position },
        { group: 'Cash', metric: 'Burn rate', value: kpis.cash.burnRate },
        { group: 'Working capital', metric: 'Receivables', value: kpis.receivable.outstanding },
        { group: 'Working capital', metric: 'Payables', value: kpis.payable.outstanding },
        { group: 'Working capital', metric: 'Inventory value', value: kpis.inventory.value },
      ]
      return { columns: [{ key: 'group', label: 'Group' }, { key: 'metric', label: 'Metric' }, { key: 'value', label: 'Value' }], rows, summary: [{ label: 'Net profit', value: kpis.profit.net }] }
    }
    case 'forecast_report': {
      const f = await runForecast('revenue', 'trend', 3)
      const rows: Row[] = [
        ...f.history.map(p => ({ period: p.period, kind: 'Actual', value: p.value })),
        ...f.forecast.map(p => ({ period: p.period, kind: 'Forecast', value: p.value })),
      ]
      return { columns: [{ key: 'period', label: 'Period' }, { key: 'kind', label: 'Kind' }, { key: 'value', label: 'Revenue' }], rows, summary: [{ label: 'Next forecast', value: f.nextValue }] }
    }
    case 'ceo_report': {
      const c = await executiveCockpit()
      const rows: Row[] = [
        { group: 'Financial', metric: 'Revenue (monthly)', value: c.financial?.overview.revenue ?? 0 },
        { group: 'Financial', metric: 'Net profit', value: c.financial?.overview.profit ?? 0 },
        { group: 'Financial', metric: 'Cash position', value: c.financial?.overview.cash ?? 0 },
        { group: 'Performance', metric: 'KPI scorecard', value: c.scorecard.score },
        { group: 'Operations', metric: 'Sales invoiced', value: c.operational.salesInvoiced },
        { group: 'Operations', metric: 'Open projects', value: c.operational.openProjects },
        { group: 'Risk', metric: 'Open alerts', value: c.risk.openAlerts },
        { group: 'Risk', metric: 'Approval delays', value: c.risk.approvalDelays },
      ]
      return { columns: [{ key: 'group', label: 'Group' }, { key: 'metric', label: 'Metric' }, { key: 'value', label: 'Value' }], rows, summary: [{ label: 'KPI score', value: c.scorecard.score }] }
    }
    case 'coo_report': {
      const c = await executiveCockpit()
      const rows: Row[] = [
        { group: 'Sales', metric: 'Invoiced', value: c.operational.salesInvoiced },
        { group: 'Procurement', metric: 'Spend', value: c.operational.purchaseSpend },
        { group: 'Inventory', metric: 'Value', value: c.operational.inventoryValue },
        { group: 'Projects', metric: 'Open projects', value: c.operational.openProjects },
        { group: 'Projects', metric: 'Active tasks', value: c.operational.activeTasks },
        { group: 'Approvals', metric: 'Avg hours', value: c.approvals?.avgHours ?? 0 },
        { group: 'Approvals', metric: 'SLA violations', value: c.approvals?.slaViolations ?? 0 },
        { group: 'Risk', metric: 'Low stock', value: c.risk.lowStock },
      ]
      return { columns: [{ key: 'group', label: 'Group' }, { key: 'metric', label: 'Metric' }, { key: 'value', label: 'Value' }], rows, summary: [{ label: 'Open projects', value: c.operational.openProjects }] }
    }
    case 'treasury_bank_balance': {
      const banks = await bankBalances()
      const rows: Row[] = banks.map(b => ({ name: b.name, currency: b.currency, balance: money(b.balance) }))
      return { columns: [{ key: 'name', label: 'Bank account' }, { key: 'currency', label: 'Currency' }, { key: 'balance', label: 'Balance' }], rows, summary: [{ label: 'Total (IRR-base)', value: money(banks.reduce((s, b) => s + b.balance, 0)) }] }
    }
    case 'treasury_cash_position': {
      const p = await currentCashPosition()
      const rows: Row[] = [
        { metric: 'Bank', value: p.bank }, { metric: 'Cash', value: p.cash }, { metric: 'Available', value: p.available },
        { metric: 'Pending receipts', value: p.pendingReceipts }, { metric: 'Pending payments', value: p.pendingPayments }, { metric: 'Projected', value: p.projected },
      ]
      return { columns: [{ key: 'metric', label: 'Metric' }, { key: 'value', label: 'Value' }], rows, summary: [{ label: 'Projected cash', value: p.projected }] }
    }
    case 'treasury_liquidity': {
      const l = await liquidity()
      const rows: Row[] = l.buckets.map(b => ({ horizon: `${b.days}d`, inflow: b.inflow, outflow: b.outflow, net: b.net, expectedBalance: b.expectedBalance }))
      return { columns: [{ key: 'horizon', label: 'Horizon' }, { key: 'inflow', label: 'Inflow' }, { key: 'outflow', label: 'Outflow' }, { key: 'net', label: 'Net' }, { key: 'expectedBalance', label: 'Expected balance' }], rows, summary: [{ label: 'Risk', value: 0 }] }
    }
    case 'treasury_cheque_aging': {
      const c = await chequeDashboard()
      const rows: Row[] = c.aging.map(a => ({ bucket: a.bucket, count: a.count, amount: a.amount }))
      return { columns: [{ key: 'bucket', label: 'Bucket' }, { key: 'count', label: 'Count' }, { key: 'amount', label: 'Amount' }], rows, summary: [{ label: 'Total amount', value: money(c.aging.reduce((s, a) => s + a.amount, 0)) }] }
    }
    default: return null
  }
}
