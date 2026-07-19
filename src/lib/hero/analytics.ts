/**
 * Hero Analytics summarizer (Phase 23) — pure.
 *
 * Rolls raw hero events (view / click / conversion / scroll / time) into
 * per-hero KPIs (views, CTR, conversion rate, avg scroll depth, avg view time)
 * plus best/worst performers. No I/O → unit-tested.
 */

export type HeroEventType = 'view' | 'click' | 'conversion' | 'scroll' | 'time'
export interface HeroEvent {
  heroId: number
  type: HeroEventType
  /** scroll depth 0..100 for 'scroll'; seconds for 'time'; else ignored. */
  value?: number
}

export interface HeroKpis {
  heroId: number
  views: number
  clicks: number
  conversions: number
  ctr: number              // %
  conversionRate: number   // %
  avgScrollDepth: number   // %
  avgViewTime: number      // seconds
}
export interface AnalyticsSummary {
  perHero: HeroKpis[]
  totals: { views: number; clicks: number; conversions: number; ctr: number; conversionRate: number }
  topHero: number | null
  worstHero: number | null
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 10000) / 100 : 0)

export function summarizeHeroEvents(events: HeroEvent[]): AnalyticsSummary {
  const agg = new Map<number, { views: number; clicks: number; conversions: number; scrollSum: number; scrollN: number; timeSum: number; timeN: number }>()
  const get = (id: number) => { let a = agg.get(id); if (!a) { a = { views: 0, clicks: 0, conversions: 0, scrollSum: 0, scrollN: 0, timeSum: 0, timeN: 0 }; agg.set(id, a) } return a }
  for (const e of events) {
    const a = get(e.heroId)
    if (e.type === 'view') a.views++
    else if (e.type === 'click') a.clicks++
    else if (e.type === 'conversion') a.conversions++
    else if (e.type === 'scroll' && e.value != null) { a.scrollSum += e.value; a.scrollN++ }
    else if (e.type === 'time' && e.value != null) { a.timeSum += e.value; a.timeN++ }
  }
  const perHero: HeroKpis[] = [...agg.entries()].map(([heroId, a]) => ({
    heroId, views: a.views, clicks: a.clicks, conversions: a.conversions,
    ctr: pct(a.clicks, a.views), conversionRate: pct(a.conversions, a.views),
    avgScrollDepth: a.scrollN ? Math.round(a.scrollSum / a.scrollN) : 0,
    avgViewTime: a.timeN ? Math.round((a.timeSum / a.timeN) * 10) / 10 : 0,
  })).sort((x, y) => y.views - x.views)

  const totV = perHero.reduce((s, h) => s + h.views, 0)
  const totC = perHero.reduce((s, h) => s + h.clicks, 0)
  const totConv = perHero.reduce((s, h) => s + h.conversions, 0)
  // Best/worst by conversion rate among heroes with any views.
  const ranked = perHero.filter(h => h.views > 0).sort((x, y) => y.conversionRate - x.conversionRate)
  return {
    perHero,
    totals: { views: totV, clicks: totC, conversions: totConv, ctr: pct(totC, totV), conversionRate: pct(totConv, totV) },
    topHero: ranked[0]?.heroId ?? null,
    worstHero: ranked.length > 1 ? ranked[ranked.length - 1].heroId : null,
  }
}
