import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, requirePermission } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import { runCompletion, AiConfigError } from '@/lib/ai/engine'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const schema = z.object({ id: z.number().int().positive(), locale: z.enum(['en', 'fa']).default('en') })

/**
 * AI Approval Assistant (M10) — grounded pre-approval briefing. A deterministic
 * pre-analysis (amount vs previous similar documents, budget signal) is computed
 * from the live DB, then the SHARED AI engine narrates a summary + risk +
 * recommendation. The AI NEVER decides — it advises the human approver.
 */
export async function POST(req: NextRequest) {
  const auth = await requirePermission('erp.approvals', 'write', 'edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const { id, locale } = parsed.data
  try {
    const r = (await pgQuery<{ docType: string; title: string; amount: number; currency: string; department: string | null; refType: string | null; refId: number | null }>(
      `SELECT doc_type AS "docType", title, amount::float AS amount, currency, department, ref_type AS "refType", ref_id AS "refId" FROM approval_requests WHERE id=$1`, [id]))[0]
    if (!r) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    // Deterministic history: average amount of previous approved requests of the same docType.
    const hist = (await pgQuery<{ avg: number; n: number }>(
      `SELECT COALESCE(AVG(amount),0)::float AS avg, COUNT(*)::int AS n FROM approval_requests WHERE doc_type=$1 AND status='approved' AND id<>$2`, [r.docType, id]))[0]
    const avg = Number(hist?.avg ?? 0), n = Number(hist?.n ?? 0)
    const diffPct = avg > 0 ? Math.round((r.amount - avg) / avg * 100) : null
    const snapshot = [
      `Document: ${r.title} (${r.docType})`,
      `Amount: ${r.amount.toLocaleString()} ${r.currency}${r.department ? ` · Department: ${r.department}` : ''}`,
      n > 0 ? `Previous approved ${r.docType} count: ${n}, average amount: ${Math.round(avg).toLocaleString()} ${r.currency}` : `No previous approved ${r.docType} for comparison.`,
      diffPct != null ? `This request is ${diffPct >= 0 ? '+' : ''}${diffPct}% vs the previous average.` : '',
    ].filter(Boolean).join('\n')
    const systemPrompt = [
      'You are the AI Approval Assistant of the HBZ ERP. You brief a human approver BEFORE they decide.',
      `Answer in ${locale === 'fa' ? 'Persian (فارسی)' : 'English'}.`,
      'Use ONLY the snapshot below — never invent figures. Output three short labelled sections: "Summary", "Risk & budget impact", and "Recommendation: Approve / Review / Reject" (a suggestion the human may override).',
      'You NEVER make the decision; you advise only.',
      '--- REQUEST SNAPSHOT (read-only) ---', snapshot, '--- END ---',
    ].join('\n')
    const result = await runCompletion({ messages: [{ role: 'user', content: 'Brief me on this approval.' }], systemPrompt, useRag: false, source: 'approval-ai' })
    await logAction(auth.user, 'approval.ai.brief', 'approval_requests', id, null, { provider: result.provider })
    return NextResponse.json({ text: result.reply.trim(), provider: result.provider, analysis: { avg: Math.round(avg), count: n, diffPct } })
  } catch (e) {
    if (e instanceof AiConfigError) return NextResponse.json({ error: 'AI provider is not configured.' }, { status: 400 })
    return apiError(e, 'Approval assistant failed')
  }
}
