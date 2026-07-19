/**
 * Portal route guard (Phase 26.25a بند ۲.۵). Every /api/portal/* route resolves
 * the customer ONLY from the server session (never a client-supplied customer_id)
 * → the single source of truth for ownership. Returns a 401 response when the
 * session is missing/expired/revoked. The admin cookie is never accepted here
 * (different cookie name), and the portal cookie is never accepted by the admin
 * gate — mutual rejection is structural.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPortalIdentity, PORTAL_COOKIE, type PortalIdentity } from './session'

export async function requirePortal(req: NextRequest): Promise<{ identity: PortalIdentity } | { error: NextResponse }> {
  const token = req.cookies.get(PORTAL_COOKIE)?.value
  const identity = await getPortalIdentity(token)
  if (!identity) return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) }
  return { identity }
}
