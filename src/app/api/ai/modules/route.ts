import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { aiModules } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  const db = getDb()
  const rows = await db.select().from(aiModules).where(eq(aiModules.enabled, true)).orderBy(aiModules.sortOrder)
  return NextResponse.json(rows)
}
