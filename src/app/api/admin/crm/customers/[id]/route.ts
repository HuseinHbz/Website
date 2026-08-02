import { NextRequest, NextResponse } from 'next/server'
import { apiError, requirePermission } from '@/lib/api/respond'
import { customer360 } from '@/lib/crm/customer360Data'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — full Customer 360 view (26.25 بند ۱): profile + orders + payments +
// activities + tickets + source lead + matched public requests + balance/aging.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('crm.crm.customers', 'read')
  if ('error' in auth) return auth.error
  try {
    const { id } = await params
    // بند ۶.۱ ABAC — scope=own: only customers the user owns; others 404 (existence not leaked)
    {
      const { rowScopeFor } = await import('@/lib/rbac/data')
      if ((await rowScopeFor(auth.user.id, 'crm.crm.customers')) === 'own') {
        const { pgQuery } = await import('@/lib/db')
        const own = (await pgQuery<{ owner_id: string | null }>(`SELECT owner_id FROM sales_customers WHERE id=$1`, [Number(id)]))[0]
        if (!own || own.owner_id !== auth.user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
    }
    const data = await customer360(Number(id))
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (e) { return apiError(e, 'Failed to load customer') }
}
