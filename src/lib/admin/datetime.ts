/**
 * 26.29 بند ۶ — one date/time formatter for the admin, so "Last login" reads the
 * same in Security and in Users. Persian locale → Jalali date + Persian digits;
 * English → ISO-ish date. Always includes the TIME (the old column showed only a
 * date, which is useless for spotting a suspicious login).
 */
import { toJalaliStr } from '@/lib/erp/jalali'

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'

/** Latin digits → Persian digits. */
export function faDigits(s: string): string {
  return s.replace(/[0-9]/g, d => FA_DIGITS[Number(d)])
}

/** `2026-08-02 14:31:07` / ISO → `{ date, time }` parts, in local terms. */
export function splitStamp(value: string): { date: string; time: string } | null {
  if (!value) return null
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(value)
  if (m) return { date: m[1], time: m[2] }
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

/**
 * Format a timestamp for the admin UI: date AND time, Jalali + Persian digits
 * in fa. Returns the "never" placeholder when there is no value.
 */
export function formatDateTime(value: string | null | undefined, locale: 'fa' | 'en' = 'fa'): string {
  if (!value) return locale === 'fa' ? 'هرگز' : 'Never'
  const parts = splitStamp(value)
  if (!parts) return locale === 'fa' ? 'هرگز' : 'Never'
  if (locale === 'fa') return faDigits(`${toJalaliStr(parts.date)} ${parts.time}`)
  return `${parts.date} ${parts.time}`
}
