import { NextRequest, NextResponse } from 'next/server'
import { apiError, guardJson, forbidden, unauthorized } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { skills } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { getAdminUser, canDo } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'

export async function GET() {
  try {
    const db = getDb()
    return NextResponse.json(await db.select().from(skills).orderBy(asc(skills.sortOrder)))
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAdminUser()
    if (!user) return unauthorized()
    const body = await guardJson(req)
    const { id: _id, updatedAt: _u, ...data } = body
    const db = getDb()
    const result = await db.insert(skills).values({ ...data, updatedBy: user?.id }).returning()
    await logAction(user, 'CREATE', 'skills', result[0]?.id, null, data)
    return NextResponse.json(result[0])
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAdminUser()
    if (!user) return unauthorized()
    const { id, ...data } = await guardJson(req)
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const db = getDb()
    await db.update(skills).set({ ...data, updatedAt: new Date().toISOString(), updatedBy: user?.id }).where(eq(skills.id, id))
    await logAction(user, 'UPDATE', 'skills', id, null, data)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAdminUser()
    if (!user || !canDo(user.role, 'delete')) return forbidden('Delete requires an administrator role')
    const { id } = await guardJson(req)
    const db = getDb()
    await db.delete(skills).where(eq(skills.id, id))
    await logAction(user, 'DELETE', 'skills', id)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return apiError(e)
  }
}
