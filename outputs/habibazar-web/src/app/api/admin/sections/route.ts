import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { sections, sectionVersions } from '@/lib/db/schema'
import { eq, desc, like, and } from 'drizzle-orm'
import { getAdminUser } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'
import { nanoid } from 'nanoid'

export async function GET(req: NextRequest) {
  try {
    const me = await getAdminUser()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const type = searchParams.get('type')
    const status = searchParams.get('status')
    const db = getDb()

    if (id) {
      const section = (await db.select().from(sections).where(eq(sections.id, id)))[0]
      if (!section) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      const versions = await db.select().from(sectionVersions)
        .where(eq(sectionVersions.sectionId, id))
        .orderBy(desc(sectionVersions.version))
        
      return await NextResponse.json({ ...section, versions })
    }

    const conditions = []
    if (type) conditions.push(eq(sections.sectionType, type))
    if (status) conditions.push(eq(sections.status, status as 'draft' | 'published' | 'archived'))

    const rows = conditions.length > 0
      ? await db.select().from(sections).where(and(...conditions)).orderBy(desc(sections.updatedAt))
      : await db.select().from(sections).orderBy(desc(sections.updatedAt))

    return NextResponse.json(rows)
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await getAdminUser()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (me.role === 'editor') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { sectionType, variant = 'default', titleEn = '', ...rest } = body
    if (!sectionType) return NextResponse.json({ error: 'sectionType required' }, { status: 400 })

    const id = nanoid()
    const db = getDb()
    await db.insert(sections).values({
      id,
      sectionType,
      variant,
      titleEn,
      ...rest,
      version: 1,
      createdBy: me.id,
      updatedBy: me.id,
    })

    const created = (await db.select().from(sections).where(eq(sections.id, id)))[0]
    await logAction(me, 'CREATE', 'sections', id, null, { sectionType, titleEn })
    return NextResponse.json(created, { status: 201 })
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const me = await getAdminUser()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (me.role === 'editor') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { id, ...data } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const db = getDb()
    const existing = (await db.select().from(sections).where(eq(sections.id, id)))[0]
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Save version snapshot before update
    await db.insert(sectionVersions).values({
      sectionId: id,
      version: existing.version,
      snapshot: JSON.stringify(existing),
      createdBy: me.id,
    })

    const newVersion = existing.version + 1
    await db.update(sections).set({
      ...data,
      version: newVersion,
      updatedBy: me.id,
      updatedAt: new Date().toISOString(),
    }).where(eq(sections.id, id))

    const updated = (await db.select().from(sections).where(eq(sections.id, id)))[0]
    await logAction(me, 'UPDATE', 'sections', id, null, { version: newVersion })
    return NextResponse.json(updated)
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await getAdminUser()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (me.role !== 'super_admin' && me.role !== 'administrator') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const db = getDb()
    await db.delete(sections).where(eq(sections.id, id))
    await logAction(me, 'DELETE', 'sections', id)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return apiError(e)
  }
}
