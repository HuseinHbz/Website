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
import { apiErrorFa, logFa, newRequestId } from '@/lib/api/errorContract'
import { faDigits } from '@/lib/admin/chartRtl'

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

/** ENOSPC (disk full) is the one filesystem error that gets its own status
 *  code (507) and message per the Persian error contract — every other
 *  write failure (permission denied, read-only fs, …) is a generic 500. */
function isDiskFullError(e: unknown): boolean {
  return (e as { code?: string } | null)?.code === 'ENOSPC'
}

export async function POST(req: NextRequest) {
  const requestId = newRequestId()
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
    const nameEn = (formData.get('nameEn') as string) || ''
    const nameFa = (formData.get('nameFa') as string) || ''
    const altEn = (formData.get('altEn') as string) || ''
    const altFa = (formData.get('altFa') as string) || ''
    const description = (formData.get('description') as string) || ''

    if (!file) return apiErrorFa(400, 'MEDIA_NO_FILE', 'فایلی برای آپلود ارسال نشده است.', { requestId, stage: 'validation' })
    const bytes = Buffer.from(await file.arrayBuffer())
    const isHeroCategory = HERO_CATEGORIES.has(category as MediaCategory)

    // ── Hero media categories: the full bilingual-name / real-validation /
    //    duplicate-handling flow the spec asks for. Every OTHER existing
    //    upload call site in the admin (avatars, clients, blog, certs, …)
    //    keeps the original lightweight behavior below — untouched, so
    //    nothing else in the admin breaks.
    if (isHeroCategory) {
      const enCheck = validateAssetName(nameEn, 'English name')
      if (!enCheck.ok) return apiErrorFa(422, 'MEDIA_INVALID_NAME', 'نام انگلیسی باید بین ۲ تا ۸۰ کاراکتر باشد.', { requestId, stage: 'validation', fieldErrors: { nameEn: enCheck.error ?? '' } })
      const faCheck = validateAssetName(nameFa, 'Persian name')
      if (!faCheck.ok) return apiErrorFa(422, 'MEDIA_INVALID_NAME', 'نام فارسی باید بین ۲ تا ۸۰ کاراکتر باشد.', { requestId, stage: 'validation', fieldErrors: { nameFa: faCheck.error ?? '' } })

      const check = validateMediaUpload(bytes, category as MediaCategory, file.type)
      if (!check.ok) {
        // "اعتبارسنجی فایل" stage: either the format is wrong (415) or the
        // size is over this category's limit (413) — validateMediaUpload's
        // own message already says which, distinguished here only by code.
        const isSizeError = /MB limit/i.test(check.error ?? '')
        if (isSizeError) {
          const mb = check.error?.match(/(\d+)MB/)?.[1] ?? '?'
          return apiErrorFa(413, 'MEDIA_SIZE_EXCEEDED', `حجم فایل بیشتر از حد مجاز ${faDigits(mb)} مگابایت است.`, { requestId, stage: 'validation', retryable: false })
        }
        return apiErrorFa(415, 'MEDIA_UNSUPPORTED_FORMAT', 'فرمت واقعی فایل با پسوند یا دستهٔ انتخاب‌شده مطابقت ندارد.', { requestId, stage: 'validation', retryable: false })
      }

      let toWrite = bytes
      if (check.kind === 'svg') {
        const { sanitizeSvg } = await import('@/lib/branding/fileValidation')
        const clean = sanitizeSvg(bytes.toString('utf8'))
        if (!clean) return apiErrorFa(422, 'MEDIA_SVG_UNSAFE', 'فایل SVG رد شد؛ ممکن است حاوی کد یا محتوای ناامن باشد.', { requestId, stage: 'validation', retryable: false })
        toWrite = Buffer.from(clean, 'utf8')
      }
      if (check.kind === 'lottie') {
        let parsed: unknown
        try { parsed = JSON.parse(bytes.toString('utf8')) } catch { return apiErrorFa(422, 'MEDIA_INVALID_JSON', 'فایل Lottie یک JSON معتبر نیست.', { requestId, stage: 'validation', retryable: false }) }
        const lottieCheck = validateLottieSchema(parsed)
        if (!lottieCheck.ok) return apiErrorFa(422, 'MEDIA_INVALID_LOTTIE', `اعتبارسنجی Lottie ناموفق بود: ${lottieCheck.error}`, { requestId, stage: 'validation', retryable: false })
      }

      const slug = toKebabSlug(nameEn)
      if (!slug) return apiErrorFa(422, 'MEDIA_INVALID_NAME', 'نام انگلیسی باید حداقل شامل یک حرف یا عدد باشد.', { requestId, stage: 'validation', fieldErrors: { nameEn: 'invalid' } })
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
          errorCode: 'MEDIA_DUPLICATE',
          messageFa: 'این نام قبلاً در کتابخانه رسانه ثبت شده است.',
          requestId,
          existing: { id: conflictRow.id, filename: conflictRow.filename, url: conflictRow.url, nameEn: conflictRow.nameEn, nameFa: conflictRow.nameFa },
          suggestedFilename: uniqueFilename(slug, ext, existingSet),
        }, { status: 409 })
      }

      const filename = mode === 'replace' && conflictRow ? conflictRow.filename : uniqueFilename(slug, ext, existingSet)
      writtenPath = path.join(uploadDir, filename)
      try {
        await writeFile(writtenPath, toWrite)
      } catch (e) {
        writtenPath = null // nothing was actually written — the catch block below must not try to unlink it
        if (isDiskFullError(e)) {
          logFa('آپلود رسانه', 'MEDIA_DISK_FULL', 'فضای ذخیره‌سازی سرور کافی نیست.', requestId, e)
          return apiErrorFa(507, 'MEDIA_DISK_FULL', 'فضای ذخیره‌سازی سرور کافی نیست.', { requestId, stage: 'storage', retryable: false })
        }
        logFa('آپلود رسانه', 'MEDIA_WRITE_FAILED', 'امکان ذخیره فایل در فضای سرور وجود ندارد.', requestId, e)
        return apiErrorFa(500, 'MEDIA_WRITE_FAILED', 'امکان ذخیره فایل در فضای سرور وجود ندارد.', { requestId, stage: 'storage', retryable: true })
      }

      const url = `/uploads/${folder}/${filename}`
      let inserted
      try {
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
      } catch (e) {
        // The file IS on disk and playable — only the DB record failed.
        // Distinguished from a storage failure per the mission's error
        // contract: this is recoverable (retry re-registers the same file
        // path), unlike a disk-full write failure.
        logFa('آپلود رسانه', 'MEDIA_DATABASE_WRITE_FAILED', 'فایل ذخیره شد اما ثبت اطلاعات آن در پایگاه داده ناموفق بود.', requestId, e)
        try { await unlink(writtenPath) } catch { /* best-effort — the DB row never existed, so leaving an orphan file is the safer failure mode over throwing again here */ }
        return apiErrorFa(500, 'MEDIA_DATABASE_WRITE_FAILED', 'فایل ذخیره شد اما ثبت اطلاعات آن در پایگاه داده ناموفق بود.', { requestId, stage: 'database', retryable: true })
      }
      return NextResponse.json(inserted ? { ...inserted, requestId } : { url, filename, requestId })
    }

    // ── Legacy path — every other existing upload caller (avatars, clients,
    // blog, certifications, …) keeps its exact prior behavior — EXCEPT a
    // size ceiling, which never existed here: this path buffered and wrote
    // whatever size a file was with zero limit, a real disk-exhaustion risk
    // an admin session (even a lower-privilege one with brand.media write)
    // could trigger with repeated large uploads. Generous by design — this
    // path also accepts full documents/ZIPs (see MediaManager's accept
    // list) — and env-configurable like the Hero category limits.
    const generalLimitBytes = (() => {
      const n = parseInt(process.env.MEDIA_MAX_GENERAL_MB || '', 10)
      return (Number.isFinite(n) && n > 0 ? n : 100) * 1024 * 1024
    })()
    if (bytes.length > generalLimitBytes) {
      const mb = Math.round(generalLimitBytes / 1024 / 1024)
      return apiErrorFa(413, 'MEDIA_SIZE_EXCEEDED', `حجم فایل بیشتر از حد مجاز ${faDigits(mb)} مگابایت است.`, { requestId, stage: 'validation', retryable: false })
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
    const filename = `${nanoid()}.${ext}`
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', folder)
    await mkdir(uploadDir, { recursive: true })
    writtenPath = path.join(uploadDir, filename)
    try {
      await writeFile(writtenPath, bytes)
    } catch (e) {
      writtenPath = null
      if (isDiskFullError(e)) {
        logFa('آپلود رسانه', 'MEDIA_DISK_FULL', 'فضای ذخیره‌سازی سرور کافی نیست.', requestId, e)
        return apiErrorFa(507, 'MEDIA_DISK_FULL', 'فضای ذخیره‌سازی سرور کافی نیست.', { requestId, stage: 'storage', retryable: false })
      }
      logFa('آپلود رسانه', 'MEDIA_WRITE_FAILED', 'امکان ذخیره فایل در فضای سرور وجود ندارد.', requestId, e)
      return apiErrorFa(500, 'MEDIA_WRITE_FAILED', 'امکان ذخیره فایل در فضای سرور وجود ندارد.', { requestId, stage: 'storage', retryable: true })
    }

    const url = `/uploads/${folder}/${filename}`
    const db = getDb()
    let inserted
    try {
      await db.insert(mediaFiles).values({
        filename, originalName: file.name, mimeType: file.type, size: file.size, url, folder, alt, uploadedBy: user.id,
      })
      inserted = (await db.select().from(mediaFiles).where(eq(mediaFiles.filename, filename)))[0]
      await logAction(user, 'UPLOAD', 'media_files', inserted?.id, null, { filename, folder })
    } catch (e) {
      logFa('آپلود رسانه', 'MEDIA_DATABASE_WRITE_FAILED', 'فایل ذخیره شد اما ثبت اطلاعات آن در پایگاه داده ناموفق بود.', requestId, e)
      try { await unlink(writtenPath) } catch { /* best-effort cleanup */ }
      return apiErrorFa(500, 'MEDIA_DATABASE_WRITE_FAILED', 'فایل ذخیره شد اما ثبت اطلاعات آن در پایگاه داده ناموفق بود.', { requestId, stage: 'database', retryable: true })
    }
    return NextResponse.json({ ...(inserted ?? { url, filename, originalName: file.name, mimeType: file.type, size: file.size, folder, alt }), requestId })
  } catch (e: unknown) {
    // Anything not already handled above (malformed FormData, an unexpected
    // exception mid-request, …) — never the raw error to the client, always
    // logged server-side with the requestId that ties the two together.
    if (writtenPath) { try { await unlink(writtenPath) } catch { /* nothing to clean up */ } }
    logFa('آپلود رسانه', 'MEDIA_UNEXPECTED', 'خطای غیرمنتظره‌ای هنگام آپلود رخ داد.', requestId, e)
    return apiErrorFa(500, 'MEDIA_UNEXPECTED', 'خطای غیرمنتظره‌ای هنگام آپلود رخ داد. لطفاً دوباره تلاش کنید.', { requestId, retryable: true })
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
