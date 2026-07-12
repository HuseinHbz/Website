/**
 * Financial Alerts engine (Phase 26.11, M9) — pure, unit-tested.
 *
 * Deterministic rules over live inputs (budget consumption, cash runway, overdue
 * AR, FX exposure, tax liability) → bilingual alerts with a stable fingerprint
 * for idempotent upsert/dedupe in `financialAlertsData.ts`.
 */

export type AlertSeverity = 'info' | 'warning' | 'critical'
export type AlertKind = 'budget_overrun' | 'cash_shortage' | 'ar_overdue' | 'fx_exposure' | 'tax_liability'

export interface FinancialAlert {
  kind: AlertKind
  severity: AlertSeverity
  titleEn: string
  titleFa: string
  detail: string
  metricValue?: number
  refType?: string
  refId?: number
  fingerprint: string
}

export interface AlertInputs {
  budgets?: { id?: number; name: string; consumptionPct: number }[]
  cash?: { balance: number; monthlyBurn: number }
  overdueAR?: { customerId?: number; customer: string; amount: number; daysOverdue: number }[]
  fx?: { code: string; exposurePct: number; changePct?: number }[]
  taxLiability?: number
}

function fp(parts: (string | number)[]): string {
  return parts.map(p => String(p)).join('|').toLowerCase().replace(/\s+/g, '-')
}

/** Derive the current alert set. Thresholds: budget ≥90% warn / >100% critical;
 * cash runway <1mo critical / <2mo warn; any overdue AR; FX change >20%. */
export function deriveAlerts(input: AlertInputs): FinancialAlert[] {
  const out: FinancialAlert[] = []

  for (const b of input.budgets ?? []) {
    if (b.consumptionPct > 100) {
      out.push({ kind: 'budget_overrun', severity: 'critical', metricValue: b.consumptionPct, refId: b.id, refType: 'budget',
        titleEn: `${b.name} exceeded its budget (${b.consumptionPct.toFixed(0)}%)`,
        titleFa: `${b.name} از بودجه فراتر رفت (${b.consumptionPct.toFixed(0)}٪)`,
        detail: `Consumption ${b.consumptionPct.toFixed(1)}% of budget.`, fingerprint: fp(['budget_overrun', b.id ?? b.name]) })
    } else if (b.consumptionPct >= 90) {
      out.push({ kind: 'budget_overrun', severity: 'warning', metricValue: b.consumptionPct, refId: b.id, refType: 'budget',
        titleEn: `${b.name} reached ${b.consumptionPct.toFixed(0)}% of budget`,
        titleFa: `${b.name} به ${b.consumptionPct.toFixed(0)}٪ بودجه رسید`,
        detail: `Consumption ${b.consumptionPct.toFixed(1)}% — approaching the limit.`, fingerprint: fp(['budget_warn', b.id ?? b.name]) })
    }
  }

  if (input.cash && input.cash.monthlyBurn > 0) {
    const runway = input.cash.balance / input.cash.monthlyBurn
    if (runway < 1) {
      out.push({ kind: 'cash_shortage', severity: 'critical', metricValue: round1(runway),
        titleEn: `Expected cash shortage within 30 days`, titleFa: `کسری نقدینگی مورد انتظار طی ۳۰ روز`,
        detail: `Runway ≈ ${round1(runway)} month at the current burn rate.`, fingerprint: fp(['cash_shortage', 'critical']) })
    } else if (runway < 2) {
      out.push({ kind: 'cash_shortage', severity: 'warning', metricValue: round1(runway),
        titleEn: `Low cash runway (${round1(runway)} months)`, titleFa: `نقدینگی کم (${round1(runway)} ماه)`,
        detail: `Runway ≈ ${round1(runway)} months at the current burn rate.`, fingerprint: fp(['cash_shortage', 'warning']) })
    }
  }

  for (const ar of input.overdueAR ?? []) {
    if (ar.amount > 0 && ar.daysOverdue > 0) {
      out.push({ kind: 'ar_overdue', severity: ar.daysOverdue >= 60 ? 'critical' : 'warning', metricValue: ar.amount,
        refId: ar.customerId, refType: 'customer',
        titleEn: `${ar.customer} payment overdue ${ar.daysOverdue}d`, titleFa: `پرداخت ${ar.customer} ${ar.daysOverdue} روز معوق`,
        detail: `Outstanding ${ar.amount.toLocaleString()} overdue by ${ar.daysOverdue} days.`, fingerprint: fp(['ar_overdue', ar.customerId ?? ar.customer]) })
    }
  }

  for (const f of input.fx ?? []) {
    if ((f.changePct ?? 0) > 20) {
      out.push({ kind: 'fx_exposure', severity: 'warning', metricValue: f.changePct,
        titleEn: `${f.code} exposure increased ${f.changePct!.toFixed(0)}%`, titleFa: `پوشش ${f.code} ${f.changePct!.toFixed(0)}٪ افزایش یافت`,
        detail: `${f.code} exposure now ${f.exposurePct.toFixed(1)}% of the book.`, fingerprint: fp(['fx_exposure', f.code]) })
    }
  }

  if ((input.taxLiability ?? 0) > 0) {
    out.push({ kind: 'tax_liability', severity: 'info', metricValue: input.taxLiability,
      titleEn: `Outstanding tax liability`, titleFa: `بدهی مالیاتی معوق`,
      detail: `Taxes payable balance ${input.taxLiability!.toLocaleString()}.`, fingerprint: fp(['tax_liability']) })
  }

  return out
}

function round1(n: number): number { return Math.round(n * 10) / 10 }
