'use client'

import { useState, useRef, useId, createContext, useContext } from 'react'
import { cn } from '@/lib/utils'

// ── Context ───────────────────────────────────────────────────────────────────

interface AccordionCtx {
  openItems: Set<string>
  toggle: (id: string) => void
  multiple: boolean
}

const Ctx = createContext<AccordionCtx>({ openItems: new Set(), toggle: () => {}, multiple: false })

// ── Root ──────────────────────────────────────────────────────────────────────

export interface AccordionProps {
  children: React.ReactNode
  multiple?: boolean
  defaultOpen?: string[]
  className?: string
}

export function Accordion({ children, multiple = false, defaultOpen = [], className }: AccordionProps) {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set(defaultOpen))

  const toggle = (id: string) => {
    setOpenItems(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (!multiple) next.clear()
        next.add(id)
      }
      return next
    })
  }

  return (
    <Ctx.Provider value={{ openItems, toggle, multiple }}>
      <div className={cn('divide-y divide-border rounded-xl border border-border overflow-hidden', className)}>
        {children}
      </div>
    </Ctx.Provider>
  )
}

// ── Item ──────────────────────────────────────────────────────────────────────

export interface AccordionItemProps {
  id: string
  title: React.ReactNode
  children: React.ReactNode
  icon?: React.ReactNode
  badge?: React.ReactNode
  disabled?: boolean
  className?: string
}

export function AccordionItem({ id, title, children, icon, badge, disabled, className }: AccordionItemProps) {
  const { openItems, toggle } = useContext(Ctx)
  const isOpen = openItems.has(id)
  const contentId = useId()
  const triggerId = useId()
  const contentRef = useRef<HTMLDivElement>(null)

  return (
    <div className={cn('bg-surface', className)}>
      <button
        id={triggerId}
        aria-expanded={isOpen}
        aria-controls={contentId}
        disabled={disabled}
        onClick={() => toggle(id)}
        className={cn(
          'w-full flex items-center gap-3 px-5 py-4 text-start',
          'transition-colors duration-fast',
          'hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand',
          disabled && 'opacity-40 cursor-not-allowed',
        )}
      >
        {icon && <span className="shrink-0 text-text-tertiary">{icon}</span>}
        <span className="flex-1 text-sm font-medium text-text-primary">{title}</span>
        {badge && <span className="shrink-0">{badge}</span>}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden
          className={cn('shrink-0 text-text-tertiary transition-transform duration-moderate', isOpen && 'rotate-180')}
        >
          <path d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06z"/>
        </svg>
      </button>

      <div
        id={contentId}
        role="region"
        aria-labelledby={triggerId}
        ref={contentRef}
        style={{ maxHeight: isOpen ? contentRef.current?.scrollHeight ?? 9999 : 0 }}
        className="overflow-hidden transition-all duration-moderate ease-spring"
      >
        <div className="px-5 pb-4 text-sm text-text-secondary leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  )
}
