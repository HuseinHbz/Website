'use client'

/**
 * 26.33 بند ۱.۴ — flags a record that is falling back to the other language.
 *
 * The public site falls back so a half-translated record still renders, but that
 * fallback is silent: an operator browsing the admin list cannot tell which rows
 * are showing the wrong language to visitors. This makes the gap visible, and
 * therefore fixable.
 */
import { useAdminLocale } from '@/lib/admin/locale'
import { missingTranslations, untranslatedLabel } from '@/lib/localizedContent'

export function UntranslatedBadge({ row, fields }: { row: object; fields: string[] }) {
  const fa = useAdminLocale() === 'fa'
  const missing = missingTranslations(row, fields, fa)
  if (missing.length === 0) return null
  return (
    <span
      title={missing.join(', ')}
      className="ms-2 inline-flex items-center rounded px-1.5 py-0.5 text-3xs font-medium bg-warning/15 text-warning border border-warning/30"
    >
      {untranslatedLabel(fa, missing.length)}
    </span>
  )
}
