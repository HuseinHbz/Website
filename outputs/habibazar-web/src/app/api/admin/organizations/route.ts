import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'
import { getDb } from '@/lib/db'
import { organizations } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

export async function GET() {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = getDb()
  const rows = await db.select().from(organizations).orderBy(desc(organizations.featured), organizations.sortOrder, organizations.nameEn)
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const db = getDb()
  const [row] = await db.insert(organizations).values({
    slug: body.slug, nameEn: body.nameEn, nameFa: body.nameFa,
    type: body.type || 'client', tier: body.tier || null,
    logoUrl: body.logoUrl, website: body.website, contactEmail: body.contactEmail,
    phone: body.phone, country: body.country,
    descriptionEn: body.descriptionEn, descriptionFa: body.descriptionFa,
    active: body.active ?? true, featured: body.featured ?? false,
    sortOrder: body.sortOrder ?? 0, updatedBy: user.id,
  }).returning()
  await logAction(user, 'create', 'organizations', row.id)
  return NextResponse.json(row, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const db = getDb()
  const [row] = await db.update(organizations).set({
    slug: body.slug, nameEn: body.nameEn, nameFa: body.nameFa,
    type: body.type, tier: body.tier || null,
    logoUrl: body.logoUrl, website: body.website, contactEmail: body.contactEmail,
    phone: body.phone, country: body.country,
    descriptionEn: body.descriptionEn, descriptionFa: body.descriptionFa,
    active: body.active, featured: body.featured, sortOrder: body.sortOrder,
    updatedBy: user.id,
  }).where(eq(organizations.id, body.id)).returning()
  await logAction(user, 'update', 'organizations', body.id)
  return NextResponse.json(row)
}

export async function DELETE(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  const db = getDb()
  await db.delete(organizations).where(eq(organizations.id, id))
  await logAction(user, 'delete', 'organizations', id)
  return NextResponse.json({ ok: true })
}
