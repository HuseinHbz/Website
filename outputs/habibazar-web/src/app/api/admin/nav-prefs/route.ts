import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"
const MAX_RECENTS = 12
const MAX_SEARCHES = 8
const isAdminHref = (h: string) => /^\/admin\/[a-z0-9/_-]*$/i.test(h) && h.length <= 80

interface Row { favorites: string; recents: string; searches: string }

async function load(userId: string): Promise<{ favorites: string[]; recents: string[]; searches: string[] }> {
  const r = (await pgQuery<Row>(`SELECT favorites, recents, searches FROM nav_prefs WHERE user_id=$1`, [userId]))[0]
  const parse = (s: string | undefined): string[] => { try { const v = JSON.parse(s ?? '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string') : [] } catch { return [] } }
  return { favorites: parse(r?.favorites), recents: parse(r?.recents), searches: parse(r?.searches) }
}

async function save(userId: string, favorites: string[], recents: string[], searches: string[]) {
  await pgQuery(
    `INSERT INTO nav_prefs (user_id, favorites, recents, searches, updated_at) VALUES ($1,$2,$3,$4,${NOW})
     ON CONFLICT (user_id) DO UPDATE SET favorites=EXCLUDED.favorites, recents=EXCLUDED.recents, searches=EXCLUDED.searches, updated_at=${NOW}`,
    [userId, JSON.stringify(favorites.slice(0, 40)), JSON.stringify(recents.slice(0, MAX_RECENTS)), JSON.stringify(searches.slice(0, MAX_SEARCHES))])
}

// GET — the current user's favorites + recent items.
export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try { return NextResponse.json(await load(auth.user.id)) }
  catch (e) { return apiError(e, 'Failed to load nav prefs') }
}

const schema = z.object({
  action: z.enum(['toggleFavorite', 'visit', 'clearRecents', 'search', 'clearSearches']),
  href: z.string().max(80).optional(),
  term: z.string().max(80).optional(),
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
    let { favorites, recents, searches } = cur
    if (d.action === 'toggleFavorite' && d.href && isAdminHref(d.href)) {
      favorites = favorites.includes(d.href) ? favorites.filter(h => h !== d.href) : [d.href, ...favorites]
    } else if (d.action === 'visit' && d.href && isAdminHref(d.href) && d.href !== '/admin/home') {
      recents = [d.href, ...recents.filter(h => h !== d.href)].slice(0, MAX_RECENTS)
    } else if (d.action === 'clearRecents') {
      recents = []
    } else if (d.action === 'search' && d.term && d.term.trim().length >= 2) {
      const term = d.term.trim().slice(0, 80)
      searches = [term, ...searches.filter(s => s.toLowerCase() !== term.toLowerCase())].slice(0, MAX_SEARCHES)
    } else if (d.action === 'clearSearches') {
      searches = []
    }
    await save(auth.user.id, favorites, recents, searches)
    return NextResponse.json({ favorites, recents, searches })
  } catch (e) { return apiError(e, 'Failed to update nav prefs') }
}
