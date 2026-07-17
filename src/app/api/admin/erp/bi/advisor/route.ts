import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import { runCompletion, AiConfigError } from '@/lib/ai/engine'
import { assembleKpis, metricSeries } from '@/lib/erp/financialIntelligenceData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const schema = z.object({ question: z.string().min(2).max(2000), locale: z.enum(['en', 'fa']).default('en') })

/**
 * AI Business Advisor (M8) — the CEO assistant. Reuses the SHARED AI engine
 * (`runCompletion`); a deterministic cross-module snapshot (GL/sales/purchase/
 * inventory/projects/AR) is assembled from the live books, then the LLM performs
 * root-cause analysis + recommendations. NEVER modifies data — analysis only.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin('edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const { question, locale } = parsed.data
  try {
    const { kpis } = await assembleKpis()
    const [rev, exp, prof] = await Promise.all([metricSeries('revenue'), metricSeries('expense'), metricSeries('profit')])
    const delta = (s: { period: string; value: number }[]) => s.length >= 2 ? `${s[s.length - 1].period}: ${s[s.length - 1].value} (Δ ${Math.round((s[s.length - 1].value - s[s.length - 2].value) * 100) / 100} vs ${s[s.length - 2].period})` : 'insufficient history'
    const topDebtors = await pgQuery<{ name: string; due: number }>(
      `SELECT COALESCE(c.name,'?') AS name, SUM(d.total-d.paid_total)::float AS due FROM sales_documents d LEFT JOIN sales_customers c ON c.id=d.customer_id WHERE d.doc_type='invoice' AND d.status IN ('sent','confirmed','partial') GROUP BY c.name ORDER BY due DESC LIMIT 3`).catch(() => [])
    const invTurn = kpis.inventory.turnover
    const snapshot = [
      `Revenue (monthly) ${kpis.revenue.monthly} | growth ${kpis.revenue.growthRatePct}%`,
      `Gross profit ${kpis.profit.gross} (${kpis.profit.grossMarginPct}%) | Net profit ${kpis.profit.net} (${kpis.profit.netMarginPct}%)`,
      `Cash ${kpis.cash.position} | AR ${kpis.receivable.outstanding} | AP ${kpis.payable.outstanding} | Inventory ${kpis.inventory.value}`,
      `MoM revenue → ${delta(rev)}`,
      `MoM expense → ${delta(exp)}`,
      `MoM profit → ${delta(prof)}`,
      `Top overdue customers: ${topDebtors.map(d => `${d.name} ${Math.round(d.due).toLocaleString()}`).join(', ') || 'none'}`,
      `Inventory turnover: ${invTurn ?? 'n/a'}`,
    ].join('\n')
    const systemPrompt = [
      'You are the AI Business Advisor (CEO assistant) of the HBZ ERP. You analyze the whole business.',
      `Answer in ${locale === 'fa' ? 'Persian (فارسی)' : 'English'}.`,
      'Use ONLY the live snapshot below across GL, sales, purchases, inventory and receivables — never invent figures.',
      'Structure the answer: a one-line headline finding, then "Main reasons" as a numbered list citing the numbers, then "Recommendations".',
      'You NEVER modify data — you only analyze and recommend.',
      '--- LIVE BUSINESS SNAPSHOT (read-only) ---', snapshot, '--- END ---',
    ].join('\n')
    const result = await runCompletion({ messages: [{ role: 'user', content: question }], systemPrompt, useRag: true, source: 'bi-advisor' })
    await logAction(auth.user, 'bi.advisor.query', 'business_intelligence', '', null, { provider: result.provider })
    return NextResponse.json({ text: result.reply.trim(), provider: result.provider })
  } catch (e) {
    if (e instanceof AiConfigError) return NextResponse.json({ error: 'AI provider is not configured.' }, { status: 400 })
    return apiError(e, 'Business advisor failed')
  }
}
