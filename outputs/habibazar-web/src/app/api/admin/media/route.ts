import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { mediaFiles } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getAdminUser } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { nanoid } from 'nanoid'

export async function GET(req: NextRequest) {
  const folder = req.nextUrl.searchParams.get('folder') || undefined
  const db = getDb()
  let query = db.select().from(mediaFiles).orderBy(desc(mediaFiles.uploadedAt))
  if (folder) {
    // @ts-expect-error drizzle where chaining
    query = query.where(eq(mediaFiles.folder, folder))
  }
  return NextResponse.json(await query.all())
}

export async function POST(req: NextRequest) {
  const user = await getAdminUser()
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const folder = (formData.get('folder') as string) || 'general'
  const alt = (formData.get('alt') as string) || ''

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
  const filename = `${nanoid()}.${ext}`
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', folder)
  await mkdir(uploadDir, { recursive: true })
  const bytes = await file.arrayBuffer()
  await writeFile(path.join(uploadDir, filename), Buffer.from(bytes))

  const url = `/uploads/${folder}/${filename}`
  const db = getDb()
  await db.insert(mediaFiles).values({
    filename,
    originalName: file.name,
    mimeType: file.type,
    size: file.size,
    url,
    folder,
    alt,
    uploadedBy: user?.id,
  })

  const inserted = await db.select().from(mediaFiles).where(eq(mediaFiles.filename, filename)).get()
  await logAction(user, 'UPLOAD', 'media_files', inserted?.id, null, { filename, folder })
  return NextResponse.json(inserted ?? { url, filename, originalName: file.name, mimeType: file.type, size: file.size, folder, alt })
}

export async function DELETE(req: NextRequest) {
  const user = await getAdminUser()
  const { id } = await req.json()
  const db = getDb()
  const file = await db.select().from(mediaFiles).where(eq(mediaFiles.id, id)).get()
  if (file) {
    try {
      const { unlink } = await import('fs/promises')
      await unlink(path.join(process.cwd(), 'public', file.url))
    } catch { /* file might not exist */ }
    await db.delete(mediaFiles).where(eq(mediaFiles.id, id))
    await logAction(user, 'DELETE', 'media_files', id, file, null)
  }
  return NextResponse.json({ ok: true })
}
