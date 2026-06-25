import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { heroContent } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAdminUser } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'

export async function GET() {
  const db = getDb()
  const rows = await db.select().from(heroContent).all()
  return NextResponse.json(rows)
}

export async function PUT(req: NextRequest) {
  const user = await getAdminUser()
  const body = await req.json()
  const { locale, ...data } = body
  if (!locale) return NextResponse.json({ error: 'locale required' }, { status: 400 })
  const db = getDb()
  const existing = await db.select().from(heroContent).where(eq(heroContent.locale, locale)).get()
  if (existing) {
    await db.update(heroContent).set({ ...data, updatedAt: new Date().toISOString(), updatedBy: user?.id }).where(eq(heroContent.locale, locale))
  } else {
    await db.insert(heroContent).values({ locale, ...data, updatedBy: user?.id })
  }
  await logAction(user, 'UPDATE', 'hero_content', locale, existing, data)
  return NextResponse.json({ ok: true })
}
