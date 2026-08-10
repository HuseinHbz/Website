import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { readJson, badRequest } from '@/lib/api/respond'
import { requireHrPortal } from '@/lib/hr/portalGuard'
import { myPortalRequests, submitPortalRequest } from '@/lib/hr/portalData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const schema = z.object({
  kind: z.enum(['certificate', 'advance', 'mission', 'info_correction']),
  payload: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
})

export async function GET(req: NextRequest) {
  const auth = await requireHrPortal(req)
  if ('error' in auth) return auth.error
  return NextResponse.json({ requests: await myPortalRequests(auth.identity.employeeId) })
}

// POST — submit an administrative ask (certificate/advance/mission/info
// correction). 🔴 info_correction is never applied automatically — it is
// recorded as a proposal for HR to act on through the existing employee
// editor, exactly as R8/بند۵ requires.
export async function POST(req: NextRequest) {
  const auth = await requireHrPortal(req)
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const r = await submitPortalRequest(auth.identity.employeeId, parsed.data.kind, parsed.data.payload)
  if (!r.ok) return badRequest(r.error ?? 'Failed')
  return NextResponse.json(r, { status: 201 })
}
