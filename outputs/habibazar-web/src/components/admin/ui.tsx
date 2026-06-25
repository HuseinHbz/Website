'use client'

import { useState } from 'react'

// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#111122] border border-[#1e1e2e] rounded-xl ${className}`}>
      {children}
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
export function StatCard({
  label, value, delta, icon, color = '#6366f1',
}: { label: string; value: string | number; delta?: string; icon?: string; color?: string }) {
  return (
    <div className="bg-[#111122] border border-[#1e1e2e] rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">{label}</p>
        {icon && (
          <span className="text-lg" style={{ color }}>{icon}</span>
        )}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {delta && <p className="text-xs text-green-400 mt-1">{delta}</p>}
    </div>
  )
}

// ─── Button ───────────────────────────────────────────────────────────────────
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
  const base = 'inline-flex items-center gap-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed'
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm' }
  const variants = {
    primary: 'bg-indigo-600 hover:bg-indigo-500 text-white',
    secondary: 'bg-[#1e1e2e] hover:bg-[#2a2a3e] text-slate-300 border border-[#2a2a3e]',
    danger: 'bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30',
    ghost: 'hover:bg-white/5 text-slate-400 hover:text-white',
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

// ─── Input ────────────────────────────────────────────────────────────────────
export function Input({
  label, value, onChange, placeholder, type = 'text', required, className = '', multiline, rows = 4,
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
}) {
  const inputClass = 'w-full bg-[#0c0c14] border border-[#2a2a3e] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors'
  return (
    <div className={className}>
      {label && <label className="block text-xs text-slate-400 mb-1.5 font-medium">{label}{required && <span className="text-red-400 ml-1">*</span>}</label>}
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={inputClass}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className={inputClass}
        />
      )}
    </div>
  )
}

// ─── Select ───────────────────────────────────────────────────────────────────
export function Select({
  label, value, onChange, options, className = '',
}: {
  label?: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  className?: string
}) {
  return (
    <div className={className}>
      {label && <label className="block text-xs text-slate-400 mb-1.5 font-medium">{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#0c0c14] border border-[#2a2a3e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <div
        onClick={() => onChange(!checked)}
        className={`w-9 h-5 rounded-full transition-colors relative ${checked ? 'bg-indigo-600' : 'bg-slate-700'}`}
      >
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${checked ? 'left-4' : 'left-0.5'}`} />
      </div>
      {label && <span className="text-xs text-slate-400">{label}</span>}
    </label>
  )
}

// ─── Badge ────────────────────────────────────────────────────────────────────
export function Badge({ children, color = 'slate' }: { children: React.ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    green: 'bg-green-500/15 text-green-400',
    red: 'bg-red-500/15 text-red-400',
    yellow: 'bg-yellow-500/15 text-yellow-400',
    blue: 'bg-blue-500/15 text-blue-400',
    indigo: 'bg-indigo-500/15 text-indigo-400',
    slate: 'bg-slate-500/15 text-slate-400',
  }
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${colors[color] || colors.slate}`}>
      {children}
    </span>
  )
}

// ─── Table ────────────────────────────────────────────────────────────────────
export function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#1e1e2e]">
            {headers.map((h) => (
              <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
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
      className={`border-b border-[#1e1e2e]/50 hover:bg-white/[0.02] transition-colors ${onClick ? 'cursor-pointer' : ''}`}
    >
      {children}
    </tr>
  )
}

export function TD({ children, className = '', onClick }: { children: React.ReactNode; className?: string; onClick?: (e: React.MouseEvent) => void }) {
  return <td onClick={onClick} className={`py-3 px-4 text-slate-300 ${className}`}>{children}</td>
}

// ─── Modal ────────────────────────────────────────────────────────────────────
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${widths[size]} bg-[#111122] border border-[#1e1e2e] rounded-2xl shadow-2xl max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e1e2e]">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors text-xl leading-none">×</button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">{children}</div>
      </div>
    </div>
  )
}

// ─── Page Header ──────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h2 className="text-xl font-bold text-white">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, description, action }: {
  icon?: string; title: string; description?: string; action?: React.ReactNode
}) {
  return (
    <div className="text-center py-16">
      {icon && <div className="text-4xl mb-3">{icon}</div>}
      <h3 className="text-base font-semibold text-white mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-500 mb-4">{description}</p>}
      {action}
    </div>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────
export function useToast() {
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: 'success' | 'error' }[]>([])

  function toast(msg: string, type: 'success' | 'error' = 'success') {
    const id = Date.now()
    setToasts((t) => [...t, { id, msg, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000)
  }

  function ToastContainer() {
    return (
      <div className="fixed bottom-6 right-6 z-[100] space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-3 rounded-lg text-sm font-medium shadow-xl border ${
              t.type === 'success'
                ? 'bg-green-600/20 border-green-600/30 text-green-300'
                : 'bg-red-600/20 border-red-600/30 text-red-300'
            }`}
          >
            {t.type === 'success' ? '✓' : '✗'} {t.msg}
          </div>
        ))}
      </div>
    )
  }

  return { toast, ToastContainer }
}

// ─── Color Dot ────────────────────────────────────────────────────────────────
export function ColorDot({ color }: { color: string }) {
  return <span className="inline-block w-3 h-3 rounded-full" style={{ background: color }} />
}

// ─── Section Divider ──────────────────────────────────────────────────────────
export function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="h-px flex-1 bg-[#1e1e2e]" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">{label}</span>
      <div className="h-px flex-1 bg-[#1e1e2e]" />
    </div>
  )
}
