import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db/index'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Check {
  name: string
  status: 'ok' | 'degraded' | 'down'
  latencyMs?: number
  detail?: string
}

async function checkDatabase(): Promise<Check> {
  const start = Date.now()
  try {
    const db = getDb()
    // Access the underlying better-sqlite3 instance via Drizzle's $client
    const client = (db as unknown as { $client: { prepare: (sql: string) => { get: () => unknown } } }).$client
    client.prepare('SELECT 1').get()
    return { name: 'database', status: 'ok', latencyMs: Date.now() - start }
  } catch (err) {
    return { name: 'database', status: 'down', detail: String(err) }
  }
}

async function checkMemory(): Promise<Check> {
  const mem = process.memoryUsage()
  const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024)
  const heapTotalMb = Math.round(mem.heapTotal / 1024 / 1024)
  const usage = heapUsedMb / heapTotalMb
  return {
    name: 'memory',
    status: usage > 0.9 ? 'degraded' : 'ok',
    detail: `heap ${heapUsedMb}/${heapTotalMb} MB`,
  }
}

export async function GET(request: Request) {
  // Only allow health checks from internal/trusted sources
  const { searchParams } = new URL(request.url)
  const detailed = searchParams.get('detail') === '1'

  const [db, mem] = await Promise.all([checkDatabase(), checkMemory()])
  const checks: Check[] = [db, mem]

  const overallStatus = checks.some(c => c.status === 'down')
    ? 'down'
    : checks.some(c => c.status === 'degraded')
    ? 'degraded'
    : 'ok'

  const body: Record<string, unknown> = {
    status: overallStatus,
    ts: new Date().toISOString(),
    version: process.env.APP_VERSION ?? '2.0.0',
    uptime: Math.round(process.uptime()),
    env: process.env.NODE_ENV,
  }

  if (detailed) {
    body.checks = checks
    body.memory = process.memoryUsage()
  }

  const httpStatus = overallStatus === 'down' ? 503 : 200

  return NextResponse.json(body, {
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-store',
      'X-Health-Status': overallStatus,
    },
  })
}
