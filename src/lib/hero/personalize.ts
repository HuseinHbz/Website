/**
 * Hero Personalization resolver (Phase 23) — pure.
 *
 * Given a set of targeting rules and a request context, pick the best-matching
 * hero (device / language / country / returning visitor / campaign / referral /
 * logged-in / time schedule). Highest-priority matching rule wins; falls back to
 * the default hero. No I/O → unit-tested.
 */

export interface PersonalizationMatch {
  device?: 'mobile' | 'tablet' | 'desktop'
  locale?: 'en' | 'fa'
  country?: string          // ISO code, case-insensitive
  returning?: boolean
  loggedIn?: boolean
  campaign?: string         // utm_campaign, case-insensitive
  referral?: string         // substring of referrer host
  /** Time-of-day window (0..23) + optional weekday set (0=Sun..6=Sat). */
  schedule?: { fromHour: number; toHour: number; days?: number[] }
}
export interface PersonalizationRule {
  heroId: number
  priority: number
  match: PersonalizationMatch
}
export interface RequestContext {
  device: 'mobile' | 'tablet' | 'desktop'
  locale: 'en' | 'fa'
  country?: string
  returning?: boolean
  loggedIn?: boolean
  campaign?: string
  referral?: string
  hour: number              // 0..23
  weekday: number           // 0..6
}

function scheduleMatches(s: NonNullable<PersonalizationMatch['schedule']>, ctx: RequestContext): boolean {
  if (s.days && !s.days.includes(ctx.weekday)) return false
  // Support overnight windows (e.g. 22→6).
  return s.fromHour <= s.toHour ? ctx.hour >= s.fromHour && ctx.hour < s.toHour
    : ctx.hour >= s.fromHour || ctx.hour < s.toHour
}

/** Does a rule's match apply to this context? (Undefined fields = "any".) */
export function ruleMatches(m: PersonalizationMatch, ctx: RequestContext): boolean {
  if (m.device && m.device !== ctx.device) return false
  if (m.locale && m.locale !== ctx.locale) return false
  if (m.country && m.country.toLowerCase() !== (ctx.country ?? '').toLowerCase()) return false
  if (m.returning != null && m.returning !== !!ctx.returning) return false
  if (m.loggedIn != null && m.loggedIn !== !!ctx.loggedIn) return false
  if (m.campaign && m.campaign.toLowerCase() !== (ctx.campaign ?? '').toLowerCase()) return false
  if (m.referral && !(ctx.referral ?? '').toLowerCase().includes(m.referral.toLowerCase())) return false
  if (m.schedule && !scheduleMatches(m.schedule, ctx)) return false
  return true
}

/**
 * Resolve which hero to show: the highest-priority matching rule, else the
 * `defaultHeroId`. Ties broken by rule order (first wins).
 */
export function resolveHero(rules: PersonalizationRule[], ctx: RequestContext, defaultHeroId: number | null): number | null {
  let best: PersonalizationRule | null = null
  for (const r of rules) {
    if (!ruleMatches(r.match, ctx)) continue
    if (!best || r.priority > best.priority) best = r
  }
  return best ? best.heroId : defaultHeroId
}
