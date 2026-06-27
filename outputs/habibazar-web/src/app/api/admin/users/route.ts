import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getAdminUser, hashPassword } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'
import { nanoid } from 'nanoid'

export async function GET() {
  try {      const me = await getAdminUser()
      if (me?.role !== 'super_admin' && me?.role !== 'administrator') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const db = getDb()
      const rows = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        active: users.active,
        createdAt: users.createdAt,
        lastLogin: users.lastLogin,
      }).from(users).orderBy(desc(users.createdAt)).all()
      return NextResponse.json(rows)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {      const me = await getAdminUser()
      if (me?.role !== 'super_admin' && me?.role !== 'administrator') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const { name, email, password, role } = await req.json()
      if (!name || !email || !password) return NextResponse.json({ error: 'Name, email, password required' }, { status: 400 })
      const hash = await hashPassword(password)
      const db = getDb()
      const result = await db.insert(users).values({
        id: nanoid(),
        name,
        email: email.toLowerCase(),
        passwordHash: hash,
        role: role || 'editor',
      }).returning()
      await logAction(me, 'CREATE', 'users', result[0]?.id, null, { name, email, role })
      return NextResponse.json({ id: result[0]?.id, email: result[0]?.email })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {      const me = await getAdminUser()
      if (me?.role !== 'super_admin' && me?.role !== 'administrator') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const { id, password, ...data } = await req.json()
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
      const db = getDb()
      const updateData: Record<string, unknown> = { ...data }
      if (password) updateData.passwordHash = await hashPassword(password)
      await db.update(users).set(updateData).where(eq(users.id, id))
      await logAction(me, 'UPDATE', 'users', id, null, data)
      return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {      const me = await getAdminUser()
      if (me?.role !== 'super_admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const { id } = await req.json()
      if (id === me.id) return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 })
      const db = getDb()
      await db.delete(users).where(eq(users.id, id))
      await logAction(me, 'DELETE', 'users', id)
      return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}
