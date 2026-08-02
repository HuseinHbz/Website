import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, requirePermission } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { summarize, type UsageRow } from '@/lib/ai/analytics'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — AI usage analytics summary (real telemetry from ai_usage).
export async function GET(req: NextRequest) {
  const auth = await requirePermission('ai.ai-agents', 'read')
  if ('error' in auth) return auth.error
  try {
    const days = Math.min(90, Math.max(1, Number(req.nextUrl.searchParams.get('days')) || 30))
    const rows = (await pgQuery(
      `SELECT id, ts, provider, model, source, latency_ms AS "latencyMs", success, error,
              input_tokens AS "inputTokens", output_tokens AS "outputTokens",
              rag_sources AS "ragSources", feedback
       FROM ai_usage
       WHERE ts >= to_char(now() - ($1 || ' days')::interval, 'YYYY-MM-DD HH24:MI:SS')
       ORDER BY ts DESC LIMIT 5000`,
      [String(days)],
    )) as unknown as UsageRow[]

    // Optional cost estimate rate ($/1k tokens), configured in site_settings.
    const costRow = (await pgQuery(`SELECT value FROM site_settings WHERE key = 'ai_cost_per_1k'`, [])) as { value: string }[]
    const costPer1k = Number(costRow[0]?.value) || 0

    return NextResponse.json({ summary: summarize(rows, { days, costPer1k }), days })
  } catch (e) {
    return apiError(e, 'Failed to load AI analytics')
  }
}

const feedbackSchema = z.object({
  usageId: z.number().int().positive(),
  value: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
})

// POST — thumbs up/down feedback on a specific AI response.
export async function POST(req: NextRequest) {
  const auth = await requirePermission('ai.ai-agents', 'write')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, feedbackSchema)
  if ('error' in parsed) return parsed.error
  try {
    await pgQuery(`UPDATE ai_usage SET feedback = $1 WHERE id = $2`, [parsed.data.value, parsed.data.usageId])
    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e, 'Failed to record feedback')
  }
}
