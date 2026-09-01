'use client'

/**
 * Admin UI Component Layer
 * Thin wrappers over the DS — all visual values from CSS custom properties.
 * No hardcoded hex colors.
 */

import { useState, useCallback, useId } from 'react'
import { JalaliDatePicker } from './JalaliDatePicker'

// ── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-surface border border-border rounded-xl ${className}`}>
      {children}
    </div>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
export function StatCard({
  label, value, delta, icon, color,
}: { label: string; value: string | number; delta?: string; icon?: string; color?: string }) {
  return (
    <div className="metric-card">
      <div className="flex items-start justify-between mb-3">
        <p className="text-overline">{label}</p>
        {icon && <span className="text-lg text-text-tertiary" style={color ? { color } : undefined} aria-hidden>{icon}</span>}
      </div>
      {/* break-words + min-w-0 so a long money value (e.g. fa Rial) wraps instead
          of overflowing the grid cell's right edge (26.26b BUG-019). */}
      <p className="text-3xl font-bold text-text-primary tracking-tight break-words min-w-0">{value}</p>
      {delta && <p className="text-xs text-success-text font-medium mt-2">{delta}</p>}
    </div>
  )
}

// ── Button ────────────────────────────────────────────────────────────────────
export function Btn({
  children, onClick, variant = 'primary', size = 'md', disabled, type = 'button', className = '',
}: {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md'
  disabled?: boolean
  type?: 'button' | 'submit'
  className?: string
}) {
  const base = 'inline-flex items-center gap-2 rounded-lg font-semibold transition-all duration-fast disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background'
  const sizes = {
    sm: 'px-3 py-1.5 text-xs h-7',
    md: 'px-4 py-2 text-sm h-9',
  }
  const variants = {
    primary:   'bg-brand hover:bg-brand-hover text-white shadow-brand hover:shadow-brand-lg',
    secondary: 'bg-surface-2 hover:bg-surface text-text-primary border border-border hover:border-border-strong',
    danger:    'bg-danger-muted hover:bg-danger/20 text-danger-text border border-danger/20 hover:border-danger/40',
    ghost:     'hover:bg-white/5 text-text-secondary hover:text-text-primary',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

// ── Input ─────────────────────────────────────────────────────────────────────
export function Input({
  label, value, onChange, placeholder, type = 'text', required, className = '', multiline, rows = 4,
  disabled,
}: {
  label?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  required?: boolean
  className?: string
  multiline?: boolean
  rows?: number
  /** Read-only state — e.g. a frozen payroll ruleset that already issued slips. */
  disabled?: boolean
}) {
  // The label was never associated with its control (no htmlFor/id, no
  // aria-label) across every single usage of this shared primitive — real
  // impact, not just a lint nicety: a screen reader announces the input
  // with no name at all, clicking the label text doesn't focus the field,
  // and Playwright's own getByLabel() (the standard, recommended a11y-first
  // locator) can't find it either — found via a genuine E2E test failure,
  // not a manual audit. useId() is additive-only: same markup/styling,
  // just wired up.
  const id = useId()
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="form-label">
          {label}
          {required && <span className="text-danger ml-1" aria-hidden>*</span>}
        </label>
      )}
      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          className="form-input py-2.5 resize-none disabled:opacity-60"
        />
      ) : type === 'date' ? (
        // A real Jalali calendar in fa, the native Gregorian picker in en —
        // same ISO value/onChange contract either way, so this is a drop-in
        // swap for every existing `<Input type="date">` call site.
        <JalaliDatePicker id={id} value={value} onChange={onChange} disabled={disabled} className="h-9 disabled:opacity-60" />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className="form-input h-9 disabled:opacity-60"
        />
      )}
    </div>
  )
}

// ── Select ────────────────────────────────────────────────────────────────────
export function Select({
  label, value, onChange, options, className = '',
}: {
  label?: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  className?: string
}) {
  const id = useId()
  return (
    <div className={className}>
      {label && <label htmlFor={id} className="form-label">{label}</label>}
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="form-input h-9 pr-9 appearance-none cursor-pointer"
        >
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" aria-hidden>▾</span>
      </div>
    </div>
  )
}

// ── Toggle / Switch ───────────────────────────────────────────────────────────
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <div
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onClick={() => onChange(!checked)}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-all duration-moderate ease-spring focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
          checked ? 'bg-brand' : 'bg-border-strong'
        }`}
      >
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-surface shadow-sm transition-all duration-moderate ease-spring ${
          checked ? 'left-5' : 'left-0.5'
        }`} />
      </div>
      {label && <span className="text-sm text-text-secondary">{label}</span>}
    </label>
  )
}

