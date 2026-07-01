'use client'

import { useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  size?: ModalSize
  children: React.ReactNode
  footer?: React.ReactNode
  closeOnOverlay?: boolean
  className?: string
}

const sizes: Record<ModalSize, string> = {
  sm:   'max-w-sm',
  md:   'max-w-lg',
  lg:   'max-w-2xl',
  xl:   'max-w-4xl',
  full: 'max-w-[95vw] min-h-[80vh]',
}

export function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  children,
  footer,
  closeOnOverlay = true,
  className,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const firstFocusRef = useRef<HTMLButtonElement>(null)

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'Tab' && dialogRef.current) {
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button,a,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
      )
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus() } }
      else { if (document.activeElement === last) { e.preventDefault(); first.focus() } }
    }
  }, [onClose])

  useEffect(() => {
    if (!open) return
    document.addEventListener('keydown', handleKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    setTimeout(() => firstFocusRef.current?.focus(), 10)
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = prev
    }
  }, [open, handleKey])

  if (!open) return null

  const content = (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      aria-describedby={description ? 'modal-desc' : undefined}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-overlay backdrop-blur-sm animate-fade-in"
        onClick={closeOnOverlay ? onClose : undefined}
        aria-hidden
      />

      {/* Panel */}
      <div
        ref={dialogRef}
        className={cn(
          'relative w-full rounded-2xl bg-surface border border-border shadow-2xl',
          'animate-scale-in',
          sizes[size],
          className,
        )}
      >
        {/* Header */}
        {(title || description) && (
          <div className="flex items-start justify-between p-6 border-b border-border">
            <div>
              {title && (
                <h2 id="modal-title" className="text-lg font-semibold text-text-primary tracking-tight">
                  {title}
                </h2>
              )}
              {description && (
                <p id="modal-desc" className="text-sm text-text-secondary mt-1">{description}</p>
              )}
            </div>
            <button
              ref={firstFocusRef}
              onClick={onClose}
              aria-label="Close"
              className={cn(
                '-mt-1 -mr-1 w-8 h-8 flex items-center justify-center rounded-lg',
                'text-text-tertiary hover:text-text-primary hover:bg-white/5',
                'transition-all duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
              )}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                <path d="M4.28 3.22a.75.75 0 0 0-1.06 1.06L6.94 8l-3.72 3.72a.75.75 0 1 0 1.06 1.06L8 9.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L9.06 8l3.72-3.72a.75.75 0 0 0-1.06-1.06L8 6.94 4.28 3.22z"/>
              </svg>
            </button>
          </div>
        )}

        {/* Body */}
        <div className={cn('p-6', !title && !description && 'pt-8')}>
          {!title && !description && (
            <button
              ref={firstFocusRef}
              onClick={onClose}
              aria-label="Close"
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-text-tertiary hover:text-text-primary hover:bg-white/5 transition-all duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                <path d="M4.28 3.22a.75.75 0 0 0-1.06 1.06L6.94 8l-3.72 3.72a.75.75 0 1 0 1.06 1.06L8 9.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L9.06 8l3.72-3.72a.75.75 0 0 0-1.06-1.06L8 6.94 4.28 3.22z"/>
              </svg>
            </button>
          )}
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-sunken rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  )

  return typeof window !== 'undefined' ? createPortal(content, document.body) : null
}

// ── Confirm Modal ─────────────────────────────────────────────────────────────

export interface ConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'info'
  loading?: boolean
}

export function ConfirmModal({
  open, onClose, onConfirm, title, description,
  confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  variant = 'danger', loading = false,
}: ConfirmModalProps) {
  const variantClass = {
    danger:  'bg-danger-muted text-danger-text border border-danger/20 hover:bg-danger/20',
    warning: 'bg-warning-muted text-warning-text border border-warning/20 hover:bg-warning/20',
    info:    'bg-brand-muted text-brand-hover border border-brand/20 hover:bg-brand/20',
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary border border-border hover:border-border-strong hover:text-text-primary transition-all duration-fast disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-fast',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              variantClass[variant],
            )}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                {confirmLabel}
              </span>
            ) : confirmLabel}
          </button>
        </>
      }
    >
      {null}
    </Modal>
  )
}
