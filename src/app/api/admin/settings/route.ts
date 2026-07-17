import { NextRequest, NextResponse } from 'next/server'
import { apiError, guardJson } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { siteSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'

export async function GET() {
  try {      const db = getDb()
      const rows = await db.select().from(siteSettings)
      const obj: Record<string, string> = {}
      for (const r of rows) obj[r.key] = r.value ?? ''
      return NextResponse.json(obj)
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function PUT(req: NextRequest) {
  try {      const auth = await requireAdmin('manage_settings')
      if ('error' in auth) return auth.error
      const user = auth.user
      const body = await guardJson(req) as Record<string, string>
      const db = getDb()
      for (const [key, value] of Object.entries(body)) {
        const existing = (await db.select().from(siteSettings).where(eq(siteSettings.key, key)))[0]
        if (existing) {
          await db.update(siteSettings).set({ value, updatedAt: new Date().toISOString(), updatedBy: user?.id }).where(eq(siteSettings.key, key))
        } else {
          await db.insert(siteSettings).values({ key, value, updatedBy: user?.id })
        }
      }
      await logAction(user, 'UPDATE', 'site_settings', undefined, undefined, body)
      return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return apiError(e)
  }
}