// ── Badge ─────────────────────────────────────────────────────────────────────
export function Badge({ children, color = 'slate' }: { children: React.ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    green:  'bg-success-muted text-success-text',
    red:    'bg-danger-muted  text-danger-text',
    yellow: 'bg-warning-muted text-warning-text',
    blue:   'bg-info-muted    text-info-text',
    indigo: 'bg-brand-muted   text-brand-hover',
    slate:  'bg-surface-2     text-text-secondary border border-border',
  }
  return (
    <span className={`inline-flex items-center text-3xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-widest ${colors[color] ?? colors.slate}`}>
      {children}
    </span>
  )
}

// ── Table ─────────────────────────────────────────────────────────────────────
export function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {headers.map(h => (
              <th key={h} className="text-start py-3 px-4 text-overline text-text-tertiary font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function TR({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <tr
      onClick={onClick}
      className={`border-b border-border/50 transition-colors duration-fast ${
        onClick ? 'cursor-pointer hover:bg-white/[0.025]' : 'hover:bg-white/[0.015]'
      }`}
    >
      {children}
    </tr>
  )
}

export function TD({
  children, className = '', onClick, colSpan,
}: { children: React.ReactNode; className?: string; onClick?: (e: React.MouseEvent) => void; colSpan?: number }) {
  return (
    <td onClick={onClick} colSpan={colSpan} className={`py-3 px-4 text-text-secondary ${className}`}>
      {children}
    </td>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({
  open, onClose, title, children, size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  if (!open) return null
  const widths = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' }
  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4" role="dialog" aria-modal aria-label={title}>
      <div className="absolute inset-0 bg-overlay backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className={`relative w-full ${widths[size]} bg-surface border border-border rounded-2xl shadow-2xl max-h-[90vh] flex flex-col animate-scale-in`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-tertiary hover:text-text-primary hover:bg-white/5 transition-all duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
              <path d="M4.28 3.22a.75.75 0 0 0-1.06 1.06L6.94 8l-3.72 3.72a.75.75 0 1 0 1.06 1.06L8 9.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L9.06 8l3.72-3.72a.75.75 0 0 0-1.06-1.06L8 6.94 4.28 3.22z"/>
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">{children}</div>
      </div>
    </div>
  )
}

// ── Page Header ───────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h2 className="text-xl font-bold text-text-primary tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-text-tertiary mt-1">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, description, action }: {
  icon?: string; title: string; description?: string; action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && (
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 text-3xl bg-surface-2 border border-border text-text-tertiary">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-text-primary mb-1.5">{title}</h3>
      {description && <p className="text-sm text-text-secondary mb-5 max-w-xs leading-relaxed">{description}</p>}
      {action}
    </div>
  )
}

// ── Toast ─────────────────────────────────────────────────────────────────────
export function useToast() {
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: 'success' | 'error' | 'info' }[]>([])

  // Memoized so effects that depend on `toast` (e.g. `[toast]` deps) don't
  // re-run on every render — an unstable toast caused load effects to refetch
  // in a loop and overwrite user input in forms.
  const toast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now()
    setToasts(t => [...t.slice(-3), { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }, [])

  function ToastContainer() {
    const styles = {
      success: 'bg-success-muted border-success/25 text-success-text',
      error:   'bg-danger-muted  border-danger/25  text-danger-text',
      info:    'bg-info-muted    border-info/25    text-info-text',
    }
    const icons = { success: '✓', error: '✕', info: 'ℹ' }
    return (
      <div className="fixed bottom-5 right-5 z-toast space-y-2 pointer-events-none" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium shadow-xl border backdrop-blur-glass animate-slide-in-right ${styles[t.type]}`}>
            <span aria-hidden>{icons[t.type]}</span>
            {t.msg}
          </div>
        ))}
      </div>
    )
  }

  return { toast, ToastContainer }
}

// ── Color Dot ─────────────────────────────────────────────────────────────────
export function ColorDot({ color }: { color: string }) {
  return <span className="inline-block w-3 h-3 rounded-full border border-white/10" style={{ background: color }} />
}

// ── Section Divider ───────────────────────────────────────────────────────────
export function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-4" aria-hidden>
      <div className="h-px flex-1 bg-border" />
      <span className="text-overline text-text-disabled">{label}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
}
