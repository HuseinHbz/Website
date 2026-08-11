import { NextRequest, NextResponse } from 'next/server'
import { guardJson, forbidden, unauthorized, checkTreePermission } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { mediaFiles } from '@/lib/db/schema'
import { eq, desc, and } from 'drizzle-orm'
import { getAdminUser, canDo } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'
import { writeFile, mkdir, unlink } from 'fs/promises'
import path from 'path'
import { nanoid } from 'nanoid'
import { toKebabSlug, uniqueFilename, validateAssetName } from '@/lib/media/slug'
import { validateMediaUpload, validateLottieSchema, type MediaCategory } from '@/lib/media/validate'

const HERO_CATEGORIES = new Set<MediaCategory>([
  'hero-background-video', 'hero-animation-video', 'hero-poster', 'hero-animation-vector', 'hero-animation-lottie',
])

export async function GET(req: NextRequest) {
  const folder = await req.nextUrl.searchParams.get('folder') || undefined
  const db = getDb()
  let query = db.select().from(mediaFiles).orderBy(desc(mediaFiles.uploadedAt))
  if (folder) {
    // @ts-expect-error drizzle where chaining
    query = query.where(eq(mediaFiles.folder, folder))
  }
  return NextResponse.json(await query)
}

/** Extension for the given category's real detected kind. Video kinds keep
 *  the source container's real extension (mp4 stays mp4, webm stays webm)
 *  rather than assuming one from the category. */
function extensionForUpload(originalName: string, kind: string): string {
  if (kind === 'video') return 'mp4'
  if (kind === 'webm-alpha') return 'webm'
  if (kind === 'svg') return 'svg'
  if (kind === 'lottie') return 'json'
  // image: keep the real original extension when it's a known image type,
  // default to a generic one otherwise.
  const ext = originalName.split('.').pop()?.toLowerCase()
  return ext && /^(png|jpe?g|webp)$/.test(ext) ? (ext === 'jpeg' ? 'jpg' : ext) : 'png'
}

