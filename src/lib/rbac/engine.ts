/**
 * Phase 26.27 بند ۲ — pure tree-decision engine. No I/O; fully unit-tested.
 *
 * Tree rules (بند ۲):
 *  🌳 inheritance: a node without an explicit value takes its parent's value
 *  🚫 deny dominates: an explicit `none` ANYWHERE on the chain kills the whole
 *     subtree — even a more specific `write` below it (بند ۷: none on the module
 *     → every tab 403 even if a tab had write)
 *  🎯 otherwise the most specific explicit value wins (tab > module > workspace)
 *  ↩️ no explicit value anywhere → `null` = fall back to the legacy role
 *     behaviour EXACTLY (R5 absolute backward compatibility)
 *
 * Sensitive ops: `write` NEVER implies an op. An op is allowed only with an
 * explicit rbac_user_ops grant; with no op rows at all the legacy behaviour
 * applies (R5).
 */

export type PermLevel = 'none' | 'read' | 'write'
export type Grants = Record<string, PermLevel>          // permission_key → level
export type OpGrants = Record<string, boolean>          // "module:op" → allowed

/** ancestry chain for a dotted key, most specific first: a.b.c → [a.b.c, a.b, a] */
export function chainOf(key: string): string[] {
  const parts = key.split('.')
  const out: string[] = []
  for (let i = parts.length; i >= 1; i--) out.push(parts.slice(0, i).join('.'))
  return out
}

export function levelSatisfies(actual: PermLevel, required: 'read' | 'write'): boolean {
  if (actual === 'none') return false
  if (required === 'read') return true
  return actual === 'write'
}

/**
 * Effective level of `key` under explicit `grants`.
 * Returns null when NO node on the chain has an explicit grant (→ legacy, R5).
 */
export function effectiveLevel(grants: Grants, key: string): PermLevel | null {
  const chain = chainOf(key)
  // deny dominates: explicit none anywhere on the chain wins over everything
  for (const k of chain) if (grants[k] === 'none') return 'none'
  // otherwise most specific explicit value
  for (const k of chain) { const v = grants[k]; if (v !== undefined) return v }
  return null
}

/** Where an effective level came from — for the UI's inherited/explicit rendering. */
export function levelProvenance(grants: Grants, key: string): { level: PermLevel | null; source: string | null; explicit: boolean } {
  const chain = chainOf(key)
  for (const k of chain) if (grants[k] === 'none') return { level: 'none', source: k, explicit: k === key }
  for (const k of chain) { const v = grants[k]; if (v !== undefined) return { level: v, source: k, explicit: k === key } }
  return { level: null, source: null, explicit: false }
}

/**
 * Sensitive-op decision. opKey = "module.key:op".
 *  - module subtree effectively `none` → false (deny dominates the op too)
 *  - explicit op row → its boolean
 *  - no op row → null (legacy behaviour decides — R5; write does NOT imply)
 */
export function isOpAllowed(ops: OpGrants, grants: Grants, opKey: string): boolean | null {
  const mod = opKey.slice(0, opKey.lastIndexOf(':'))
  if (effectiveLevel(grants, mod) === 'none') return false
  const explicit = ops[opKey]
  if (explicit !== undefined) return explicit
  return null
}

export interface ResolvedNode {
  key: string
  level: PermLevel | null
  source: string | null      // key the level was inherited from (null = role default)
  explicit: boolean
}

/** Resolve the whole tree for the UI: every key with level + provenance. */
export function resolveTree(grants: Grants, keys: string[]): ResolvedNode[] {
  return keys.map(key => {
    const p = levelProvenance(grants, key)
    return { key, level: p.level, source: p.source, explicit: p.explicit }
  })
}

/** Validate a grants patch: keys must exist (checked by caller against registry), levels sane. */
export function validLevel(v: unknown): v is PermLevel {
  return v === 'none' || v === 'read' || v === 'write'
}
