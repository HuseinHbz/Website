import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"
const MAX_RECENTS = 12
const isAdminHref = (h: string) => /^\/admin\/[a-z0-9/_-]*$/i.test(h) && h.length <= 80

interface Row { favorites: string; recents: string }

async function load(userId: string): Promise<{ favorites: string[]; recents: string[] }> {
  const r = (await pgQuery<Row>(`SELECT favorites, recents FROM nav_prefs WHERE user_id=$1`, [userId]))[0]
  const parse = (s: string | undefined): string[] => { try { const v = JSON.parse(s ?? '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string') : [] } catch { return [] } }
  return { favorites: parse(r?.favorites), recents: parse(r?.recents) }
}

async function save(userId: string, favorites: string[], recents: string[]) {
  await pgQuery(
    `INSERT INTO nav_prefs (user_id, favorites, recents, updated_at) VALUES ($1,$2,$3,${NOW})
     ON CONFLICT (user_id) DO UPDATE SET favorites=EXCLUDED.favorites, recents=EXCLUDED.recents, updated_at=${NOW}`,
    [userId, JSON.stringify(favorites.slice(0, 40)), JSON.stringify(recents.slice(0, MAX_RECENTS))])
}

// GET — the current user's favorites + recent items.
export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try { return NextResponse.json(await load(auth.user.id)) }
  catch (e) { return apiError(e, 'Failed to load nav prefs') }
}

const schema = z.object({
  action: z.enum(['toggleFavorite', 'visit', 'clearRecents']),
  href: z.string().max(80).optional(),
})

// POST — mutate prefs: pin/unpin a favorite, record a visit, or clear recents.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    const cur = await load(auth.user.id)
    let { favorites, recents } = cur
    if (d.action === 'toggleFavorite' && d.href && isAdminHref(d.href)) {
      favorites = favorites.includes(d.href) ? favorites.filter(h => h !== d.href) : [d.href, ...favorites]
    } else if (d.action === 'visit' && d.href && isAdminHref(d.href) && d.href !== '/admin/home') {
      recents = [d.href, ...recents.filter(h => h !== d.href)].slice(0, MAX_RECENTS)
    } else if (d.action === 'clearRecents') {
      recents = []
    }
    await save(auth.user.id, favorites, recents)
    return NextResponse.json({ favorites, recents })
  } catch (e) { return apiError(e, 'Failed to update nav prefs') }
}
