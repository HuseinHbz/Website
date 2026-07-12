import { NextResponse } from 'next/server'
import { requireAdmin, apiError } from '@/lib/api/respond'
import { executiveCockpit } from '@/lib/bi/cockpitData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try { return NextResponse.json(await executiveCockpit()) } catch (e) { return apiError(e, 'Cockpit failed') }
}
