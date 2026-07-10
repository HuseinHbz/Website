import { NextRequest, NextResponse } from 'next/server'
import { guardJson, forbidden, unauthorized } from '@/lib/api/respond'
import { getAdminUser, canDo } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'
import { getDb } from '@/lib/db'
import { credentials } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = getDb()
  const type = req.nextUrl.searchParams.get('type')
  const rows = type
    ? await db.select().from(credentials).where(eq(credentials.type, type as 'certification')).orderBy(credentials.sortOrder)
    : await db.select().from(credentials).orderBy(credentials.sortOrder)
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return unauthorized()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await guardJson(req)
  const db = getDb()
  const [row] = await db.insert(credentials).values({
    type: body.type || 'certification',
    nameEn: body.nameEn, nameFa: body.nameFa,
    issuer: body.issuer, issuerLogoUrl: body.issuerLogoUrl,
    issueDate: body.issueDate, expiryDate: body.expiryDate,
    credentialId: body.credentialId, credentialUrl: body.credentialUrl,
    badgeUrl: body.badgeUrl, descriptionEn: body.descriptionEn,
    color: body.color || '#6366f1', icon: body.icon,
    active: body.active ?? true, featured: body.featured ?? false,
    sortOrder: body.sortOrder ?? 0, updatedBy: user.id,
  }).returning()
  await logAction(user, 'create', 'credentials', row.id)
  return NextResponse.json(row, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return unauthorized()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await guardJson(req)
  const db = getDb()
  const [row] = await db.update(credentials).set({
    type: body.type,
    nameEn: body.nameEn, nameFa: body.nameFa,
    issuer: body.issuer, issuerLogoUrl: body.issuerLogoUrl,
    issueDate: body.issueDate, expiryDate: body.expiryDate,
    credentialId: body.credentialId, credentialUrl: body.credentialUrl,
    badgeUrl: body.badgeUrl, descriptionEn: body.descriptionEn,
    color: body.color, icon: body.icon,
    active: body.active, featured: body.featured,
    sortOrder: body.sortOrder, updatedBy: user.id,
  }).where(eq(credentials.id, body.id)).returning()
  await logAction(user, 'update', 'credentials', body.id)
  return NextResponse.json(row)
}

export async function DELETE(req: NextRequest) {
  const user = await getAdminUser()
  if (!user || !canDo(user.role, 'delete')) return forbidden('Delete requires an administrator role')
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await guardJson(req)
  const db = getDb()
  await db.delete(credentials).where(eq(credentials.id, id))
  await logAction(user, 'delete', 'credentials', id)
  return NextResponse.json({ ok: true })
}
