/**
 * Media asset naming — Phase (Media Upload fix). Pure, dependency-free.
 *
 * The physical filename is derived from the operator-typed English name
 * (never a random id, never the browser's original filename), matching the
 * maintainer's explicit requirement: "نام فیزیکی فایل بر اساس نام انگلیسی
 * ذخیره شود، نه نام تصادفی یا نام اصلی فایل."
 */

/** English name → kebab-case slug. Transliteration-free (Latin input only —
 *  the English-name field is validated separately to reject empty/short values). */
export function toKebabSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')   // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/** `asset-name` + `.ext`, `asset-name-2.ext`, `asset-name-3.ext`, … — the
 *  exact "asset-name-2.ext" pattern the spec calls for on auto-rename. */
export function uniqueFilename(slug: string, ext: string, existing: ReadonlySet<string>): string {
  const base = `${slug}.${ext}`
  if (!existing.has(base)) return base
  for (let n = 2; n < 10000; n++) {
    const candidate = `${slug}-${n}.${ext}`
    if (!existing.has(candidate)) return candidate
  }
  // Unreachable in practice; last-resort fallback that is still deterministic.
  return `${slug}-${Date.now()}.${ext}`
}

export interface NameValidation { ok: boolean; error?: string }

/** 2–80 chars, per the spec's form validation for both English and Persian names. */
export function validateAssetName(name: string, fieldLabel: string): NameValidation {
  const trimmed = name.trim()
  if (trimmed.length < 2) return { ok: false, error: `${fieldLabel} must be at least 2 characters` }
  if (trimmed.length > 80) return { ok: false, error: `${fieldLabel} must be at most 80 characters` }
  return { ok: true }
}
