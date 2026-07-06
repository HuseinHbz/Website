/**
 * Business Rules Engine — pure core (Phase 21.7).
 *
 * A deterministic decision engine: a rule set evaluates its rules (by priority)
 * against a facts object and produces outputs. Covers discount / tax / validation
 * / approval / inventory / pricing / financial rules through one generic model —
 * the category is just metadata. No I/O → fully unit-tested. Composes with the
 * Workflow engine through its task/condition handler seam (rules run as handlers).
 */

export const RULE_OPS = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'contains', 'between', 'truthy', 'falsy'] as const
export type RuleOp = (typeof RULE_OPS)[number]

export interface Condition { field: string; op: RuleOp; value?: unknown }
export interface Rule {
  id: string
  label?: string
  priority?: number
  match?: 'all' | 'any'          // how the conditions combine (default all)
  conditions: Condition[]
  outputs: Record<string, unknown>
  stop?: boolean                 // stop evaluating further rules after this matches
}
export interface RuleSet {
  mode?: 'first' | 'collect'     // first-match stops; collect merges every match
  rules: Rule[]
}

export interface RuleTrace { ruleId: string; matched: boolean }
export interface RuleResult {
  matched: string[]
  outputs: Record<string, unknown>
  trace: RuleTrace[]
}

/** Read a possibly dotted path out of the facts object. */
function get(facts: Record<string, unknown>, path: string): unknown {
  if (!path) return undefined
  return path.split('.').reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined), facts)
}

function num(v: unknown): number { return typeof v === 'number' ? v : Number(v) }

/** Evaluate one condition against the facts. */
export function evalCondition(c: Condition, facts: Record<string, unknown>): boolean {
  const left = get(facts, c.field)
  const right = c.value
  switch (c.op) {
    case 'eq': return left === right
    case 'ne': return left !== right
    case 'gt': return num(left) > num(right)
    case 'gte': return num(left) >= num(right)
    case 'lt': return num(left) < num(right)
    case 'lte': return num(left) <= num(right)
    case 'in': return Array.isArray(right) && right.includes(left as never)
    case 'nin': return Array.isArray(right) && !right.includes(left as never)
    case 'contains':
      if (Array.isArray(left)) return left.includes(right as never)
      return typeof left === 'string' && left.includes(String(right))
    case 'between': {
      if (!Array.isArray(right) || right.length < 2) return false
      const n = num(left); return n >= num(right[0]) && n <= num(right[1])
    }
    case 'truthy': return Boolean(left)
    case 'falsy': return !left
    default: return false
  }
}

/** Does a rule match? (conditions combined by match mode; empty = always). */
export function ruleMatches(rule: Rule, facts: Record<string, unknown>): boolean {
  if (!rule.conditions || rule.conditions.length === 0) return true
  const results = rule.conditions.map(c => evalCondition(c, facts))
  return rule.match === 'any' ? results.some(Boolean) : results.every(Boolean)
}

/**
 * Run a rule set. Rules are evaluated highest-priority first (stable for ties).
 * mode 'first' returns the first match's outputs; 'collect' merges every match
 * (later matches override earlier keys). `stop` on a rule ends evaluation.
 */
export function runRules(set: RuleSet, facts: Record<string, unknown>): RuleResult {
  const ordered = [...(set.rules ?? [])]
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (b.r.priority ?? 0) - (a.r.priority ?? 0) || a.i - b.i)
    .map(x => x.r)

  const matched: string[] = []
  const trace: RuleTrace[] = []
  let outputs: Record<string, unknown> = {}
  const mode = set.mode ?? 'first'

  for (const rule of ordered) {
    const ok = ruleMatches(rule, facts)
    trace.push({ ruleId: rule.id, matched: ok })
    if (!ok) continue
    matched.push(rule.id)
    outputs = { ...outputs, ...rule.outputs }
    if (mode === 'first' || rule.stop) break
  }
  return { matched, outputs, trace }
}

/** Structural validation of a rule set (used before persisting / running). */
export function validateRuleSet(set: RuleSet): { valid: boolean; error?: string } {
  if (!set || !Array.isArray(set.rules)) return { valid: false, error: 'rules[] required' }
  const ids = new Set<string>()
  for (const r of set.rules) {
    if (!r.id) return { valid: false, error: 'every rule needs an id' }
    if (ids.has(r.id)) return { valid: false, error: `duplicate rule id: ${r.id}` }
    ids.add(r.id)
    if (!Array.isArray(r.conditions)) return { valid: false, error: `rule ${r.id}: conditions[] required` }
    for (const c of r.conditions) {
      if (!c.field || !(RULE_OPS as readonly string[]).includes(c.op)) return { valid: false, error: `rule ${r.id}: bad condition` }
    }
    if (!r.outputs || typeof r.outputs !== 'object') return { valid: false, error: `rule ${r.id}: outputs required` }
  }
  return { valid: true }
}
