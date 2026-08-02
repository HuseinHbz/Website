import { NextRequest, NextResponse } from 'next/server'
import { apiError, requireAdmin } from '@/lib/api/respond'
import { canDo } from '@/lib/admin/auth'
import { widgetById } from '@/lib/admin/widgets'
import { resolveWidgets } from '@/lib/admin/widgetData'
import { loadUserRbac } from '@/lib/rbac/data'
import { effectiveLevel } from '@/lib/rbac/engine'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — real data for a batch of widgets. `?ids=a,b,c`. RBAC-filtered.
// 26.28 بند ۰.۴ — the decision is TREE-first: a widget belongs to a workspace
// (its registry key), so an explicit grant/none on that workspace overrides the
// legacy role. No grant on the chain → legacy canDo(role, requires) exactly (R5).
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const ids = (req.nextUrl.searchParams.get('ids') || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 60)
  const fresh = req.nextUrl.searchParams.get('fresh') === '1'
  try {
    let grants: Record<string, 'none' | 'read' | 'write'> = {}
    try { grants = (await loadUserRbac(auth.user.id)).grants } catch { /* pre-migration → legacy */ }
    const allowed: string[] = []
    const denied: Record<string, { kind: 'denied' }> = {}
    for (const id of ids) {
      const w = widgetById(id)
      if (w) {
        const level = effectiveLevel(grants, w.workspace)
        if (level !== null) {
          // explicit tree decision: none denies; read/write allows (viewing = read)
          if (level === 'none') { denied[id] = { kind: 'denied' }; continue }
          allowed.push(id); continue
        }
        // no explicit grant anywhere on the chain → legacy role behaviour (R5)
        if (w.requires && !canDo(auth.user.role, w.requires)) { denied[id] = { kind: 'denied' }; continue }
      }
      allowed.push(id)
    }
    const data = await resolveWidgets(allowed, fresh)
    return NextResponse.json({ data: { ...data, ...denied } })
  } catch (e) { return apiError(e, 'Failed to load widget data') }
}
