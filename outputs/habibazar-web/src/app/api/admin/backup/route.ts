import { NextRequest, NextResponse } from 'next/server'
import { readdir, stat, mkdir, unlink, readFile } from 'fs/promises'
import path from 'path'
import type Database from 'better-sqlite3'
import { getDb } from '@/lib/db'
import { getAdminUser } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'habibazar.db')
const BACKUP_DIR = path.join(path.dirname(DB_PATH), 'backups')

// Only allow simple backup filenames — blocks path traversal on download/delete.
const NAME_RE = /^[a-zA-Z0-9._-]+\.db$/

async function listBackups() {
  await mkdir(BACKUP_DIR, { recursive: true })
  const files = (await readdir(BACKUP_DIR)).filter((f) => f.endsWith('.db'))
  const entries = await Promise.all(
    files.map(async (name) => {
      const s = await stat(path.join(BACKUP_DIR, name))
      return { name, size: s.size, createdAt: s.mtime.toISOString() }
    })
  )
  entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return entries
}

// GET            → list backups (JSON)
// GET ?download= → stream a backup file
export async function GET(req: NextRequest) {
  try {
    const download = req.nextUrl.searchParams.get('download')
    if (download) {
      if (!NAME_RE.test(download)) {
        return NextResponse.json({ error: 'Invalid file name' }, { status: 400 })
      }
      const file = path.join(BACKUP_DIR, download)
      const buf = await readFile(file)
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${download}"`,
          'Content-Length': String(buf.length),
        },
      })
    }
    return NextResponse.json(await listBackups())
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}

// POST → create a fresh database backup (proper online backup, WAL-safe)
export async function POST() {
  try {
    const user = await getAdminUser()
    await mkdir(BACKUP_DIR, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
    const name = `db-backup-${stamp}.db`
    const client = (getDb() as unknown as { $client: Database.Database }).$client
    await client.backup(path.join(BACKUP_DIR, name))
    const s = await stat(path.join(BACKUP_DIR, name))
    await logAction(user, 'BACKUP', 'database', name, null, { size: s.size })
    return NextResponse.json({ name, size: s.size, createdAt: s.mtime.toISOString() })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}

// DELETE ?name= → remove a backup file
export async function DELETE(req: NextRequest) {
  try {
    const user = await getAdminUser()
    const name = req.nextUrl.searchParams.get('name')
    if (!name || !NAME_RE.test(name)) {
      return NextResponse.json({ error: 'Invalid file name' }, { status: 400 })
    }
    await unlink(path.join(BACKUP_DIR, name))
    await logAction(user, 'DELETE', 'backup', name)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}
