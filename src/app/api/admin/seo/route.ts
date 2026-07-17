import { NextRequest, NextResponse } from 'next/server'
import { guardJson, unauthorized } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { seoSettings } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { getAdminUser } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'

export async function GET() {
  const db = getDb()
  return NextResponse.json(await db.select().from(seoSettings))
}

export async function PUT(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return unauthorized()
  const body = await guardJson(req)
  const { pageKey, locale, ...data } = body
  if (!pageKey || !locale) return NextResponse.json({ error: 'pageKey and locale required' }, { status: 400 })
  const db = getDb()
  const existing = (await db.select().from(seoSettings).where(
    and(eq(seoSettings.pageKey, pageKey), eq(seoSettings.locale, locale))
  ))[0]
  if (existing) {
    await db.update(seoSettings).set({ ...data, updatedAt: new Date().toISOString(), updatedBy: user?.id }).where(
      and(eq(seoSettings.pageKey, pageKey), eq(seoSettings.locale, locale))
    )
  } else {
    await db.insert(seoSettings).values({ pageKey, locale, ...data, updatedBy: user?.id })
  }
  await logAction(user, 'UPDATE', 'seo_settings', `${pageKey}:${locale}`, existing, data)
  return NextResponse.json({ ok: true })
}
