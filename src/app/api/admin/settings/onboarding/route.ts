import { NextResponse } from 'next/server'
import { apiError, requireAdmin } from '@/lib/api/respond'
import { goLiveChecklist } from '@/lib/admin/onboarding'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    return NextResponse.json(await goLiveChecklist())
  } catch (e) { return apiError(e, 'Failed to load onboarding checklist') }
}
