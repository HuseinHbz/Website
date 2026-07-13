/**
 * Data cleansing & normalization (Phase 26.19, PART 1). Pure, deterministic
 * helpers run BEFORE validation so a legacy export's "۰۹۱۲ ۳۴۵-۶۷۸۹" and
 * "0912 345 6789" both become the same canonical value. Reused by the Import
 * Center validation pipeline; validators themselves stay in masterdata/quality.
 */

/** Persian/Arabic-Indic digits → Latin. */
export function latinDigits(s: string): string {
  return s
    .replace(/[۰-۹]/g, ch => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(ch)))
    .replace(/[٠-٩]/g, ch => String('٠١٢٣٤٥٦٧٨٩'.indexOf(ch)))
}

/**
 * Normalize an Iranian phone/mobile: Persian digits → Latin, strip separators,
 * +98/0098/98 prefixes → leading 0. Non-phone garbage is returned trimmed.
 */
export function normalizePhone(raw: string): string {
  const s = latinDigits(raw).replace(/[\s\-().]/g, '')
  if (s === '') return ''
  let n = s
  if (n.startsWith('+98')) n = '0' + n.slice(3)
  else if (n.startsWith('0098')) n = '0' + n.slice(4)
  else if (/^98\d{10}$/.test(n)) n = '0' + n.slice(2)
  else if (/^9\d{9}$/.test(n)) n = '0' + n
  return /^\d+$/.test(n) ? n : raw.trim()
}

/** Lowercase, trim, drop zero-width chars. */
export function normalizeEmail(raw: string): string {
  return raw.replace(/[​-‏﻿]/g, '').trim().toLowerCase()
}

/** National code: Persian digits → Latin, strip separators, left-pad to 10. */
export function normalizeNationalCode(raw: string): string {
  const s = latinDigits(raw).replace(/[\s\-]/g, '')
  if (!/^\d{1,10}$/.test(s)) return raw.trim()
  return s.padStart(10, '0')
}

/** Economic code: Persian digits → Latin, digits only. */
export function normalizeEconomicCode(raw: string): string {
  const s = latinDigits(raw).replace(/[\s\-]/g, '')
  return /^\d+$/.test(s) ? s : raw.trim()
}

/** Generic number text: Persian digits + ٬/، thousand marks → parseable. */
export function normalizeNumberText(raw: string): string {
  return latinDigits(raw).replace(/[٬،]/g, ',').replace(/٫/g, '.').trim()
}

/** Field-aware cleansing applied to a mapped import record (strings only). */
export function cleanseRecord(rec: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(rec)) {
    if (v == null) { out[k] = v; continue }
    if (/phone|mobile/i.test(k)) out[k] = normalizePhone(v)
    else if (/email/i.test(k)) out[k] = normalizeEmail(v)
    else if (/nationalid/i.test(k)) out[k] = normalizeNationalCode(v)
    else if (/economiccode/i.test(k)) out[k] = normalizeEconomicCode(v)
    else if (/qty|amount|price|cost|debit|credit|limit/i.test(k)) out[k] = normalizeNumberText(v)
    else out[k] = v.trim()
  }
  return out
}
