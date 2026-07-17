import { NextRequest, NextResponse } from 'next/server'
import { guardJson, unauthorized } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { aiModules } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAdminUser } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'

export async function GET() {
  const db = getDb()
  const rows = await db.select().from(aiModules).orderBy(aiModules.sortOrder)
  return NextResponse.json(rows)
}

export async function PUT(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return unauthorized()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await guardJson(req) as { id: number; enabled?: boolean; nameEn?: string; nameFa?: string; descriptionEn?: string; descriptionFa?: string; icon?: string; color?: string; systemPrompt?: string; sortOrder?: number }
  const db = getDb()
  const before = (await db.select().from(aiModules).where(eq(aiModules.id, body.id)))[0]
  const update: Partial<typeof aiModules.$inferInsert> = {}
  if (body.enabled !== undefined) update.enabled = body.enabled
  if (body.nameEn !== undefined) update.nameEn = body.nameEn
  if (body.nameFa !== undefined) update.nameFa = body.nameFa
  if (body.descriptionEn !== undefined) update.descriptionEn = body.descriptionEn
  if (body.descriptionFa !== undefined) update.descriptionFa = body.descriptionFa
  if (body.icon !== undefined) update.icon = body.icon
  if (body.color !== undefined) update.color = body.color
  if (body.systemPrompt !== undefined) update.systemPrompt = body.systemPrompt
  if (body.sortOrder !== undefined) update.sortOrder = body.sortOrder
  await db.update(aiModules).set(update).where(eq(aiModules.id, body.id))
  logAction(user, 'UPDATE', 'ai_module', String(body.id), before, update)
  return NextResponse.json({ ok: true })
}
