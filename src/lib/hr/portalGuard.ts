/**
 * Phase 28.4 — employee-portal route guard.
 *
 * Every /api/hr-portal/* route resolves the employee ONLY from the server
 * session (never a client-supplied employeeId) — the single source of truth
 * for ownership. The `hr_portal_token` cookie is never accepted by the
 * customer-portal or admin gates, and vice versa: mutual rejection is
 * structural, not a runtime check.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getHrPortalIdentity, HR_PORTAL_COOKIE, type HrPortalIdentity } from './portalSession'

export async function requireHrPortal(req: NextRequest): Promise<{ identity: HrPortalIdentity } | { error: NextResponse }> {
  const token = req.cookies.get(HR_PORTAL_COOKIE)?.value
  const identity = await getHrPortalIdentity(token)
  if (!identity) return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) }
  return { identity }
}
