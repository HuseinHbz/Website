'use client'

/**
 * A real Jalali (Shamsi) calendar picker — not just Jalali TEXT formatting
 * (`formatDateTime`/`toJalaliStr` already existed for that), but an actual
 * calendar grid an operator can click through in Persian, month names,
 * Persian digits, year navigation, "امروز" (today). In English locale this
 * renders the plain native browser date input (Gregorian, which the
 * platform already does correctly) — so the ONLY behavior change is what
 * UI a Persian-locale operator sees; the value/onChange contract is always
 * a plain ISO `YYYY-MM-DD` string either way, so every existing caller of
 * `<Input type="date">` needs zero changes downstream.
 */
import { useEffect, useRef, useState } from 'react'
import { toJalali, toGregorian } from '@/lib/erp/jalali'
import { faDigits } from '@/lib/admin/chartRtl'
import { useAdminLocale, useT } from '@/lib/admin/locale'

const MONTH_NAMES_FA = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']
const WEEKDAY_LABELS_FA = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'] // starts Saturday

function pad2(n: number): string { return String(n).padStart(2, '0') }

function daysInJalaliMonth(jy: number, jm: number): number {
  const nextJy = jm === 12 ? jy + 1 : jy
  const nextJm = jm === 12 ? 1 : jm + 1
  const [gy, gm, gd] = toGregorian(nextJy, nextJm, 1)
  const d = new Date(Date.UTC(gy, gm - 1, gd))
  d.setUTCDate(d.getUTCDate() - 1)
  const back = toJalali(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
  return back[2]
}

/** JS getUTCDay() (0=Sun..6=Sat) → Persian week position (0=Sat..6=Fri). */
function persianWeekday(gy: number, gm: number, gd: number): number {
  const jsDay = new Date(Date.UTC(gy, gm - 1, gd)).getUTCDay()
  return (jsDay + 1) % 7
}

function todayJalali(): [number, number, number] {
  const now = new Date()
  return toJalali(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

function isoToJalali(iso: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  if (!m) return null
  return toJalali(Number(m[1]), Number(m[2]), Number(m[3]))
}

function jalaliToIso(jy: number, jm: number, jd: number): string {
  const [gy, gm, gd] = toGregorian(jy, jm, jd)
  return `${gy}-${pad2(gm)}-${pad2(gd)}`
}

interface Props {
  value: string           // ISO YYYY-MM-DD, always Gregorian on the wire
  onChange: (iso: string) => void
  id?: string
  disabled?: boolean
  className?: string
}

function JalaliCalendarBody({ value, onChange, onPicked }: { value: string; onChange: (iso: string) => void; onPicked: () => void }) {
  const t = useT()
  const initial = isoToJalali(value) ?? todayJalali()
  const [viewYear, setViewYear] = useState(initial[0])
  const [viewMonth, setViewMonth] = useState(initial[1])
  const selected = isoToJalali(value)
  const today = todayJalali()

  const dim = daysInJalaliMonth(viewYear, viewMonth)
  const [gy1, gm1, gd1] = toGregorian(viewYear, viewMonth, 1)
  const startOffset = persianWeekday(gy1, gm1, gd1)
  const cells: (number | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)]

  function prevMonth() {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1) } else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1) } else setViewMonth(m => m + 1)
  }
  function pick(day: number) {
    onChange(jalaliToIso(viewYear, viewMonth, day))
    onPicked()
  }
  function pickToday() {
    onChange(jalaliToIso(today[0], today[1], today[2]))
    setViewYear(today[0]); setViewMonth(today[1])
    onPicked()
  }

  return (
    <div className="p-3 w-72 select-none" dir="rtl">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={prevMonth} className="w-7 h-7 rounded-lg hover:bg-white/10 text-text-secondary flex items-center justify-center" aria-label={t('jdp_prevMonth')}>›</button>
        <div className="flex items-center gap-1 text-sm font-semibold text-text-primary">
          <span>{MONTH_NAMES_FA[viewMonth - 1]}</span>
          <span className="tabular-nums">{faDigits(viewYear)}</span>
        </div>
        <button type="button" onClick={nextMonth} className="w-7 h-7 rounded-lg hover:bg-white/10 text-text-secondary flex items-center justify-center" aria-label={t('jdp_nextMonth')}>‹</button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {WEEKDAY_LABELS_FA.map((w, i) => (
          <div key={i} className="text-3xs text-text-tertiary text-center py-1 font-medium">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />
          const isSelected = !!selected && selected[0] === viewYear && selected[1] === viewMonth && selected[2] === day
          const isToday = today[0] === viewYear && today[1] === viewMonth && today[2] === day
          return (
            <button
              key={i} type="button" onClick={() => pick(day)}
              className={`h-8 rounded-lg text-xs tabular-nums transition-colors ${
                isSelected ? 'bg-brand text-white font-semibold'
                  : isToday ? 'border border-brand/60 text-brand font-medium'
                    : 'text-text-secondary hover:bg-white/10'
              }`}
            >{faDigits(day)}</button>
          )
        })}
      </div>
      <div className="mt-2 pt-2 border-t border-border/40 flex justify-center">
        <button type="button" onClick={pickToday} className="text-xs text-brand hover:underline">{t('jdp_today')}</button>
      </div>
    </div>
  )
}

export function JalaliDatePicker({ value, onChange, id, disabled, className = '' }: Props) {
  const locale = useAdminLocale()
  const t = useT()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  // English locale: the native Gregorian picker is already correct and
  // familiar — no reason to replace it. Only fa gets the Jalali calendar.
  if (locale !== 'fa') {
    return (
      <input id={id} type="date" value={value} disabled={disabled} onChange={e => onChange(e.target.value)}
        className={`form-input ${className}`} />
    )
  }

  const jd = isoToJalali(value)
  const display = jd ? faDigits(`${jd[0]}/${pad2(jd[1])}/${pad2(jd[2])}`) : ''

  return (
    <div className="relative" ref={ref}>
      <button
        type="button" id={id} disabled={disabled} onClick={() => setOpen(o => !o)}
        className={`form-input text-start flex items-center justify-between ${className}`}
      >
        <span className={display ? 'text-text-primary' : 'text-text-tertiary'}>{display || t('jdp_pickDate')}</span>
        <span aria-hidden className="text-text-tertiary">📅</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 rounded-xl border border-border bg-surface-1 shadow-xl">
          <JalaliCalendarBody value={value} onChange={onChange} onPicked={() => setOpen(false)} />
        </div>
      )}
    </div>
  )
}
