import { NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { getAdminUser, canDo, type AdminUser } from '@/lib/admin/auth'

// Generic 500 — never leak internal error messages to the client. The real
// error is logged server-side (visible in /admin/logs-monitoring).
export function apiError(e: unknown, message = 'Internal server error', status = 500) {
  logger.error(message, { error: e instanceof Error ? e.message : String(e), stack: e instanceof Error ? e.stack : undefined })
  return NextResponse.json({ error: message }, { status })
}

export function badRequest(message = 'Bad request') {
  return NextResponse.json({ error: message }, { status: 400 })
}
export function unauthorized(message = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 })
}
export function forbidden(message = 'Forbidden') {
  return NextResponse.json({ error: message }, { status: 403 })
}

type Action = Parameters<typeof canDo>[1]

/**
 * Enforce that a valid, active admin (with a live DB session) is making the
 * request — closes the gap where a revoked/deactivated session's unexpired JWT
 * could still write. Optionally enforce an RBAC action.
 *
 *   const auth = await requireAdmin('delete')
 *   if ('error' in auth) return auth.error
 *   const user = auth.user
 */
export async function requireAdmin(action?: Action): Promise<{ user: AdminUser } | { error: NextResponse }> {
  const user = await getAdminUser()
  if (!user) return { error: unauthorized() }
  if (action && !canDo(user.role, action)) return { error: forbidden() }
  return { user }
}

/** Parse + zod-validate a JSON body. Returns data or a 400 response. */
export async function readJson<T extends z.ZodTypeAny>(
  req: Request,
  schema: T
): Promise<{ data: z.infer<T> } | { error: NextResponse }> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return { error: badRequest('Invalid JSON body') }
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: badRequest(first ? `${first.path.join('.') || 'body'}: ${first.message}` : 'Validation failed') }
  }
  return { data: parsed.data }
}
