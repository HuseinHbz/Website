import { NextRequest, NextResponse } from 'next/server'
import { apiError, requireAdmin } from '@/lib/api/respond'
import { canDo } from '@/lib/admin/auth'
import { widgetById } from '@/lib/admin/widgets'
import { resolveWidgets } from '@/lib/admin/widgetData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — real data for a batch of widgets. `?ids=a,b,c`. RBAC-filtered: a widget
// whose requirement the user lacks returns a permission-denied payload.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const ids = (req.nextUrl.searchParams.get('ids') || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 60)
  const fresh = req.nextUrl.searchParams.get('fresh') === '1'
  try {
    const allowed: string[] = []
    const denied: Record<string, { kind: 'denied' }> = {}
    for (const id of ids) {
      const w = widgetById(id)
      if (w && w.requires && !canDo(auth.user.role, w.requires)) denied[id] = { kind: 'denied' }
      else allowed.push(id)
    }
    const data = await resolveWidgets(allowed, fresh)
    return NextResponse.json({ data: { ...data, ...denied } })
  } catch (e) { return apiError(e, 'Failed to load widget data') }
}
