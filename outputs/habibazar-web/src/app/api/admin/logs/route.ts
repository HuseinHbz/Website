import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// PM2 captures the app's stdout/stderr here (see deploy scripts). Override with
// PM2_LOG_DIR if your setup differs.
const LOG_DIR = process.env.PM2_LOG_DIR || '/home/hbz/logs'
const FILES: Record<'out' | 'error', string> = {
  out: 'habibazar-out.log',
  error: 'habibazar-error.log',
}

interface LogEntry {
  ts: string | null
  level: 'debug' | 'info' | 'warn' | 'error'
  msg: string
  source: 'out' | 'error'
  raw: string
}

async function tail(file: string, maxLines: number): Promise<string[]> {
  try {
    const content = await readFile(file, 'utf8')
    return content.split('\n').filter((l) => l.trim().length > 0).slice(-maxLines)
  } catch {
    return []
  }
}

function parseLine(raw: string, source: 'out' | 'error'): LogEntry {
  try {
    const j = JSON.parse(raw) as Record<string, unknown>
    if (j && typeof j === 'object' && ('level' in j || 'msg' in j)) {
      return {
        ts: typeof j.ts === 'string' ? j.ts : null,
        level: (['debug', 'info', 'warn', 'error'].includes(j.level as string) ? j.level : 'info') as LogEntry['level'],
        msg: typeof j.msg === 'string' ? j.msg : raw,
        source,
        raw,
      }
    }
  } catch {
    /* not JSON — plain line */
  }
  const level: LogEntry['level'] =
    source === 'error' || /\b(error|exception|fatal|unhandled)\b/i.test(raw) ? 'error' : 'info'
  return { ts: null, level, msg: raw, source, raw }
}

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams
    const lines = Math.min(Math.max(Number(params.get('lines')) || 300, 1), 2000)
    const [out, err] = await Promise.all([
      tail(path.join(LOG_DIR, FILES.out), lines),
      tail(path.join(LOG_DIR, FILES.error), lines),
    ])
    const entries = [
      ...out.map((l) => parseLine(l, 'out')),
      ...err.map((l) => parseLine(l, 'error')),
    ]
    // Order chronologically where timestamps exist; keep newest at the end.
    entries.sort((a, b) => (a.ts ?? '').localeCompare(b.ts ?? ''))
    const available = out.length > 0 || err.length > 0
    return NextResponse.json({ dir: LOG_DIR, available, entries: entries.slice(-lines) })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}
