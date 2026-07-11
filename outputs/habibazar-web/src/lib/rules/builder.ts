/**
 * Rule-builder pure helpers (Phase 26.10) — parse a rule-set JSON into an
 * editable model and serialize it back to engine-valid JSON. Kept out of the
 * client component so it is unit-testable without JSX.
 */
export const RULE_OPS_UI = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'contains', 'between', 'truthy', 'falsy'] as const
export interface Cond { field: string; op: string; value: string }
export interface RuleNode { id: string; priority: number; match: 'all' | 'any'; conditions: Cond[]; outputs: { k: string; v: string }[] }

export function parseDef(json: string): { mode: string; rules: RuleNode[] } | null {
  try {
    const d = JSON.parse(json)
    if (!Array.isArray(d.rules)) return null
    return {
      mode: d.mode === 'collect' ? 'collect' : 'first',
      rules: d.rules.map((r: Record<string, unknown>, i: number) => ({
        id: String(r.id ?? `rule-${i + 1}`),
        priority: Number(r.priority ?? 0),
        match: r.match === 'any' ? 'any' as const : 'all' as const,
        conditions: Array.isArray(r.conditions) ? (r.conditions as Record<string, unknown>[]).map(c => ({ field: String(c.field ?? ''), op: String(c.op ?? 'eq'), value: c.value === undefined ? '' : (typeof c.value === 'object' ? JSON.stringify(c.value) : String(c.value)) })) : [],
        outputs: r.outputs && typeof r.outputs === 'object' ? Object.entries(r.outputs as Record<string, unknown>).map(([k, v]) => ({ k, v: typeof v === 'object' ? JSON.stringify(v) : String(v) })) : [],
      })),
    }
  } catch { return null }
}

/** Coerce a string value to number/boolean/JSON where it clearly is one. */
export function coerce(v: string): unknown {
  const t = v.trim()
  if (t === '') return ''
  if (t === 'true') return true
  if (t === 'false') return false
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t)
  if ((t.startsWith('[') && t.endsWith(']')) || (t.startsWith('{') && t.endsWith('}'))) { try { return JSON.parse(t) } catch { return v } }
  return v
}

export function serializeDef(model: { mode: string; rules: RuleNode[] }): string {
  return JSON.stringify({
    mode: model.mode,
    rules: model.rules.map(r => ({
      id: r.id, priority: r.priority, match: r.match,
      conditions: r.conditions.filter(c => c.field.trim()).map(c => (c.op === 'truthy' || c.op === 'falsy') ? { field: c.field, op: c.op } : { field: c.field, op: c.op, value: coerce(c.value) }),
      outputs: Object.fromEntries(r.outputs.filter(o => o.k.trim()).map(o => [o.k, coerce(o.v)])),
    })),
  }, null, 2)
}
