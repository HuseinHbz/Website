import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { auditLogs } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const auth = await requirePermission('security.audit', 'read')
  if ('error' in auth) return auth.error
  const limit = Number(req.nextUrl.searchParams.get('limit') || '100')
  const db = getDb()
  const rows = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(Math.min(limit, 500))
  return NextResponse.json(rows)
}
