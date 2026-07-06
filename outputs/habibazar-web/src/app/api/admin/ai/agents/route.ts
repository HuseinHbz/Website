import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson, badRequest } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { logger } from '@/lib/logger'
import { listAgents, getAgent, buildAgentRun } from '@/lib/ai/agents'
import { runCompletion, AiConfigError } from '@/lib/ai/engine'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — the agent catalog (definitions only; no secrets). RBAC-gated.
export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  // Strip the full system prompt from the list payload — the UI shows metadata +
  // examples; the prompt is an internal implementation detail.
  const agents = listAgents().map(({ systemPrompt: _sp, ...rest }) => rest)
  return NextResponse.json({ agents })
}

const runSchema = z.object({
  agentId: z.string().min(1).max(40),
  task: z.string().min(1).max(8000),
})

// POST — run one agent on a task via the shared AI engine. RBAC-gated + audited.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin('edit')
  if ('error' in auth) return auth.error

  const parsed = await readJson(req, runSchema)
  if ('error' in parsed) return parsed.error
  const { agentId, task } = parsed.data

  const agent = getAgent(agentId)
  if (!agent) return badRequest('Unknown agent')

  try {
    const { systemPrompt, messages } = buildAgentRun(agent, task)
    const { reply, sources, provider } = await runCompletion({ messages, systemPrompt, useRag: agent.useRag })
    await logAction(auth.user, 'ai.agent.run', 'ai_agent', agentId)
    logger.info('AI agent run', { agentId, provider })
    return NextResponse.json({ reply, sources, agentId })
  } catch (e) {
    if (e instanceof AiConfigError) {
      return NextResponse.json({ error: 'AI provider is not configured. Set it in AI Control Center.' }, { status: 503 })
    }
    return apiError(e, 'Agent run failed', 502)
  }
}
