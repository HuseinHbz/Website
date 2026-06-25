import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { siteSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAdminUser } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'

export async function GET() {
  const db = getDb()
  const rows = await db.select().from(siteSettings).all()
  const obj: Record<string, string> = {}
  for (const r of rows) obj[r.key] = r.value ?? ''
  return NextResponse.json(obj)
}

export async function PUT(req: NextRequest) {
  const user = await getAdminUser()
  const body = await req.json() as Record<string, string>
  const db = getDb()
  for (const [key, value] of Object.entries(body)) {
    const existing = await db.select().from(siteSettings).where(eq(siteSettings.key, key)).get()
    if (existing) {
      await db.update(siteSettings).set({ value, updatedAt: new Date().toISOString(), updatedBy: user?.id }).where(eq(siteSettings.key, key))
    } else {
      await db.insert(siteSettings).values({ key, value, updatedBy: user?.id })
    }
  }
  await logAction(user, 'UPDATE', 'site_settings', undefined, undefined, body)
  return NextResponse.json({ ok: true })
}
