import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, requirePermission } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { runCompletion, AiConfigError } from '@/lib/ai/engine'
import { treasuryOverview } from '@/lib/treasury/analyticsData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const schema = z.object({ question: z.string().min(2).max(2000), locale: z.enum(['en', 'fa']).default('en') })

/**
 * AI Treasury Assistant (M10) — reuses the SHARED AI engine (`runCompletion`). A
 * deterministic treasury snapshot (cash position, due payments, receivables,
 * liquidity buckets, FX risk) is assembled from the live books, then the LLM
 * gives a risk level + explanation + recommendation. NEVER modifies transactions.
 */
export async function POST(req: NextRequest) {
  const auth = await requirePermission('erp.treasury', 'write', 'edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const { question, locale } = parsed.data
  try {
    const ov = await treasuryOverview()
    const b30 = ov.liquidity.buckets.find(b => b.days === 30)
    const snapshot = [
      `Cash available ${ov.cash.available} | projected ${ov.cash.projected}`,
      `Pending receipts ${ov.cash.pendingReceipts} | pending payments ${ov.cash.pendingPayments}`,
      `Liquidity 30d: inflow ${b30?.inflow ?? 0}, outflow ${b30?.outflow ?? 0}, expected balance ${b30?.expectedBalance ?? 0} (risk: ${ov.liquidity.risk})`,
      `FX risk level: ${ov.risk.level}, unrealized FX ${ov.risk.totalUnrealized}`,
      `Open cheques ${ov.openCheques} | pending payment orders ${ov.pendingPayments} | unreconciled lines ${ov.unmatched}`,
    ].join('\n')
    const systemPrompt = [
      'You are the AI Treasury Assistant of the HBZ ERP. You advise on cash, payments and liquidity.',
      `Answer in ${locale === 'fa' ? 'Persian (فارسی)' : 'English'}.`,
      'Use ONLY the live snapshot below — never invent figures. Structure: a "Risk level" line (Low/Medium/High), an "Explanation" citing the numbers, and a "Recommendation".',
      'You NEVER modify transactions — analysis and suggestion only.',
      '--- LIVE TREASURY SNAPSHOT (read-only) ---', snapshot, '--- END ---',
    ].join('\n')
    const result = await runCompletion({ messages: [{ role: 'user', content: question }], systemPrompt, useRag: false, source: 'treasury-ai' })
    await logAction(auth.user, 'treasury.ai.query', 'payment_orders', '', null, { provider: result.provider })
    return NextResponse.json({ text: result.reply.trim(), provider: result.provider })
  } catch (e) {
    if (e instanceof AiConfigError) return NextResponse.json({ error: 'AI provider is not configured.' }, { status: 400 })
    return apiError(e, 'Treasury assistant failed')
  }
}
