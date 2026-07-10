import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import { runCompletion, AiConfigError } from '@/lib/ai/engine'
import { financeOverview } from '@/lib/erp/ledgerData'
import { scanAnomalies, buildFinancePrompt, type EntryFact, type FinanceAiAction } from '@/lib/erp/financeAi'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Compact, read-only snapshot of the live books for grounding the LLM. */
async function financeSnapshot(): Promise<{ text: string; anomalies: ReturnType<typeof scanAnomalies> }> {
  const ov = await financeOverview()
  const payables = Number((await pgQuery<{ t: number }>(`SELECT COALESCE(SUM(total-paid_total),0)::float AS t FROM purchase_documents WHERE doc_type='invoice' AND status IN ('confirmed','partial')`))[0]?.t ?? 0)
  const receivables = Number((await pgQuery<{ t: number }>(`SELECT COALESCE(SUM(total-paid_total),0)::float AS t FROM sales_documents WHERE doc_type='invoice' AND status IN ('sent','confirmed','partial')`))[0]?.t ?? 0)
  const entries = await pgQuery<{ id: number; date: string; total: number; memo: string | null }>(
    `SELECT id, date, total::float AS total, memo FROM gl_journal_entries WHERE status='posted' ORDER BY date DESC LIMIT 200`)
  const anomalies = scanAnomalies(entries as EntryFact[])
  const k = ov.kpis
  const text = [
    `Assets ${k.totalAssets} | Liabilities ${k.totalLiabilities} | Equity ${k.totalEquity} | Cash ${k.cash}`,
    `Revenue ${k.revenue} | Expenses ${k.expenses} | Net income ${k.netIncome}`,
    `Open receivables ${receivables} | Open payables ${payables}`,
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
