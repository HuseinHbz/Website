import { NextResponse } from 'next/server'
import { apiError, requirePermission } from '@/lib/api/respond'
import { globalSearch, SEARCH_MODULES } from '@/lib/search/globalSearch'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — global admin search across every operational module. `?q=` (≥2 chars),
// optional `?modules=sales,crm` filter. Returns hits grouped by module + a flat
// ranked list. No `q` → just the list of searchable modules (for filter chips).
export async function GET(req: Request) {
  const auth = await requirePermission('executive.search', 'read')
  if ('error' in auth) return auth.error
  const url = new URL(req.url)
  const q = url.searchParams.get('q') ?? ''
  const modulesParam = url.searchParams.get('modules')
  const modules = modulesParam ? modulesParam.split(',').map(m => m.trim()).filter(Boolean) : undefined
  try {
    if (!q.trim()) return NextResponse.json({ modules: SEARCH_MODULES, groups: [], hits: [], total: 0 })
    const result = await globalSearch(q, { modules })
    return NextResponse.json({ modules: SEARCH_MODULES, ...result })
  } catch (e) { return apiError(e, 'Search failed') }
}
