import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { auditLogs } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get('limit') || '100')
  const db = getDb()
  const rows = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(Math.min(limit, 500)).all()
  return NextResponse.json(rows)
}
