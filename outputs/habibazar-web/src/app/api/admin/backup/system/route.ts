import { NextResponse } from 'next/server'
import { readdir, stat, readFile } from 'fs/promises'
import path from 'path'

// Read-only view of the automated (cron) backups produced by deploy/backup.sh
// so the admin panel can monitor them. The files are encrypted on disk; this
// endpoint never exposes their contents or the key — only metadata + status.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ROOT = process.env.BACKUP_ROOT || '/var/backups/habibazar'
const BUCKETS = ['hourly', 'daily', 'weekly', 'monthly', 'yearly'] as const

export async function GET() {
  try {
    let status: unknown = null
    try {
      status = JSON.parse(await readFile(path.join(ROOT, 'last-status.json'), 'utf8'))
    } catch {
      /* no status yet */
    }

    const buckets: Record<string, { name: string; size: number; createdAt: string }[]> = {}
    for (const b of BUCKETS) {
      try {
        const files = (await readdir(path.join(ROOT, b))).filter((f) => f.endsWith('.enc'))
        const entries = await Promise.all(
          files.map(async (name) => {
            const s = await stat(path.join(ROOT, b, name))
            return { name, size: s.size, createdAt: s.mtime.toISOString() }
          })
        )
        entries.sort((a, c) => c.createdAt.localeCompare(a.createdAt))
        buckets[b] = entries
      } catch {
        buckets[b] = []
      }
    }

    const all = Object.values(buckets).flat()
    const totalSize = all.reduce((s, e) => s + e.size, 0)
    const latest = all.sort((a, c) => c.createdAt.localeCompare(a.createdAt))[0] ?? null
    return NextResponse.json({ root: ROOT, status, buckets, count: all.length, totalSize, latest })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}
