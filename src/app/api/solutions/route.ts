import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { solutions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  const db = getDb()
  const rows = await db.select().from(solutions).where(eq(solutions.active, true)).orderBy(solutions.sortOrder)
  return NextResponse.json(rows)
}