export async function POST(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return unauthorized()
  { const deny = await checkTreePermission(user, 'brand.media', 'write'); if (deny) return deny }

  let writtenPath: string | null = null
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const folder = (formData.get('folder') as string) || 'general'
    const alt = (formData.get('alt') as string) || ''
    const category = (formData.get('category') as string) || ''
    const mode = (formData.get('mode') as string) || 'create' // 'create' | 'replace' | 'rename'
    const replaceId = formData.get('replaceId') ? Number(formData.get('replaceId')) : null
    const nameEn = (formData.get('nameEn') as string) || ''
    const nameFa = (formData.get('nameFa') as string) || ''
    const altEn = (formData.get('altEn') as string) || ''
    const altFa = (formData.get('altFa') as string) || ''
    const description = (formData.get('description') as string) || ''

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    const bytes = Buffer.from(await file.arrayBuffer())
    const isHeroCategory = HERO_CATEGORIES.has(category as MediaCategory)

    // ── Hero media categories: the full bilingual-name / real-validation /
    //    duplicate-handling flow the spec asks for. Every OTHER existing
    //    upload call site in the admin (avatars, clients, blog, certs, …)
    //    keeps the original lightweight behavior below — untouched, so
    //    nothing else in the admin breaks.
    if (isHeroCategory) {
      const enCheck = validateAssetName(nameEn, 'English name')
      if (!enCheck.ok) return NextResponse.json({ error: enCheck.error }, { status: 400 })
      const faCheck = validateAssetName(nameFa, 'Persian name')
      if (!faCheck.ok) return NextResponse.json({ error: faCheck.error }, { status: 400 })

      const check = validateMediaUpload(bytes, category as MediaCategory, file.type)
      if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 })

      let toWrite = bytes
      if (check.kind === 'svg') {
        const { sanitizeSvg } = await import('@/lib/branding/fileValidation')
        const clean = sanitizeSvg(bytes.toString('utf8'))
        if (!clean) return NextResponse.json({ error: 'SVG failed sanitization' }, { status: 400 })
        toWrite = Buffer.from(clean, 'utf8')
      }
      if (check.kind === 'lottie') {
        let parsed: unknown
        try { parsed = JSON.parse(bytes.toString('utf8')) } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
        const lottieCheck = validateLottieSchema(parsed)
        if (!lottieCheck.ok) return NextResponse.json({ error: `Lottie validation failed: ${lottieCheck.error}` }, { status: 400 })
      }

      const slug = toKebabSlug(nameEn)
      if (!slug) return NextResponse.json({ error: 'English name must contain at least one letter or digit' }, { status: 400 })
      const ext = extensionForUpload(file.name, check.kind!)

      const db = getDb()
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', folder)
      await mkdir(uploadDir, { recursive: true })

      const existingRows = await db.select({ filename: mediaFiles.filename }).from(mediaFiles).where(eq(mediaFiles.folder, folder))
      const existingSet = new Set(existingRows.map(r => r.filename))
      const exactMatch = `${slug}.${ext}`
      const conflictRow = existingSet.has(exactMatch)
        ? (await db.select().from(mediaFiles).where(and(eq(mediaFiles.folder, folder), eq(mediaFiles.filename, exactMatch))))[0]
        : null

      if (conflictRow && mode === 'create') {
        // Neither silently overwrite nor silently rename — surface the
        // conflict so the operator explicitly picks Rename/Replace/Cancel.
        return NextResponse.json({
          conflict: true,
          existing: { id: conflictRow.id, filename: conflictRow.filename, url: conflictRow.url, nameEn: conflictRow.nameEn, nameFa: conflictRow.nameFa },
          suggestedFilename: uniqueFilename(slug, ext, existingSet),
        }, { status: 409 })
      }

      const filename = mode === 'replace' && conflictRow ? conflictRow.filename : uniqueFilename(slug, ext, existingSet)
      writtenPath = path.join(uploadDir, filename)
      await writeFile(writtenPath, toWrite)

      const url = `/uploads/${folder}/${filename}`
      let inserted
      if (mode === 'replace' && conflictRow) {
        await db.update(mediaFiles).set({
          originalName: file.name, mimeType: file.type, size: toWrite.length, url, alt: alt || altEn,
          nameEn, nameFa, altEn, altFa, category, description, uploadedBy: user.id, uploadedAt: new Date().toISOString(),
        }).where(eq(mediaFiles.id, conflictRow.id))
        inserted = (await db.select().from(mediaFiles).where(eq(mediaFiles.id, conflictRow.id)))[0]
        await logAction(user, 'REPLACE', 'media_files', conflictRow.id,
          { url: conflictRow.url, nameEn: conflictRow.nameEn }, { url, nameEn })
      } else {
        await db.insert(mediaFiles).values({
          filename, originalName: file.name, mimeType: file.type, size: toWrite.length, url, folder,
          alt: alt || altEn, nameEn, nameFa, altEn, altFa, category, description, uploadedBy: user.id,
        })
        inserted = (await db.select().from(mediaFiles).where(and(eq(mediaFiles.folder, folder), eq(mediaFiles.filename, filename))))[0]
        await logAction(user, 'UPLOAD', 'media_files', inserted?.id, null, { filename, folder, nameEn, category })
      }
      return NextResponse.json(inserted ?? { url, filename })
    }

    // ── Legacy path — every other existing upload caller, unchanged.
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
    const filename = `${nanoid()}.${ext}`
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', folder)
    await mkdir(uploadDir, { recursive: true })
    writtenPath = path.join(uploadDir, filename)
    await writeFile(writtenPath, bytes)

    const url = `/uploads/${folder}/${filename}`
    const db = getDb()
    await db.insert(mediaFiles).values({
      filename, originalName: file.name, mimeType: file.type, size: file.size, url, folder, alt, uploadedBy: user.id,
    })
    const inserted = (await db.select().from(mediaFiles).where(eq(mediaFiles.filename, filename)))[0]
    await logAction(user, 'UPLOAD', 'media_files', inserted?.id, null, { filename, folder })
    return NextResponse.json(inserted ?? { url, filename, originalName: file.name, mimeType: file.type, size: file.size, folder, alt })
  } catch (e: unknown) {
    // A write failure used to surface as a bare, undiagnosable 500 ("Upload
    // Failed" with no reason) — the exact symptom reported. Clean up any
    // partially-written file and return the real (message-only, no stack)
    // cause so a permission/disk-space issue on the actual server is
    // immediately actionable instead of a dead end.
    if (writtenPath) { try { await unlink(writtenPath) } catch { /* nothing to clean up */ } }
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: `Upload failed: ${message}` }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getAdminUser()
  if (!user || !canDo(user.role, 'delete')) return forbidden('Delete requires an administrator role')
  const { id } = await guardJson(req)
  const db = getDb()
  const file = (await db.select().from(mediaFiles).where(eq(mediaFiles.id, id)))[0]
  if (file) {
    try {
      await unlink(path.join(process.cwd(), 'public', file.url))
    } catch { /* file might not exist */ }
    await db.delete(mediaFiles).where(eq(mediaFiles.id, id))
    await logAction(user, 'DELETE', 'media_files', id, file, null)
  }
  return NextResponse.json({ ok: true })
}
