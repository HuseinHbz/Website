/**
 * Master-Data Governance — pure engine (Phase 26.16). Deterministic, no DB, so
 * fully unit-tested and reused by the data layer + reports. Covers three things
 * BI's generic data-quality checks (26.13) do NOT: per-domain completeness
 * scoring, per-record duplicate GROUPS by identity key, and cross-module
 * relation-integrity classification.
 */

export type Grade = 'excellent' | 'good' | 'fair' | 'poor'
export type Severity = 'error' | 'warning' | 'recommendation'

/** Percentage of `present` out of `total` (0..100). An empty set is a clean 100. */
export function scorePct(present: number, total: number): number {
  if (total <= 0) return 100
  return Math.round(Math.max(0, Math.min(present, total)) / total * 100)
}

export function grade(pct: number): Grade {
  if (pct >= 95) return 'excellent'
  if (pct >= 85) return 'good'
  if (pct >= 70) return 'fair'
  return 'poor'
}

export interface FieldCoverage { key: string; en: string; fa: string; present: number; total: number }
export interface DomainQuality {
  domain: string
  total: number
  score: number
  grade: Grade
  fields: (FieldCoverage & { pct: number; missing: number })[]
}

/**
 * Roll a domain's per-field coverage into an overall completeness score. Each
 * required field is weighted equally: score = mean(field pct). A domain with no
 * records is a clean 100 (nothing to complete).
 */
export function domainQuality(domain: string, total: number, fields: FieldCoverage[]): DomainQuality {
  const rows = fields.map(f => ({ ...f, pct: scorePct(f.present, f.total), missing: Math.max(0, f.total - f.present) }))
  const score = rows.length === 0 ? 100 : Math.round(rows.reduce((s, f) => s + f.pct, 0) / rows.length)
  return { domain, total, score, grade: grade(score), fields: rows }
}

/** Average of several domain scores → the master-data governance score. */
export function overallScore(domains: { score: number }[]): number {
  if (domains.length === 0) return 100
  return Math.round(domains.reduce((s, d) => s + d.score, 0) / domains.length)
}

// ── Duplicate detection ──────────────────────────────────────────────────────
export interface DuplicateMember { id: number; label: string }
export interface DuplicateGroup { keyType: string; value: string; members: DuplicateMember[] }

/** Normalise an identity value for comparison (trim + lowercase + collapse). */
export function normalizeKey(v: string | null | undefined): string {
  return (v ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Group records that share a non-empty identity key. Only groups with ≥2 members
 * are returned (a duplicate). Pure: the caller supplies the key + label mappers.
 */
export function duplicateGroups<T>(rows: T[], keyType: string, keyOf: (r: T) => string | null | undefined, idOf: (r: T) => number, labelOf: (r: T) => string): DuplicateGroup[] {
  const byKey = new Map<string, DuplicateMember[]>()
  for (const r of rows) {
    const k = normalizeKey(keyOf(r))
    if (!k) continue
    const arr = byKey.get(k) ?? []
    arr.push({ id: idOf(r), label: labelOf(r) })
    byKey.set(k, arr)
  }
  const groups: DuplicateGroup[] = []
  for (const [value, members] of byKey) if (members.length > 1) groups.push({ keyType, value, members })
  return groups
}

/** Total number of *redundant* records across duplicate groups (Σ members−1). */
export function duplicateBurden(groups: DuplicateGroup[]): number {
  return groups.reduce((s, g) => s + (g.members.length - 1), 0)
}

// ── Relation integrity ───────────────────────────────────────────────────────
export interface IntegrityIssue {
  code: string
  severity: Severity
  en: string
  fa: string
  count: number
}

const SEV_RANK: Record<Severity, number> = { error: 3, warning: 2, recommendation: 1 }

export interface IntegritySummary {
  issues: IntegrityIssue[]
  errors: number
  warnings: number
  recommendations: number
  totalAffected: number
  score: number // 100 = no integrity problems
}

// ── Data-quality dimensions (Phase 26.17 M7) ─────────────────────────────────
// Extends the 26.16 completeness engine with the classic MDM quality dimensions.
export type QualityDimension = 'completeness' | 'consistency' | 'uniqueness' | 'validity' | 'relationship'

export interface DimensionScore { dimension: QualityDimension; score: number; issues: number }

const DIM_WEIGHT: Record<QualityDimension, number> = {
  completeness: 0.30, validity: 0.25, uniqueness: 0.20, consistency: 0.15, relationship: 0.10,
}

/** Weighted roll-up of the five dimensions into one 0..100 data-quality score. */
export function dimensionRollup(dims: DimensionScore[]): number {
  if (dims.length === 0) return 100
  let wsum = 0
  let acc = 0
  for (const d of dims) { const w = DIM_WEIGHT[d.dimension]; wsum += w; acc += d.score * w }
  return wsum === 0 ? 100 : Math.round(acc / wsum)
}

// Pure validity checkers (Iranian formats + generic).
export function isValidEmail(v: string | null | undefined): boolean {
  if (!v) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}
/** Iranian national ID: 10 digits with the official check-digit algorithm. */
export function isValidIranNationalId(v: string | null | undefined): boolean {
  if (!v) return false
  const s = v.trim()
  if (!/^\d{10}$/.test(s)) return false
  if (/^(\d)\1{9}$/.test(s)) return false
  const check = Number(s[9])
  let sum = 0
  for (let i = 0; i < 9; i++) sum += Number(s[i]) * (10 - i)
  const r = sum % 11
  return (r < 2 && check === r) || (r >= 2 && check === 11 - r)
}
/** Economic code: 11–14 digits (Iranian تعریف). */
export function isValidEconomicCode(v: string | null | undefined): boolean {
  if (!v) return false
  return /^\d{11,14}$/.test(v.trim())
}

/** Roll integrity findings (each carrying an affected-row `count`) into a summary. */
export function integritySummary(issues: IntegrityIssue[]): IntegritySummary {
  const active = issues.filter(i => i.count > 0).sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity] || b.count - a.count)
  const errors = active.filter(i => i.severity === 'error').reduce((s, i) => s + i.count, 0)
  const warnings = active.filter(i => i.severity === 'warning').reduce((s, i) => s + i.count, 0)
  const recommendations = active.filter(i => i.severity === 'recommendation').reduce((s, i) => s + i.count, 0)
  const totalAffected = errors + warnings + recommendations
  // Errors weigh most; recommendations barely dent the score.
  const penalty = errors * 8 + warnings * 3 + recommendations * 1
  const score = Math.max(0, 100 - penalty)
  return { issues: active, errors, warnings, recommendations, totalAffected, score }
}
