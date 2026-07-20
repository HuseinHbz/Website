import { NextResponse } from 'next/server'
import { apiError, requirePermission } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { summarizeHeroEvents, type HeroEvent } from '@/lib/hero/analytics'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — hero analytics KPIs from real hero_events (last 30 days).
export async function GET() {
  const auth = await requirePermission('brand.hero', 'read')
  if ('error' in auth) return auth.error
  try {
    const rows = await pgQuery<{ hero_id: number; type: string; value: number | null }>(
      `SELECT hero_id, type, value FROM hero_events WHERE created_at >= to_char(now() - interval '30 days','YYYY-MM-DD HH24:MI:SS')`)
    const events: HeroEvent[] = rows.map(r => ({ heroId: r.hero_id, type: r.type as HeroEvent['type'], value: r.value ?? undefined }))
    const summary = summarizeHeroEvents(events)
    // Attach hero names.
    const names = await pgQuery<{ id: number; name: string }>(`SELECT id, name FROM heroes`)
    const nameOf = new Map(names.map(n => [n.id, n.name]))
    return NextResponse.json({
      ...summary,
      perHero: summary.perHero.map(h => ({ ...h, name: nameOf.get(h.heroId) ?? `#${h.heroId}` })),
      topHeroName: summary.topHero != null ? nameOf.get(summary.topHero) : null,
      worstHeroName: summary.worstHero != null ? nameOf.get(summary.worstHero) : null,
    })
  } catch (e) { return apiError(e, 'Failed to load hero analytics') }
}
