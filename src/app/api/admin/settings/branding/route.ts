import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { apiError, guardJson, requirePermission } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { getBrandSettings, writeBrandSettings, DEFAULT_BRAND, type BrandSettings } from '@/lib/branding/settings'

// Phase — Brand & Identity Settings. GET/PUT the text fields only (name,
// subtitle, browser titles, page-title template, logo alt text). Logo
// upload/removal is its own route (multipart, different validation shape) —
// see `./logo/route.ts`.

const TEXT_FIELDS: (keyof BrandSettings)[] = [
  'brandNameFa', 'brandNameEn', 'brandSubtitleFa', 'brandSubtitleEn',
  'homepageTitleFa', 'homepageTitleEn', 'pageTitleTemplateFa', 'pageTitleTemplateEn',
  'logoAltFa', 'logoAltEn',
]
const MAX_FIELD_LEN = 200

export async function GET() {
  const auth = await requirePermission('system.settings.branding', 'read', 'manage_settings')
  if ('error' in auth) return auth.error
  try {
    const brand = await getBrandSettings()
    return NextResponse.json({ ...brand, defaults: DEFAULT_BRAND })
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requirePermission('system.settings.branding', 'write', 'manage_settings')
  if ('error' in auth) return auth.error
  try {
    const body = await guardJson(req) as Record<string, unknown>
    const before = await getBrandSettings()
    const patch: Partial<Record<keyof BrandSettings, string>> = {}
    for (const field of TEXT_FIELDS) {
      if (!(field in body)) continue
      const v = body[field]
      if (typeof v !== 'string') return NextResponse.json({ error: `${field} must be a string` }, { status: 400 })
      if (v.length > MAX_FIELD_LEN) return NextResponse.json({ error: `${field} exceeds ${MAX_FIELD_LEN} characters` }, { status: 400 })
      patch[field] = v.trim()
    }
    // The page-title template must actually carry the substitution token —
    // otherwise every internal page title collapses to the same static string.
    for (const tf of ['pageTitleTemplateFa', 'pageTitleTemplateEn'] as const) {
      if (patch[tf] !== undefined && !patch[tf]!.includes('{{pageTitle}}')) {
        return NextResponse.json({ error: `${tf} must contain the {{pageTitle}} placeholder` }, { status: 400 })
      }
    }
    await writeBrandSettings(patch, auth.user?.id ?? null)
    // Audit: old → new, field by field (not just the raw body — a real diff).
    const changed: Record<string, { from: string; to: string }> = {}
    for (const field of Object.keys(patch) as (keyof BrandSettings)[]) {
      if (before[field] !== patch[field]) changed[field] = { from: before[field], to: patch[field]! }
    }
    await logAction(auth.user, 'UPDATE', 'site_settings', 'branding', before, changed)

    revalidatePath('/en')
    revalidatePath('/fa')
    revalidatePath('/', 'layout')

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return apiError(e)
  }
}

/** Reset every branding field back to the built-in defaults (deletes the
 *  overriding rows rather than writing DEFAULT_BRAND's values verbatim, so a
 *  future code-level default change still applies automatically). */
export async function DELETE() {
  const auth = await requirePermission('system.settings.branding', 'write', 'manage_settings')
  if ('error' in auth) return auth.error
  try {
    const { getDb } = await import('@/lib/db')
    const { siteSettings } = await import('@/lib/db/schema')
    const { inArray } = await import('drizzle-orm')
    const { BRAND_SETTING_KEYS } = await import('@/lib/branding/settings')
    const db = getDb()
    const before = await getBrandSettings()
    // Keep logo_url/logo_version (the logo route owns those) — this endpoint
    // resets TEXT fields only; use the logo route's own DELETE to reset the logo.
    const textKeys = BRAND_SETTING_KEYS.filter(k => k !== 'logo_url' && k !== 'logo_version')
    await db.delete(siteSettings).where(inArray(siteSettings.key, textKeys))
    await logAction(auth.user, 'UPDATE', 'site_settings', 'branding-reset', before, DEFAULT_BRAND)
    revalidatePath('/en')
    revalidatePath('/fa')
    revalidatePath('/', 'layout')
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return apiError(e)
  }
}
