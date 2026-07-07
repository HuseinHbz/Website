/**
 * Global Search — pure ranking core (Module 13).
 *
 * The server data layer fetches candidate rows per module via parametrised ILIKE
 * queries; this pure module tokenises the query, scores each candidate against
 * its title/subtitle/keywords, and ranks. No I/O → fully unit-tested. Keeping the
 * maths here means every module's results are ranked on one consistent scale.
 */

export interface SearchCandidate {
  module: string
  type: string
  id: number | string
  title: string
  subtitle?: string
  /** extra matchable text (codes, tags) that need not be displayed */
  keywords?: string
  url: string
}
export interface SearchHit extends SearchCandidate { score: number }

/** Split a raw query into lowercased, de-duplicated terms. */
export function tokenize(q: string): string[] {
  return [...new Set(q.toLowerCase().split(/\s+/).map(t => t.trim()).filter(Boolean))]
}

/**
 * Score one field against the query terms. Rewards, in order:
 *  - exact full match (whole field === query)   → +10
 *  - field starts with the query                → +6
 *  - each term found as a word boundary         → +3
 *  - each term found as a substring             → +1
 */
export function scoreField(field: string | null | undefined, terms: string[], fullQuery: string): number {
  if (!field) return 0
  const f = field.toLowerCase()
  if (f === fullQuery) return 10
  let s = 0
  if (f.startsWith(fullQuery)) s += 6
  for (const t of terms) {
    if (new RegExp(`\\b${escapeRe(t)}`).test(f)) s += 3
    else if (f.includes(t)) s += 1
  }
  return s
}

function escapeRe(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

/** Score a candidate: title weighted highest, then subtitle, then keywords. */
export function scoreCandidate(c: SearchCandidate, terms: string[], fullQuery: string): number {
  return scoreField(c.title, terms, fullQuery) * 3
    + scoreField(c.subtitle, terms, fullQuery) * 2
    + scoreField(c.keywords, terms, fullQuery)
}

/** Rank candidates by score desc (ties → title asc), dropping zero-score rows. */
export function rankHits(candidates: SearchCandidate[], query: string, limit = 50): SearchHit[] {
  const terms = tokenize(query)
  const full = query.trim().toLowerCase()
  if (terms.length === 0) return []
  return candidates
    .map(c => ({ ...c, score: scoreCandidate(c, terms, full) }))
    .filter(h => h.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit)
}

/** Group ranked hits by module, preserving score order within each group. */
export function groupByModule(hits: SearchHit[]): { module: string; hits: SearchHit[] }[] {
  const m = new Map<string, SearchHit[]>()
  for (const h of hits) { const g = m.get(h.module) ?? []; g.push(h); m.set(h.module, g) }
  return [...m.entries()].map(([module, hs]) => ({ module, hits: hs }))
}
