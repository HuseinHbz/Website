import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { certifications } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { getAdminUser } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'

export async function GET() {
  try {      const db = getDb()
      return NextResponse.json(await db.select().from(certifications).orderBy(asc(certifications.sortOrder)).all())
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {      const user = await getAdminUser()
      const body = await req.json()
      const db = getDb()
      const result = await db.insert(certifications).values({ ...body, updatedBy: user?.id }).returning()
      await logAction(user, 'CREATE', 'certifications', result[0]?.id, null, body)
      return NextResponse.json(result[0])
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {      const user = await getAdminUser()
      const { id, ...data } = await req.json()
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
      const db = getDb()
      await db.update(certifications).set({ ...data, updatedAt: new Date().toISOString(), updatedBy: user?.id }).where(eq(certifications.id, id))
      await logAction(user, 'UPDATE', 'certifications', id, null, data)
      return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {      const user = await getAdminUser()
      const { id } = await req.json()
      const db = getDb()
      await db.delete(certifications).where(eq(certifications.id, id))
      await logAction(user, 'DELETE', 'certifications', id)
      return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}
