import { NextRequest, NextResponse } from 'next/server'
import { guardJson, unauthorized, checkTreePermission } from '@/lib/api/respond'
import { revalidatePath } from 'next/cache'
import { getDb } from '@/lib/db'
import { aboutContent } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAdminUser } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'

export async function GET() {
  const db = getDb()
  const rows = await db.select().from(aboutContent)
  return NextResponse.json(rows)
}

export async function PUT(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return unauthorized()
  { const deny = await checkTreePermission(user, 'brand.about', 'write'); if (deny) return deny }
  const body = await guardJson(req)
  const { locale, ...data } = body
  if (!locale) return NextResponse.json({ error: 'locale required' }, { status: 400 })
  const db = getDb()
  const existing = (await db.select().from(aboutContent).where(eq(aboutContent.locale, locale)))[0]
  if (existing) {
    await db.update(aboutContent).set({ ...data, updatedAt: new Date().toISOString(), updatedBy: user?.id }).where(eq(aboutContent.locale, locale))
  } else {
    await db.insert(aboutContent).values({ locale, ...data, updatedBy: user?.id })
  }
  await logAction(user, 'UPDATE', 'about_content', locale, existing, data)
  revalidatePath('/en/about')
  revalidatePath('/fa/about')
  revalidatePath('/', 'layout')
  return NextResponse.json({ ok: true })
}
