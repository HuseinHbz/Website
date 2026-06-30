import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { aiModules } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  const db = getDb()
  const rows = db.select().from(aiModules).where(eq(aiModules.enabled, true)).orderBy(aiModules.sortOrder).all()
  return NextResponse.json(rows)
}
