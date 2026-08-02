/**
 * 26.29 BUG-101..109 root fix — server-side slug generation.
 *
 * Many CMS tables declare `slug NOT NULL UNIQUE`, but several admin forms leave
 * the field blank (it is an SEO detail, not something an operator thinks about).
 * The insert then failed with a generic 500 and the UI only said "Failed", which
 * is exactly why whole modules were reported as "not working".
 *
 * Rule: if the client sends no slug, derive one from the record's name/title.
 * Pure and unit-tested — the routes just call `ensureSlug`.
 */

/** Latin/Persian-safe slugify: keeps a-z0-9 and Persian/Arabic letters. */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[‌\s_]+/g, '-')                       // ZWNJ + whitespace → dash
    .replace(/[^a-z0-9؀-ۿ-]/g, '')             // drop punctuation/symbols
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

/** First non-empty candidate, slugified. Empty when nothing usable is given. */
export function slugFrom(...candidates: Array<unknown>): string {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) {
      const s = slugify(c)
      if (s) return s
    }
  }
  return ''
}

/**
 * Fill a missing `slug` on a create payload from the usual name/title fields.
 * Falls back to a timestamped id so an insert never fails on a NOT NULL slug.
 * Never overwrites a slug the operator typed.
 */
export function ensureSlug<T extends Record<string, unknown>>(body: T, prefix = 'item'): T {
  const current = typeof body.slug === 'string' ? body.slug.trim() : ''
  if (current) return { ...body, slug: slugify(current) || current }
  const derived = slugFrom(
    body.slug, body.nameEn, body.titleEn, body.name, body.title,
    body.nameFa, body.titleFa, body.labelEn, body.key,
  )
  return { ...body, slug: derived || `${prefix}-${Date.now().toString(36)}` }
}
