import { NextRequest, NextResponse } from 'next/server'
import { ensureSlug, ensureUniqueSlug } from '@/lib/admin/slug'
import { guardJson, apiError, requirePermission, notFound, jsonOr404 } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { workspaces } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { logAction } from '@/lib/admin/audit'
import { randomUUID } from 'crypto'
import { runOnce } from '@/lib/api/idempotency'

// 26.28 بند ۰.۲ — POST/PUT previously only checked "is logged in", so ANY admin
// role (even read-only auditor/viewer) could create or edit workspace rows.
// Key: system.workspaces (the Workspaces module in the System workspace).
// Note: this is the `workspaces` DB table, NOT the WORKSPACES registry constant
// the RBAC tree is generated from — separate things.

export async function GET() {
  const auth = await requirePermission('system.workspaces', 'read')
  if ('error' in auth) return auth.error
  try {
    const db = getDb()
    return NextResponse.json(await db.select().from(workspaces).orderBy(workspaces.sortOrder))
  } catch (e: unknown) { return apiError(e) }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission('system.workspaces', 'write', 'manage_settings')
  if ('error' in auth) return auth.error
  try {
    const body = await guardJson(req)
    const db = getDb()
    const result = (await runOnce(auth.user.id, 'workspaces', body, async () => db.insert(workspaces).values({ ...await ensureUniqueSlug(body as Record<string, unknown>, 'workspaces', 'workspace'), id: body.id || randomUUID(), createdBy: auth.user.id } as never).returning()))[0]
    await logAction(auth.user, 'CREATE', 'workspace', result.id, null, result)
    return NextResponse.json(result, { status: 201 })
  } catch (e: unknown) { return apiError(e) }
}

export async function PUT(req: NextRequest) {
  const auth = await requirePermission('system.workspaces', 'write', 'manage_settings')
  if ('error' in auth) return auth.error
  try {
    const { id, ...data } = await guardJson(req)
    const db = getDb()
    const result = (await db.update(workspaces).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(workspaces.id, id)).returning())[0]
    if (!result) return notFound()
    await logAction(auth.user, 'UPDATE', 'workspace', id, null, result)
    return jsonOr404(result)
  } catch (e: unknown) { return apiError(e) }
}

export async function DELETE(req: NextRequest) {
  const auth = await requirePermission('system.workspaces', 'write', 'delete')
  if ('error' in auth) return auth.error
  try {
    const { id } = await guardJson(req)
    const db = getDb()
    await db.delete(workspaces).where(eq(workspaces.id, id))
    await logAction(auth.user, 'DELETE', 'workspace', id, null, null)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) { return apiError(e) }
}
