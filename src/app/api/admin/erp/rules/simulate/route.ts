import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, badRequest, requirePermission } from '@/lib/api/respond'
import { runRules, validateRuleSet, type RuleSet } from '@/lib/rules/engine'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const schema = z.object({
  definition: z.string().min(2).max(40000),
  facts: z.record(z.string(), z.unknown()).default({}),
})

// POST — simulate/test a rule set against sample facts (returns matches + trace).
export async function POST(req: NextRequest) {
  const auth = await requirePermission('erp.rules', 'write')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  let def: RuleSet
  try { def = JSON.parse(parsed.data.definition) } catch { return badRequest('definition is not valid JSON') }
  const v = validateRuleSet(def)
  if (!v.valid) return badRequest(v.error ?? 'invalid rule set')
  try {
    return NextResponse.json({ result: runRules(def, parsed.data.facts) })
  } catch (e) { return apiError(e, 'Simulation failed') }
}
