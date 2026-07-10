import { NextRequest, NextResponse } from 'next/server'
import { apiError, guardJson, forbidden, unauthorized } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { forms } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getAdminUser, canDo } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'

export async function GET() {
  try {
    const db = getDb()
    const rows = await db.select().from(forms).orderBy(desc(forms.createdAt))
    return NextResponse.json(rows)
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAdminUser()
    if (!user) return unauthorized()
    const body = await guardJson(req)
    const db = getDb()
    const result = await db.insert(forms).values({ ...body, createdBy: user?.id }).returning()
    await logAction(user, 'CREATE', 'forms', String(result[0]?.id), null, body)
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
    await db.update(forms).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(forms.id, id))
    await logAction(user, 'UPDATE', 'forms', String(id), null, data)
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
    await db.delete(forms).where(eq(forms.id, id))
    await logAction(user, 'DELETE', 'forms', String(id))
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return apiError(e)
  }
}
