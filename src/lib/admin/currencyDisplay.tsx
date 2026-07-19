'use client'

/**
 * Dashboard display-currency preference (Phase 26.8).
 *
 * A per-user, display-time currency layer: dashboards aggregate in the Rial
 * base and this context converts those Rial figures into the user's chosen
 * currency (IRR/IRT/USD/EUR/AED) with the latest daily rates — NO stored
 * document is ever mutated. The preference persists per user in localStorage.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { formatCurrency, setDefaultCurrency, convertFromBase } from '@/lib/format'
import type { RateMap } from '@/lib/erp/currency'

export const DISPLAY_CURRENCIES = ['IRR', 'IRT', 'USD', 'EUR', 'AED'] as const

interface Ctx {
  /** Selected display currency. */
  target: string
  setTarget: (code: string) => void
  /** Latest Rial rates (code → Rial per unit). */
  rates: RateMap
  /** Format a Rial-base aggregate in the display currency. */
  money: (rialAmount: number | null | undefined) => string
  /** True when the target's rate is known (IRR/IRT always are). */
  rateKnown: boolean
}

const CurrencyDisplayContext = createContext<Ctx>({
  target: 'IRR', setTarget: () => {}, rates: {}, money: n => formatCurrency(n, 'IRR'), rateKnown: true,
})

const STORE_KEY = 'hbz.displayCurrency'

export function CurrencyDisplayProvider({ userId, children }: { userId?: string; children: React.ReactNode }) {
  const key = userId ? `${STORE_KEY}.${userId}` : STORE_KEY
  const [target, setTargetState] = useState('IRR')
  const [rates, setRates] = useState<RateMap>({ IRR: 1, IRT: 10 })

  useEffect(() => {
    try { const saved = localStorage.getItem(key); if (saved) setTargetState(saved) } catch { /* ssr/blocked */ }
    fetch('/api/admin/erp/finance/currency').then(r => r.ok ? r.json() : null).then(d => {
      if (!d?.currencies) return
      const map: RateMap = { IRR: 1, IRT: 10 }
      for (const c of d.currencies as { code: string; latestRate: number | null }[]) {
        if (c.latestRate != null) map[c.code] = Number(c.latestRate)
      }
      setRates(map)
    }).catch(() => {})
  }, [key])

  const setTarget = useCallback((code: string) => {
    setTargetState(code)
    try { localStorage.setItem(key, code) } catch { /* best effort */ }
    setDefaultCurrency(code) // fmtMoney default symbol follows the preference
  }, [key])

  const rateKnown = target === 'IRR' || target === 'IRT' || rates[target] != null
  const money = useCallback((rial: number | null | undefined) => {
    if (!rateKnown) return formatCurrency(rial ?? 0, 'IRR')
    const v = convertFromBase(rial ?? 0, target, rates)
    return formatCurrency(v, target, { max: target === 'IRR' || target === 'IRT' ? 0 : 2 })
  }, [target, rates, rateKnown])

  const value = useMemo(() => ({ target, setTarget, rates, money, rateKnown }), [target, setTarget, rates, money, rateKnown])
  return <CurrencyDisplayContext.Provider value={value}>{children}</CurrencyDisplayContext.Provider>
}

export function useDisplayCurrency(): Ctx {
  return useContext(CurrencyDisplayContext)
}

/** The dashboard currency switcher (compact select). */
export function CurrencyPicker({ fa }: { fa?: boolean }) {
  const { target, setTarget, rateKnown } = useDisplayCurrency()
  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-text-tertiary">
      <span aria-hidden>💱</span>
      <select
        value={target}
        onChange={e => setTarget(e.target.value)}
        aria-label={fa ? 'ارز نمایش داشبورد' : 'Dashboard display currency'}
        className="bg-surface-2 border border-subtle rounded-lg px-2 py-1 text-xs text-text-secondary focus:outline-none focus:border-brand"
      >
        {DISPLAY_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      {!rateKnown && <span className="text-warning-text">{fa ? 'نرخ تنظیم نشده' : 'no rate set'}</span>}
    </label>
  )
}
