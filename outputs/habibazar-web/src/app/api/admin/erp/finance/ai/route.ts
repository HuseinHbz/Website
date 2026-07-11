import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import { runCompletion, AiConfigError } from '@/lib/ai/engine'
import { financeOverview } from '@/lib/erp/ledgerData'
import { scanAnomalies, scanPaymentAnomalies, buildFinancePrompt, type EntryFact, type PaymentFact, type FinanceAiAction } from '@/lib/erp/financeAi'
import { forecastSales } from '@/lib/erp/salesPerformance'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Compact, read-only snapshot of the live books for grounding the LLM. */
async function financeSnapshot(): Promise<{ text: string; anomalies: ReturnType<typeof scanAnomalies> }> {
  const ov = await financeOverview()
  const payables = Number((await pgQuery<{ t: number }>(`SELECT COALESCE(SUM(total-paid_total),0)::float AS t FROM purchase_documents WHERE doc_type='invoice' AND status IN ('confirmed','partial')`))[0]?.t ?? 0)
  const receivables = Number((await pgQuery<{ t: number }>(`SELECT COALESCE(SUM(total-paid_total),0)::float AS t FROM sales_documents WHERE doc_type='invoice' AND status IN ('sent','confirmed','partial')`))[0]?.t ?? 0)
  const entries = await pgQuery<{ id: number; date: string; total: number; memo: string | null }>(
    `SELECT id, date, total::float AS total, memo FROM gl_journal_entries WHERE status='posted' ORDER BY date DESC LIMIT 200`)
  // Payment fraud scan (26.6): duplicate double-pays + outliers, both ledgers.
  const salesPays = await pgQuery<{ id: number; date: string; amount: number; party: string }>(
    `SELECT p.id, p.date, p.amount::float AS amount, COALESCE(c.name,'?') AS party
     FROM sales_payments p LEFT JOIN sales_customers c ON c.id=p.customer_id ORDER BY p.date DESC LIMIT 200`)
  const purchasePays = await pgQuery<{ id: number; date: string; amount: number; party: string }>(
    `SELECT p.id, p.date, p.amount::float AS amount, COALESCE(v.name,'?') AS party
     FROM purchase_payments p LEFT JOIN purchase_vendors v ON v.id=p.vendor_id ORDER BY p.date DESC LIMIT 200`)
  const payments: PaymentFact[] = [
    ...salesPays.map(p => ({ id: p.id, party: p.party, date: p.date, amount: Number(p.amount), source: 'sales' as const })),
    ...purchasePays.map(p => ({ id: p.id, party: p.party, date: p.date, amount: Number(p.amount), source: 'purchase' as const })),
  ]
  const anomalies = [...scanAnomalies(entries as EntryFact[]), ...scanPaymentAnomalies(payments)]
  // Deterministic trend series (26.6): 6-month sales/purchase history + linear forecast.
  const monthly = async (sql: string) => (await pgQuery<{ month: string; v: number }>(sql)) as { month: string; v: number }[]
  const salesM = await monthly(`SELECT substr(date,1,7) AS month, COALESCE(SUM(total),0)::float AS v FROM sales_documents WHERE doc_type='invoice' AND status<>'void' GROUP BY 1 ORDER BY 1 DESC LIMIT 6`)
  const spendM = await monthly(`SELECT substr(date,1,7) AS month, COALESCE(SUM(total),0)::float AS v FROM purchase_documents WHERE doc_type='invoice' AND status NOT IN ('draft','void','rejected') GROUP BY 1 ORDER BY 1 DESC LIMIT 6`)
  const series = (rows: { month: string; v: number }[]) => rows.slice().reverse().map(r => ({ month: r.month, invoiced: r.v }))
  const fmtSeries = (rows: { month: string; invoiced: number }[]) => rows.map(r => `${r.month}:${r.invoiced}`).join(' ') || 'none'
  const salesSeries = series(salesM), spendSeries = series(spendM)
  const k = ov.kpis
  const text = [
    `Assets ${k.totalAssets} | Liabilities ${k.totalLiabilities} | Equity ${k.totalEquity} | Cash ${k.cash}`,
    `Revenue ${k.revenue} | Expenses ${k.expenses} | Net income ${k.netIncome}`,
    `Open receivables ${receivables} | Open payables ${payables}`,
    `Monthly sales (last 6): ${fmtSeries(salesSeries)} | trend forecast next 3: ${fmtSeries(forecastSales(salesSeries, 3))}`,
    `Monthly purchase spend (last 6): ${fmtSeries(spendSeries)} | trend forecast next 3: ${fmtSeries(forecastSales(spendSeries, 3))}`,
    `Posted entries (recent ${entries.length}): ` + entries.slice(0, 12).map(e => `#${e.id} ${e.date} ${e.total}${e.memo ? ` (${e.memo.slice(0, 40)})` : ''}`).join('; '),
  ].join('\n')
  return { text, anomalies }
}

const schema = z.object({
  action: z.enum(['explain', 'summarize', 'analyze', 'forecast']),
  question: z.string().max(2000).optional(),
  locale: z.enum(['en', 'fa']).default('en'),
})

// POST — grounded finance assistant via the SHARED AI engine. Every generation
// is audited; the LLM only sees the injected read-only snapshot.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin('edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    const snap = await financeSnapshot()
    const { systemPrompt, userMessage } = buildFinancePrompt(d.action as FinanceAiAction, snap.text, { question: d.question, locale: d.locale, anomalies: snap.anomalies })
    const result = await runCompletion({ messages: [{ role: 'user', content: userMessage }], systemPrompt, useRag: false, source: `finance-ai:${d.action}` })
    await logAction(auth.user, 'finance.ai.generate', 'gl_journal_entries', '', { action: d.action, provider: result.provider })
    return NextResponse.json({ text: result.reply.trim(), provider: result.provider, anomalies: snap.anomalies, usageId: result.usageId })
  } catch (e) {
    if (e instanceof AiConfigError) return NextResponse.json({ error: 'AI provider is not configured. Set it in AI settings.' }, { status: 400 })
    return apiError(e, 'Finance assistant failed')
  }
}
