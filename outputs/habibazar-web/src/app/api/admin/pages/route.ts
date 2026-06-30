import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { pages, pageSections, sections } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getAdminUser } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'
import { nanoid } from 'nanoid'

export async function GET(req: NextRequest) {
  try {
    const me = await getAdminUser()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const db = getDb()

    if (id) {
      const page = await db.select().from(pages).where(eq(pages.id, id)).get()
      if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const sectionLinks = await db.select({
        id: pageSections.id,
        sortOrder: pageSections.sortOrder,
        active: pageSections.active,
        sectionId: pageSections.sectionId,
        sectionType: sections.sectionType,
        titleEn: sections.titleEn,
        variant: sections.variant,
        status: sections.status,
        theme: sections.theme,
      })
        .from(pageSections)
        .leftJoin(sections, eq(pageSections.sectionId, sections.id))
        .where(eq(pageSections.pageId, id))
        .orderBy(pageSections.sortOrder)
        .all()

      return NextResponse.json({ ...page, sections: sectionLinks })
    }

    const rows = await db.select().from(pages).orderBy(desc(pages.updatedAt)).all()
    return NextResponse.json(rows)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await getAdminUser()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (me.role === 'editor') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { titleEn, titleFa, slug } = body
    if (!titleEn || !titleFa || !slug) {
      return NextResponse.json({ error: 'titleEn, titleFa, slug required' }, { status: 400 })
    }

    const id = nanoid()
    const db = getDb()
    await db.insert(pages).values({ id, ...body, createdBy: me.id, updatedBy: me.id })
    const created = await db.select().from(pages).where(eq(pages.id, id)).get()
    await logAction(me, 'CREATE', 'pages', id, null, { titleEn, slug })
    return NextResponse.json(created, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const me = await getAdminUser()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (me.role === 'editor') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { id, sections: sectionOrder, ...data } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const db = getDb()
    await db.update(pages).set({ ...data, updatedBy: me.id, updatedAt: new Date().toISOString() }).where(eq(pages.id, id))

    // Update section ordering if provided
    if (Array.isArray(sectionOrder)) {
      await db.delete(pageSections).where(eq(pageSections.pageId, id))
      if (sectionOrder.length > 0) {
        await db.insert(pageSections).values(
          sectionOrder.map((item: { sectionId: string; active?: boolean }, idx: number) => ({
            pageId: id,
            sectionId: item.sectionId,
            sortOrder: idx,
            active: item.active !== false,
          }))
        )
      }
    }

    await logAction(me, 'UPDATE', 'pages', id, null, data)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
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
    await db.delete(pages).where(eq(pages.id, id))
    await logAction(me, 'DELETE', 'pages', id)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}
