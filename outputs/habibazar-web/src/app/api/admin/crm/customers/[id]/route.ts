import { NextRequest, NextResponse } from 'next/server'
import { apiError, requireAdmin } from '@/lib/api/respond'
import { customer360 } from '@/lib/crm/customer360Data'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — full Customer 360 view (26.25 بند ۱): profile + orders + payments +
// activities + tickets + source lead + matched public requests + balance/aging.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    const { id } = await params
    const data = await customer360(Number(id))
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (e) { return apiError(e, 'Failed to load customer') }
}
