import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson, badRequest } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import { logBus } from '@/lib/logs/bus'
import { executeWorkflow, type WorkflowDefinition, type TaskHandler } from '@/lib/workflow/engine'

// Execute a workflow (POST) or list its run history (GET ?workflowId=). Runs are
// recorded in workflow_runs. Task nodes dispatch to a small set of SAFE, built-in
// handlers; external side-effecting actions (email/webhook/http) are recorded as
// intents rather than performed, until an operator wires a real integration —
// honest by default, no silent external calls.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Built-in, side-effect-safe task handlers. */
const handlers: Record<string, TaskHandler> = {
  // Emits into the real-time log stream / system_logs.
  notify: (_a, config) => {
    logBus.publish({ level: 'info', source: 'system', service: 'workflow', message: `workflow.notify: ${String(config.message ?? '')}` })
    return { delivered: true }
  },
  log: (_a, config, ctx) => { ctx.log.push({ ts: ctx.log.length, node: 'task', type: 'task', message: String(config.message ?? ''), level: 'info' }); return true },
  // External actions are recorded as intents (not executed) until wired.
  email: (_a, config) => ({ intent: 'email', to: config.to ?? null, executed: false }),
  webhook: (_a, config) => ({ intent: 'webhook', url: config.url ?? null, executed: false }),
  http: (_a, config) => ({ intent: 'http', url: config.url ?? null, executed: false }),
}

const runSchema = z.object({
  id: z.number().int().positive(),
  input: z.record(z.unknown()).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin('edit')
    if ('error' in auth) return auth.error
    const parsed = await readJson(req, runSchema)
    if ('error' in parsed) return parsed.error
    const { id, input } = parsed.data

    const wf = (await pgQuery(`SELECT id, key, definition, status FROM workflows WHERE id=$1`, [id]))[0] as
      | { id: number; key: string; definition: string; status: string }
      | undefined
    if (!wf) return badRequest('workflow not found')

    let def: WorkflowDefinition
    try { def = JSON.parse(wf.definition) } catch { return badRequest('workflow definition is corrupt') }

    const result = await executeWorkflow(def, input ?? {}, { handlers })

    const row = (await pgQuery(
      `INSERT INTO workflow_runs (workflow_id, status, trigger, input, variables, log, error, steps, waiting_node, run_by, finished_at)
       VALUES ($1,$2,'manual',$3,$4,$5,$6,$7,$8,$9, to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) RETURNING id`,
      [id, result.status, JSON.stringify(input ?? {}), JSON.stringify(result.variables), JSON.stringify(result.log),
        result.error ?? null, result.steps, result.waitingNode ?? null, auth.user.id],
    ))[0] as { id: number }

    await logAction(auth.user, 'RUN', 'workflows', id, null, { runId: row.id, status: result.status, steps: result.steps })
    logBus.publish({ level: result.status === 'failed' ? 'warn' : 'info', source: 'system', service: 'workflow', message: `workflow "${wf.key}" run ${result.status} (${result.steps} steps)` })
    return NextResponse.json({ runId: row.id, ...result })
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin()
    if ('error' in auth) return auth.error
    const workflowId = Number(req.nextUrl.searchParams.get('workflowId'))
    if (!workflowId) return badRequest('workflowId required')
    const runs = await pgQuery(
      `SELECT id, status, trigger, steps, waiting_node AS "waitingNode", error,
              started_at AS "startedAt", finished_at AS "finishedAt", log, variables
       FROM workflow_runs WHERE workflow_id=$1 ORDER BY id DESC LIMIT 50`,
      [workflowId],
    )
    return NextResponse.json({ runs })
  } catch (e: unknown) {
    return apiError(e)
  }
}
