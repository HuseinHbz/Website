'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

export type DrawerPlacement = 'left' | 'right' | 'top' | 'bottom'
export type DrawerSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

export interface DrawerProps {
  open: boolean
  onClose: () => void
  placement?: DrawerPlacement
  size?: DrawerSize
  title?: string
  children: React.ReactNode
  footer?: React.ReactNode
  closeOnOverlay?: boolean
}

const sizeMap: Record<DrawerPlacement, Record<DrawerSize, string>> = {
  left:   { sm: 'w-72', md: 'w-80', lg: 'w-96', xl: 'w-[480px]', full: 'w-full' },
  right:  { sm: 'w-72', md: 'w-80', lg: 'w-96', xl: 'w-[480px]', full: 'w-full' },
  top:    { sm: 'h-48', md: 'h-64', lg: 'h-80', xl: 'h-96',      full: 'h-full' },
  bottom: { sm: 'h-48', md: 'h-64', lg: 'h-80', xl: 'h-96',      full: 'h-full' },
}

const placementBase: Record<DrawerPlacement, string> = {
  left:   'inset-y-0 left-0 h-full flex-col',
  right:  'inset-y-0 right-0 h-full flex-col',
  top:    'inset-x-0 top-0 w-full flex-col',
  bottom: 'inset-x-0 bottom-0 w-full flex-col',
}

const enterFrom: Record<DrawerPlacement, string> = {
  left:   '-translate-x-full',
  right:  'translate-x-full',
  top:    '-translate-y-full',
  bottom: 'translate-y-full',
}

export function Drawer({
  open,
  onClose,
  placement = 'right',
  size = 'md',
  title,
  children,
  footer,
  closeOnOverlay = true,
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)

    const firstFocusable = panelRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    firstFocusable?.focus()

    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (typeof window === 'undefined') return null

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-modal',
        'transition-opacity duration-moderate',
        open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
      )}
      aria-hidden={!open}
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-overlay backdrop-blur-sm"
        onClick={closeOnOverlay ? onClose : undefined}
        aria-hidden
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        aria-label={title}
        className={cn(
          'absolute flex bg-surface border-border shadow-2xl',
          'transition-transform duration-moderate ease-spring',
          placementBase[placement],
          sizeMap[placement][size],
          placement === 'left' || placement === 'right' ? 'border-r border-l' : 'border-t border-b',
          open ? 'translate-x-0 translate-y-0' : enterFrom[placement],
        )}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
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
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="shrink-0 px-5 py-4 border-t border-border">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  )
}
