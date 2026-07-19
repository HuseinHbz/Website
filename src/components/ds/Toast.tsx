'use client'

import { useState, useCallback, useEffect, createContext, useContext, useRef, useId } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ToastVariant = 'default' | 'success' | 'warning' | 'danger' | 'info'

export interface Toast {
  id: string
  message: string
  description?: string
  variant?: ToastVariant
  duration?: number
  action?: { label: string; onClick: () => void }
}

interface ToastContextValue {
  toast: (opts: Omit<Toast, 'id'>) => void
  success: (msg: string, desc?: string) => void
  error:   (msg: string, desc?: string) => void
  warning: (msg: string, desc?: string) => void
  info:    (msg: string, desc?: string) => void
  dismiss: (id: string) => void
}

// ── Context ───────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
  success: () => {},
  error: () => {},
  warning: () => {},
  info: () => {},
  dismiss: () => {},
})

export function useToast() {
  return useContext(ToastContext)
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const icons: Record<ToastVariant, string> = {
  default: '●',
  success: '✓',
  warning: '⚠',
  danger:  '✕',
  info:    'ℹ',
}

const variantStyles: Record<ToastVariant, string> = {
  default: 'bg-surface-2 border-border text-text-primary',
  success: 'bg-success-muted border-success/25 text-text-primary',
  warning: 'bg-warning-muted border-warning/25 text-text-primary',
  danger:  'bg-danger-muted  border-danger/25  text-text-primary',
  info:    'bg-info-muted    border-info/25    text-text-primary',
}

const iconStyles: Record<ToastVariant, string> = {
  default: 'text-text-tertiary',
  success: 'text-success-text',
  warning: 'text-warning-text',
  danger:  'text-danger-text',
  info:    'text-info-text',
}

// ── Toast Item ────────────────────────────────────────────────────────────────

function ToastItem({ toast: t, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const show = setTimeout(() => setVisible(true), 10)
    const hide = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onDismiss(t.id), 350)
    }, t.duration ?? 4000)
    timerRef.current = hide
    return () => { clearTimeout(show); clearTimeout(hide) }
  }, [t.id, t.duration, onDismiss])

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'flex items-start gap-3 p-4 rounded-xl border shadow-xl backdrop-blur-glass',
        'max-w-sm w-full',
        'transition-all duration-moderate ease-spring',
        variantStyles[t.variant ?? 'default'],
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
      )}
    >
      <span className={cn('text-sm font-bold mt-px shrink-0', iconStyles[t.variant ?? 'default'])} aria-hidden>
        {icons[t.variant ?? 'default']}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-snug">{t.message}</p>
        {t.description && <p className="text-caption mt-0.5">{t.description}</p>}
        {t.action && (
          <button
            onClick={t.action.onClick}
            className="mt-2 text-xs font-semibold text-brand-hover hover:underline focus-visible:outline-none"
          >
            {t.action.label}
          </button>
        )}
      </div>
      <button
        onClick={() => { setVisible(false); setTimeout(() => onDismiss(t.id), 350) }}
        aria-label="Dismiss"
        className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-text-tertiary hover:text-text-primary hover:bg-white/5 transition-all duration-fast"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
          <path d="M4.28 3.22a.75.75 0 0 0-1.06 1.06L6.94 8l-3.72 3.72a.75.75 0 1 0 1.06 1.06L8 9.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L9.06 8l3.72-3.72a.75.75 0 0 0-1.06-1.06L8 6.94 4.28 3.22z"/>
        </svg>
      </button>
    </div>
  )
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((opts: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev.slice(-4), { ...opts, id }])
  }, [])

  const success = useCallback((msg: string, desc?: string) => toast({ message: msg, description: desc, variant: 'success' }), [toast])
  const error   = useCallback((msg: string, desc?: string) => toast({ message: msg, description: desc, variant: 'danger' }), [toast])
  const warning = useCallback((msg: string, desc?: string) => toast({ message: msg, description: desc, variant: 'warning' }), [toast])
  const info    = useCallback((msg: string, desc?: string) => toast({ message: msg, description: desc, variant: 'info' }), [toast])

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info, dismiss }}>
      {children}
      {typeof window !== 'undefined' && createPortal(
        <div
          aria-live="polite"
          aria-atomic="false"
          className="fixed bottom-4 right-4 z-toast flex flex-col gap-2 pointer-events-none"
        >
          {toasts.map(t => (
            <div key={t.id} className="pointer-events-auto">
              <ToastItem toast={t} onDismiss={dismiss} />
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}
