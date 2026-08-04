/**
 * Phase 27 — the data gate that decides whether the CRM intelligence layer
 * (بند ۳) may be built at all.
 *
 * Why this exists: churn prediction over five test customers does not produce a
 * prediction, it produces a NUMBER — and a number a sales manager will trust.
 * That is worse than having nothing, because the absence of a feature is
 * visible while a badly-grounded score is not.
 *
 * So the thresholds are checked against the live database and reported as real
 * counts. If they are not met, بند ۳ is deferred WITH THOSE NUMBERS in the
 * report rather than built on sand.
 *
 * Usage:
 *   npx tsx scripts/crm-data-gate.ts            # human-readable
 *   npx tsx scripts/crm-data-gate.ts --json     # machine-readable
 */
import { pgQuery } from '@/lib/db'

const JSON_OUT = process.argv.includes('--json')

/** Minimums below which a trained/derived signal is not honest. */
export const THRESHOLDS = {
  activeCustomers: 20,
  monthsOfHistory: 3,
  transactions: 50,
} as const

export interface GateMetrics {
  activeCustomers: number
  transactions: number
  monthsOfHistory: number
  invoices90d: number
  closedLeads: number
  opportunities: number
}

/** Pure: does this dataset support a derived intelligence signal? */
export function gateVerdict(m: GateMetrics, t = THRESHOLDS) {
  const reasons: string[] = []
  if (m.activeCustomers < t.activeCustomers)
    reasons.push(`مشتری فعال ${m.activeCustomers} < ${t.activeCustomers}`)
  if (m.monthsOfHistory < t.monthsOfHistory)
    reasons.push(`تاریخچه ${m.monthsOfHistory} ماه < ${t.monthsOfHistory} ماه`)
  if (m.transactions < t.transactions)
    reasons.push(`تراکنش ${m.transactions} < ${t.transactions}`)
  return { pass: reasons.length === 0, reasons }
}

async function num(sql: string): Promise<number> {
  try {
    const r = await pgQuery<{ n: string }>(sql)
    return Number(r[0]?.n ?? 0)
  } catch { return 0 }
}

export async function collect(): Promise<GateMetrics> {
  return {
    activeCustomers: await num(
      `SELECT count(*)::text AS n FROM sales_customers WHERE COALESCE(active, true)`),
    transactions: await num(
      `SELECT count(*)::text AS n FROM sales_documents WHERE doc_type='invoice' AND status NOT IN ('draft','void')`),
    invoices90d: await num(
      `SELECT count(*)::text AS n FROM sales_documents
       WHERE doc_type='invoice' AND status NOT IN ('draft','void')
         AND date::date > (now() - interval '90 days')::date`),
    monthsOfHistory: await num(
      `SELECT COALESCE(CEIL(EXTRACT(EPOCH FROM (max(date::timestamp) - min(date::timestamp))) / 2592000), 0)::text AS n
       FROM sales_documents WHERE doc_type='invoice' AND status NOT IN ('draft','void')`),
    closedLeads: await num(
      `SELECT count(*)::text AS n FROM crm_leads WHERE status IN ('won','lost')`),
    opportunities: await num(
      `SELECT count(*)::text AS n FROM crm_opportunities`),
  }
}

async function main() {
  const m = await collect()
  const v = gateVerdict(m)

  if (JSON_OUT) {
    console.log(JSON.stringify({ metrics: m, thresholds: THRESHOLDS, ...v }, null, 2))
    process.exit(v.pass ? 0 : 1)
  }

  const row = (label: string, value: number, min?: number) => {
    const okMark = min === undefined ? ' ' : value >= min ? '✔' : '✘'
    const need = min === undefined ? '' : `  (حداقل ${min})`
    console.log(`  ${okMark} ${label.padEnd(34)} ${String(value).padStart(6)}${need}`)
  }

  console.log('\n  گیت دادهٔ هوش تجاری CRM (فاز ۲۷ بند ۳)')
  console.log('  ────────────────────────────────────────────────')
  row('مشتری فعال', m.activeCustomers, THRESHOLDS.activeCustomers)
  row('تراکنش فروش (فاکتور غیرپیش‌نویس)', m.transactions, THRESHOLDS.transactions)
  row('تاریخچه (ماه)', m.monthsOfHistory, THRESHOLDS.monthsOfHistory)
  row('فاکتور ۹۰ روز اخیر', m.invoices90d)
  row('لید بسته‌شده (برد/باخت)', m.closedLeads)
  row('فرصت فروش', m.opportunities)
  console.log('  ────────────────────────────────────────────────')

  if (v.pass) {
    console.log('  ✅ دادهٔ کافی — بند ۳ می‌تواند ساخته شود.\n')
  } else {
    console.log('  🔴 دادهٔ ناکافی — بند ۳ باید deferred شود.')
    v.reasons.forEach(r => console.log(`     · ${r}`))
    console.log('')
  }
  process.exit(v.pass ? 0 : 1)
}

if (process.argv[1]?.includes('crm-data-gate')) main()
