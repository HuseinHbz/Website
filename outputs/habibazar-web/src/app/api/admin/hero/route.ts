import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { heroContent } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAdminUser } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'

export async function GET() {
  try {
    const db = getDb()
    return await NextResponse.json(await db.select().from(heroContent))
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAdminUser()
    const body = await req.json()
    const { locale, ...data } = body
    if (!locale) return NextResponse.json({ error: 'locale required' }, { status: 400 })
    const db = getDb()
    const existing = (await db.select().from(heroContent).where(eq(heroContent.locale, locale)))[0]
    if (existing) {
      await db.update(heroContent).set({ ...data, updatedAt: new Date().toISOString(), updatedBy: user?.id }).where(eq(heroContent.locale, locale))
    } else {
      await db.insert(heroContent).values({ locale, ...data, updatedBy: user?.id })
    }
    await logAction(user, 'UPDATE', 'hero_content', locale, existing, data)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return apiError(e)
  }
}
