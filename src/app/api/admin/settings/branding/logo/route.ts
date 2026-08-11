import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { mkdir, writeFile, unlink } from 'fs/promises'
import path from 'path'
import { nanoid } from 'nanoid'
import { apiError, requirePermission } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { getBrandSettings, writeBrandSettings } from '@/lib/branding/settings'
import { validateLogoUpload, sanitizeSvg, extensionFor } from '@/lib/branding/fileValidation'

// Logo upload/removal for the Brand & Identity settings — deliberately its
// own route (not the generic /api/admin/media) because a logo has extra
// rules a normal media asset doesn't: it drives the favicon (so only PNG/
// WebP/SVG/ICO are accepted, never video/PDF/etc.), and switching it must
// bump a version stamp for cache-busting.

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'branding')

export async function POST(req: NextRequest) {
  const auth = await requirePermission('system.settings.branding', 'write', 'manage_settings')
  if ('error' in auth) return auth.error
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const bytes = Buffer.from(await file.arrayBuffer())
    const check = validateLogoUpload(bytes, file.type)
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 })

    let toWrite = bytes
    if (check.kind === 'svg') {
      const clean = sanitizeSvg(bytes.toString('utf8'))
      if (!clean) return NextResponse.json({ error: 'SVG failed sanitization' }, { status: 400 })
      toWrite = Buffer.from(clean, 'utf8')
    }

    // A random filename — never the client-supplied name — so nothing can
    // path-traverse or overwrite an unrelated file via a crafted name.
    const filename = `logo-${nanoid()}.${extensionFor(check.kind!)}`
    await mkdir(UPLOAD_DIR, { recursive: true })
    await writeFile(path.join(UPLOAD_DIR, filename), toWrite)

    const before = await getBrandSettings()
    const url = `/uploads/branding/${filename}`
    const version = String(Date.now())
    await writeBrandSettings({ logoUrl: url, logoVersion: version }, auth.user?.id ?? null)

    // Best-effort cleanup of the previous custom logo file — the DB pointer
    // already moved to the new one before this runs, so a failure here never
    // leaves the site pointing at a missing file.
    if (before.logoUrl && before.logoUrl.startsWith('/uploads/branding/')) {
      try { await unlink(path.join(process.cwd(), 'public', before.logoUrl)) } catch { /* already gone / never existed */ }
    }

    await logAction(auth.user, 'UPDATE', 'site_settings', 'branding-logo', { logoUrl: before.logoUrl }, { logoUrl: url })

    revalidatePath('/en')
    revalidatePath('/fa')
    revalidatePath('/', 'layout')

    return NextResponse.json({ ok: true, url: `${url}?v=${version}`, kind: check.kind })
  } catch (e: unknown) {
    return apiError(e)
  }
}

/** Remove the custom logo and fall back to the built-in "HBZ" badge/favicon. */
export async function DELETE() {
  const auth = await requirePermission('system.settings.branding', 'write', 'manage_settings')
  if ('error' in auth) return auth.error
  try {
    const before = await getBrandSettings()
    await writeBrandSettings({ logoUrl: '', logoVersion: String(Date.now()) }, auth.user?.id ?? null)
    if (before.logoUrl && before.logoUrl.startsWith('/uploads/branding/')) {
      try { await unlink(path.join(process.cwd(), 'public', before.logoUrl)) } catch { /* already gone */ }
    }
    await logAction(auth.user, 'UPDATE', 'site_settings', 'branding-logo', { logoUrl: before.logoUrl }, { logoUrl: '' })

    revalidatePath('/en')
    revalidatePath('/fa')
    revalidatePath('/', 'layout')

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return apiError(e)
  }
}
