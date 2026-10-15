/**
 * Chart-of-Accounts Import engine (Phase 18 — statutory coding workbook).
 * Pure, deterministic tree-building + live-diff logic; no DB access here.
 *
 * Source data (`coa_import_nodes`, seeded in migrate.ts) holds 3 business-
 * type variants of the full Iranian statutory chart of accounts (service/
 * production/trading), each a 3-level tree: group (G<digit>) → control
 * (C<digit>_<code>) → detail (the real 4-digit account code the ERP posts
 * against). Detail codes carry a DIFFERENT meaning per variant, so an
 * operator imports exactly ONE variant into their live `gl_accounts` — this
 * module only builds the plan and diffs it against what already exists;
 * `coaImportData.ts` is the one place that actually writes to the DB.
 */

export type CoaLevel = 'group' | 'control' | 'detail'

export interface CoaTemplateNode {
  level: CoaLevel
  code: string
  parentCode: string | null
  nameEn: string | null
  nameFa: string
  accountType: string
  sortOrder: number
}

export interface CoaPlanNode extends CoaTemplateNode {
  /** Whether `code` already exists live in gl_accounts. */
  exists: boolean
}

/** Orders nodes parent-before-child so a straight top-to-bottom insert loop
 * always has its parent already committed (groups, then controls, then
 * details — the shape the source data is already seeded in, re-sorted
 * defensively rather than trusted blindly). */
export function orderForImport(nodes: CoaTemplateNode[]): CoaTemplateNode[] {
  const rank: Record<CoaLevel, number> = { group: 0, control: 1, detail: 2 }
  return [...nodes].sort((a, b) => rank[a.level] - rank[b.level] || a.sortOrder - b.sortOrder)
}

/** Marks each node as already-live or new, against a live set of codes.
 * Never decides what to DO about a conflict — that's the caller's policy
 * (additive-only: existing codes are always skipped, never overwritten). */
export function diffAgainstLive(nodes: CoaTemplateNode[], liveCodes: Set<string>): CoaPlanNode[] {
  return orderForImport(nodes).map(n => ({ ...n, exists: liveCodes.has(n.code) }))
}

export interface CoaImportSummary {
  totalNodes: number
  toCreate: number
  alreadyExists: number
  byType: Record<string, number>
}

export function summarizePlan(plan: CoaPlanNode[]): CoaImportSummary {
  const byType: Record<string, number> = {}
  let toCreate = 0
  for (const n of plan) {
    if (!n.exists) {
      toCreate++
      byType[n.accountType] = (byType[n.accountType] ?? 0) + 1
    }
  }
  return { totalNodes: plan.length, toCreate, alreadyExists: plan.length - toCreate, byType }
}
