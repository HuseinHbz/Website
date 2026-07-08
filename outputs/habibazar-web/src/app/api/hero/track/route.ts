import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { pgQuery } from '@/lib/db'
import { badRequest } from '@/lib/api/respond'
import { limiters } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

// Public, unauthenticated analytics beacon for hero events. Rate-limited; only
// the closed event vocabulary is accepted, values are clamped.
const schema = z.object({
  heroId: z.number().int().positive(),
  type: z.enum(['view', 'click', 'conversion', 'scroll', 'time']),
  value: z.number().finite().optional(),
  experimentKey: z.string().max(60).optional(),
  variantId: z.string().max(20).optional(),
})

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon'
  if (!limiters.api(ip).allowed) return NextResponse.json({ ok: false }, { status: 429 })
  let raw: unknown
  try { raw = await req.json() } catch { return badRequest('Invalid JSON') }
  const p = schema.safeParse(raw)
  if (!p.success) return badRequest('Invalid event')
  const d = p.data
  const value = d.value != null ? Math.max(0, Math.min(d.type === 'scroll' ? 100 : 86400, d.value)) : null
  try {
    await pgQuery(
      `INSERT INTO hero_events (hero_id, experiment_key, variant_id, type, value, created_at) VALUES ($1,$2,$3,$4,$5,${NOW})`,
      [d.heroId, d.experimentKey ?? null, d.variantId ?? null, d.type, value])
    return NextResponse.json({ ok: true })
  } catch { return NextResponse.json({ ok: false }, { status: 200 }) } // never break the page over a beacon
}
