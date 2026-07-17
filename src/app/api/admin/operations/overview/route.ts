import { NextResponse } from 'next/server'
import { apiError, requireAdmin } from '@/lib/api/respond'
import { opsSnapshot } from '@/lib/ops/snapshot'

// Real-time Operations Center overview — genuine system telemetry (infra,
// metrics, subsystem health, SRE) for the admin panel. Read-only.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const auth = await requireAdmin('manage_settings')
    if ('error' in auth) return auth.error
    return NextResponse.json(await opsSnapshot())
  } catch (e: unknown) {
    return apiError(e)
  }
}
