import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { readJson, badRequest } from '@/lib/api/respond'
import { requireHrPortal } from '@/lib/hr/portalGuard'
import { myProfile, updateMyProfile, myDependents, myDocuments } from '@/lib/hr/portalData'
import { normalizeMobile } from '@/lib/hr/employees'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const schema = z.object({
  mobile: z.string().trim().max(20).optional(),
  email: z.string().trim().max(200).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
})

export async function GET(req: NextRequest) {
  const auth = await requireHrPortal(req)
  if ('error' in auth) return auth.error
  const profile = await myProfile(auth.identity.employeeId)
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({
    profile,
    dependents: await myDependents(auth.identity.employeeId),
    documents: await myDocuments(auth.identity.employeeId),
  })
}

// PATCH — non-sensitive fields only (mobile/email/address). nationalId/iban
// are never accepted here — they go through the info_correction request flow
// (بند ۵) so HR reviews and applies the change deliberately.
export async function PATCH(req: NextRequest) {
  const auth = await requireHrPortal(req)
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  const mobile = d.mobile ? normalizeMobile(d.mobile) : undefined
  if (d.mobile && !mobile) return badRequest('mobile: Invalid format')
  const r = await updateMyProfile(auth.identity.employeeId, { mobile: mobile ?? undefined, email: d.email, address: d.address })
  if (!r.ok) return badRequest(r.error ?? 'Failed')
  return NextResponse.json(r)
}
