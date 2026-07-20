import { NextRequest, NextResponse } from 'next/server'
import { apiError, forbidden, unauthorized, checkTreePermission } from '@/lib/api/respond'
import { readdir, stat, mkdir, unlink, readFile } from 'fs/promises'
import { spawn } from 'child_process'
import path from 'path'
import { getAdminUser, canDo } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://habibazar:habibazar_local@127.0.0.1:5432/habibazar'
const BACKUP_DIR = path.join(process.cwd(), 'data', 'backups')

// Only allow simple backup filenames — blocks path traversal on download/delete.
const NAME_RE = /^[a-zA-Z0-9._-]+\.dump$/

function pgDump(outFile: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn('pg_dump', ['-Fc', '--no-owner', '--no-privileges', '-f', outFile, DATABASE_URL], { stdio: 'ignore' })
    p.on('error', reject)
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`pg_dump exited ${code}`))))
  })
}

async function listBackups() {
  await mkdir(BACKUP_DIR, { recursive: true })
  const files = (await readdir(BACKUP_DIR)).filter((f) => f.endsWith('.dump'))
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
    return apiError(e)
  }
}

// POST → create a fresh database backup (proper online backup, WAL-safe)
export async function POST() {
  try {
    const user = await getAdminUser()
    if (!user) return unauthorized()
    { const deny = await checkTreePermission(user, 'backup.backup', 'write'); if (deny) return deny }
    await mkdir(BACKUP_DIR, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
    const name = `db-backup-${stamp}.dump`
    await pgDump(path.join(BACKUP_DIR, name))
    const s = await stat(path.join(BACKUP_DIR, name))
    await logAction(user, 'BACKUP', 'database', name, null, { size: s.size })
    return NextResponse.json({ name, size: s.size, createdAt: s.mtime.toISOString() })
  } catch (e: unknown) {
    return apiError(e)
  }
}

// DELETE ?name= → remove a backup file
export async function DELETE(req: NextRequest) {
  try {
    const user = await getAdminUser()
    if (!user || !canDo(user.role, 'delete')) return forbidden('Delete requires an administrator role')
    const name = req.nextUrl.searchParams.get('name')
    if (!name || !NAME_RE.test(name)) {
      return NextResponse.json({ error: 'Invalid file name' }, { status: 400 })
    }
    await unlink(path.join(BACKUP_DIR, name))
    await logAction(user, 'DELETE', 'backup', name)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return apiError(e)
  }
}
