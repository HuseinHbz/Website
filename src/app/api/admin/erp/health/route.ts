import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, badRequest, requirePermission } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { clientIp } from '@/lib/api/clientIp'
import { healthOverview } from '@/lib/health/healthData'
import { runSelfHeal, HEAL_CHECKS } from '@/lib/health/selfhealData'
import { buildHealthPrompt, type HealthAiAction } from '@/lib/health/selfheal'
import { runCompletion, AiConfigError } from '@/lib/ai/engine'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — Operational Health Center (Phase 26.20): consolidated ERP/business/
// financial/security/performance/workflow/data-quality health + risk score,
// plus the last self-heal run. Read-only.
export async function GET(req: NextRequest) {
  const auth = await requirePermission('operations.health', 'read')
  if ('error' in auth) return auth.error
  try {
    const view = req.nextUrl.searchParams.get('view')
    if (view === 'checks') return NextResponse.json({ checks: HEAL_CHECKS })
    return NextResponse.json({ overview: await healthOverview() })
  } catch (e) { return apiError(e, 'Failed to load operational health') }
}

const runSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('selfheal') }),
  z.object({
    action: z.literal('advise'),
    kind: z.enum(['root_cause', 'recommend', 'risk', 'forecast', 'optimize', 'workflow']),
    question: z.string().max(2000).optional(),
    locale: z.enum(['en', 'fa']).default('en'),
  }),
])

/** Compact read-only snapshot for grounding the AI Operational Advisor. */
async function healthSnapshot(): Promise<string> {
  const ov = await healthOverview()
  const lines = [
    `Overall ERP health ${ov.overall}/100 (${ov.grade}) · risk score ${ov.risk}/100`,
    `Components: ` + ov.components.map(c => `${c.en} ${c.score} (${c.grade}; ${c.detailEn})`).join(' | '),
    `Open alerts: financial ${ov.alerts.financialOpen}, business ${ov.alerts.businessOpen}`,
    `Automation (24h): ${ov.automation.workflows24h} runs, ${ov.automation.failed24h} failed, ${ov.automation.waiting} waiting`,
    `Integrations: ${ov.integrations.deadLetter} dead-letter, ${ov.integrations.dispatches24h} dispatches (24h)`,
    ov.selfheal.run
      ? `Last self-heal run #${ov.selfheal.run.id} (${ov.selfheal.run.createdAt}): ${ov.selfheal.run.issues} issue(s), ${ov.selfheal.run.fixed} auto-fixed. Findings: `
        + (ov.selfheal.findings.map(f => `${f.code}[${f.severity}] found ${f.count}, fixed ${f.fixed} → ${f.action} (${f.detail})`).join('; ') || 'none')
      : 'No self-heal run recorded yet.',
  ]
  return lines.join('\n')
}

// POST — selfheal: execute a run (detect → auto-fix safe issues → record trail;
// auto-fixes reuse each module's own idempotent ops; administrator-gated).
// advise: AI Operational Advisor through the SHARED runCompletion (advisory only).
export async function POST(req: NextRequest) {
  const auth = await requirePermission('operations.health', 'write', 'edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, runSchema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    if (d.action === 'selfheal') {
      if (!['administrator', 'super_admin'].includes(auth.user.role)) return badRequest('Only administrators can run self-healing')
      const res = await runSelfHeal(auth.user.id)
      await logAction(auth.user, 'health.selfheal.run', 'selfheal_run', res.runId, null,
        { issues: res.totalIssues, fixed: res.totalFixed, risk: res.risk }, clientIp(req))
      return NextResponse.json({ ok: true, result: res })
    }
    const snapshot = await healthSnapshot()
    const { systemPrompt, userMessage } = buildHealthPrompt(d.kind as HealthAiAction, snapshot, { question: d.question, locale: d.locale })
    const result = await runCompletion({ messages: [{ role: 'user', content: userMessage }], systemPrompt, useRag: false, source: `health-ai:${d.kind}` })
    await logAction(auth.user, 'health.ai.advise', 'selfheal_run', '', { kind: d.kind, provider: result.provider })
    return NextResponse.json({ text: result.reply.trim(), provider: result.provider, usageId: result.usageId })
  } catch (e) {
    if (e instanceof AiConfigError) return NextResponse.json({ error: 'AI provider is not configured. Set it in AI settings.' }, { status: 400 })
    return apiError(e, 'Operational health action failed')
  }
}
