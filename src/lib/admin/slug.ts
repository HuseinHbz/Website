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

/** True when the operator did not type a slug, so the server derived it. */
export function slugWasDerived(body: Record<string, unknown>): boolean {
  return !(typeof body.slug === 'string' && body.slug.trim())
}

/**
 * Pick the next free variant of a derived slug: `guide`, `guide-2`, `guide-3`…
 * Pure (the caller supplies the taken set), so the policy is unit-testable.
 */
export function nextFreeSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  if (!used.has(base)) return base
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`
    if (!used.has(candidate)) return candidate
  }
  return `${base}-${Date.now().toString(36)}`
}

/**
 * 26.32 — the audit created "A32 Doc" twice and the second attempt died with
 * `Duplicate slug`. That error is honest but UNACTIONABLE: these forms have no
 * slug field, so the operator is told to fix something they cannot see, and the
 * module reads as broken again (the exact 26.29 symptom, one layer down).
 *
 * A slug the OPERATOR typed must still collide loudly — that is their unique
 * key and silently renaming it would break their URL. A slug the SERVER derived
 * carries no such promise, so it is disambiguated instead.
 */
export async function ensureUniqueSlug<T extends Record<string, unknown>>(
  body: T, table: string, prefix = 'item',
): Promise<T> {
  const withSlug = ensureSlug(body, prefix)
  if (!slugWasDerived(body)) return withSlug
  const base = String(withSlug.slug)
  // A table name cannot be a bound parameter, so it is whitelisted by shape and
  // only ever passed as a hardcoded literal from a route — never from a request.
  if (!/^[a-z_][a-z0-9_]*$/.test(table)) return withSlug
  const { pgQuery } = await import('@/lib/db')
  const rows = await pgQuery<{ slug: string }>(
    `SELECT slug FROM ${table} WHERE slug = $1 OR slug LIKE $2`, [base, `${base}-%`],
  ).catch(() => [] as { slug: string }[])
  return { ...withSlug, slug: nextFreeSlug(base, rows.map(r => r.slug)) }
}
