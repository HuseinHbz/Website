import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { roleDefaultFavorites } from '@/lib/admin/workspaces'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"
const MAX_RECENTS = 12
const MAX_SEARCHES = 8
const isAdminHref = (h: string) => /^\/admin\/?[a-z0-9/_-]*$/i.test(h) && h.length <= 80

interface Row { favorites: string; recents: string; searches: string; ui: string; seeded: boolean }
interface UiState { collapsedGroups?: string[]; favWorkspaces?: string[]; recentWorkspaces?: string[] }
interface Prefs { favorites: string[]; recents: string[]; searches: string[]; ui: UiState }
const MAX_RECENT_WS = 6

const parseArr = (s: string | undefined): string[] => { try { const v = JSON.parse(s ?? '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string') : [] } catch { return [] } }
const parseUi = (s: string | undefined): UiState => {
  try {
    const v = JSON.parse(s ?? '{}')
    if (!v || typeof v !== 'object') return {}
    return {
      collapsedGroups: parseArr(JSON.stringify(v.collapsedGroups ?? [])),
      favWorkspaces: parseArr(JSON.stringify(v.favWorkspaces ?? [])),
      recentWorkspaces: parseArr(JSON.stringify(v.recentWorkspaces ?? [])),
    }
  } catch { return {} }
}
const isWsId = (s: string) => /^[a-z]+$/.test(s) && s.length <= 40

async function load(userId: string): Promise<Prefs & { seeded: boolean }> {
  const r = (await pgQuery<Row>(`SELECT favorites, recents, searches, ui, (favorites IS NOT NULL) AS seeded FROM nav_prefs WHERE user_id=$1`, [userId]))[0]
  return { favorites: parseArr(r?.favorites), recents: parseArr(r?.recents), searches: parseArr(r?.searches), ui: parseUi(r?.ui), seeded: !!r }
}

async function save(userId: string, p: Prefs) {
  await pgQuery(
    `INSERT INTO nav_prefs (user_id, favorites, recents, searches, ui, updated_at) VALUES ($1,$2,$3,$4,$5,${NOW})
     ON CONFLICT (user_id) DO UPDATE SET favorites=EXCLUDED.favorites, recents=EXCLUDED.recents, searches=EXCLUDED.searches, ui=EXCLUDED.ui, updated_at=${NOW}`,
    [userId, JSON.stringify(p.favorites.slice(0, 40)), JSON.stringify(p.recents.slice(0, MAX_RECENTS)), JSON.stringify(p.searches.slice(0, MAX_SEARCHES)),
     JSON.stringify({ collapsedGroups: (p.ui.collapsedGroups ?? []).slice(0, 60), favWorkspaces: (p.ui.favWorkspaces ?? []).slice(0, 20), recentWorkspaces: (p.ui.recentWorkspaces ?? []).slice(0, MAX_RECENT_WS) })])
}

// GET — favorites + recents + recent searches + persisted UI state. On the first
// load for a user (no row yet), seed role-default favorites.
export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    const cur = await load(auth.user.id)
    if (!cur.seeded && cur.favorites.length === 0) {
      cur.favorites = roleDefaultFavorites(auth.user.role)
      await save(auth.user.id, cur)
    }
    return NextResponse.json({ favorites: cur.favorites, recents: cur.recents, searches: cur.searches, ui: cur.ui })
  } catch (e) { return apiError(e, 'Failed to load nav prefs') }
}

const schema = z.object({
  action: z.enum(['toggleFavorite', 'visit', 'clearRecents', 'search', 'clearSearches', 'toggleGroup', 'toggleFavWorkspace', 'visitWorkspace']),
  href: z.string().max(80).optional(),
  term: z.string().max(80).optional(),
  group: z.string().max(80).optional(),
  workspace: z.string().max(40).optional(),
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
    const ui: UiState = cur.ui
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
    } else if (d.action === 'toggleGroup' && d.group) {
      const g = d.group.slice(0, 80)
      const cg = ui.collapsedGroups ?? []
      ui.collapsedGroups = cg.includes(g) ? cg.filter(x => x !== g) : [...cg, g]
    } else if (d.action === 'toggleFavWorkspace' && d.workspace && isWsId(d.workspace)) {
      const fw = ui.favWorkspaces ?? []
      ui.favWorkspaces = fw.includes(d.workspace) ? fw.filter(x => x !== d.workspace) : [d.workspace, ...fw]
    } else if (d.action === 'visitWorkspace' && d.workspace && isWsId(d.workspace)) {
      const rw = ui.recentWorkspaces ?? []
      ui.recentWorkspaces = [d.workspace, ...rw.filter(x => x !== d.workspace)].slice(0, MAX_RECENT_WS)
    }
    await save(auth.user.id, { favorites, recents, searches, ui })
    return NextResponse.json({ favorites, recents, searches, ui })
  } catch (e) { return apiError(e, 'Failed to update nav prefs') }
}
