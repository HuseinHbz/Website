/**
 * 26.33 بند ۱ — bilingual content selection for public pages.
 *
 * Four public pages (`/events`, `/academy`, `/docs`, `/products`) read only the
 * `*En` columns and hardcoded their labels, so a Persian visitor saw an English
 * page — while the `*Fa` values sat unused in the very same rows. The pages that
 * work (technologies, industries, solutions, case studies) all repeat the same
 * `fa ? (x.nameFa || x.nameEn) : x.nameEn` expression by hand, which is exactly
 * the kind of thing that gets forgotten on the next page someone adds.
 *
 * Rule: prefer the active locale's value; fall back to the other language only
 * when the translation is genuinely missing, so a half-translated record still
 * renders instead of showing a blank card.
 *
 * Pure and unit-tested.
 */

/** A row carrying `<field>En` / `<field>Fa` columns. */
export type BilingualRow = { [key: string]: unknown }

/**
 * Read `field` in the active locale, falling back to the other language.
 * `localized(row, 'title', fa)` reads `titleFa` / `titleEn`.
 */
export function localized(row: object | null | undefined, field: string, fa: boolean): string {
  if (!row) return ''
  const r = row as Record<string, unknown>
  const cap = field.charAt(0).toUpperCase() + field.slice(1)
  const primary = r[`${field}${fa ? 'Fa' : 'En'}`] ?? r[`${cap}${fa ? 'Fa' : 'En'}`]
  const secondary = r[`${field}${fa ? 'En' : 'Fa'}`] ?? r[`${cap}${fa ? 'En' : 'Fa'}`]
  const pick = (v: unknown) => (typeof v === 'string' && v.trim() ? v : '')
  return pick(primary) || pick(secondary)
}

/** True when the row has no translation for the ACTIVE locale (fallback in use). */
export function isUntranslated(row: object | null | undefined, field: string, fa: boolean): boolean {
  if (!row) return false
  const r = row as Record<string, unknown>
  const cap = field.charAt(0).toUpperCase() + field.slice(1)
  const primary = r[`${field}${fa ? 'Fa' : 'En'}`] ?? r[`${cap}${fa ? 'Fa' : 'En'}`]
  const has = typeof primary === 'string' && primary.trim().length > 0
  return !has && localized(row, field, fa).length > 0
}

/** Pick between two literals for the active locale. For hardcoded UI labels. */
export function tr(fa: boolean, en: string, faText: string): string {
  return fa ? faText : en
}

/**
 * Bilingual label sets for the enum values these four pages render.
 *
 * These were hardcoded English strings in the JSX (`Online` / `In Person` /
 * `Hybrid`), which is why a Persian visitor saw English badges even on records
 * that were fully translated.
 */
export const EVENT_MODE_LABELS: Record<string, { en: string; fa: string }> = {
  online: { en: 'Online', fa: 'آنلاین' },
  in_person: { en: 'In person', fa: 'حضوری' },
  'in-person': { en: 'In person', fa: 'حضوری' },
  hybrid: { en: 'Hybrid', fa: 'ترکیبی' },
}

export const EVENT_STATUS_LABELS: Record<string, { en: string; fa: string }> = {
  upcoming: { en: 'Upcoming', fa: 'پیش‌رو' },
  live: { en: 'Live', fa: 'در حال برگزاری' },
  past: { en: 'Past', fa: 'برگزارشده' },
  cancelled: { en: 'Cancelled', fa: 'لغو شده' },
}

export const LEVEL_LABELS: Record<string, { en: string; fa: string }> = {
  beginner: { en: 'Beginner', fa: 'مقدماتی' },
  intermediate: { en: 'Intermediate', fa: 'متوسط' },
  advanced: { en: 'Advanced', fa: 'پیشرفته' },
  expert: { en: 'Expert', fa: 'خبره' },
}

/** Resolve a label-set entry for the active locale, falling back to the raw key. */
export function labelOf(
  set: Record<string, { en: string; fa: string }>, key: string | null | undefined, fa: boolean,
): string {
  if (!key) return ''
  const entry = set[key] ?? set[key.toLowerCase().replace(/[\s-]/g, '_')]
  return entry ? (fa ? entry.fa : entry.en) : key
}

/**
 * 26.33 بند ۱.۴ — which records still have no translation?
 *
 * Falling back to the other language keeps the public site readable, but it also
 * hides the gap: the operator has no way to see that a record is showing English
 * to Persian visitors. `missingTranslations` names the fields that fell back, so
 * the admin list can flag the row and the work becomes finishable.
 */
export function missingTranslations(
  row: object | null | undefined, fields: string[], fa: boolean,
): string[] {
  if (!row) return []
  return fields.filter(f => isUntranslated(row, f, fa))
}

/** Short badge text for a row that is falling back to the other language. */
export function untranslatedLabel(fa: boolean, count: number): string {
  if (count <= 0) return ''
  return fa ? 'ترجمهٔ فارسی ندارد' : 'No English translation'
}
