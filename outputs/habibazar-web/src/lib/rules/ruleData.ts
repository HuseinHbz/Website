/**
 * Business Rules server layer — loads a rule set's active version from PostgreSQL
 * and runs it via the pure engine. `runRuleByKey` is the handler seam the Workflow
 * engine uses: a workflow `task` with action `rule` calls it and merges the
 * outputs back into the workflow variables.
 */
import { pgQuery } from '@/lib/db'
import { runRules, type RuleSet, type RuleResult } from './engine'

/** Parse a rule set's currently-active version definition (null if none/inactive). */
export async function loadActiveRule(key: string): Promise<RuleSet | null> {
  const r = (await pgQuery(
    `SELECT v.definition
     FROM business_rules b
     JOIN business_rule_versions v ON v.rule_id = b.id AND v.version = b.active_version
     WHERE b.key = $1 AND b.status = 'active'`, [key]))[0] as { definition: string } | undefined
  if (!r) return null
  try { return JSON.parse(r.definition) as RuleSet } catch { return null }
}

/** Run an active rule set against facts. Returns null when the rule is absent. */
export async function runRuleByKey(key: string, facts: Record<string, unknown>): Promise<RuleResult | null> {
  const set = await loadActiveRule(key)
  if (!set) return null
  return runRules(set, facts)
}
