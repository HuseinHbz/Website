'use client'

import { createContext, useContext, useState, useId } from 'react'
import { cn } from '@/lib/utils'

// ── Context ───────────────────────────────────────────────────────────────────

interface TabsContextValue {
  activeTab: string
  setActiveTab: (id: string) => void
  baseId: string
}

const TabsContext = createContext<TabsContextValue>({
  activeTab: '',
  setActiveTab: () => {},
  baseId: '',
})

// ── Root ──────────────────────────────────────────────────────────────────────

export interface TabsProps {
  defaultTab?: string
  value?: string
  onChange?: (tab: string) => void
  children: React.ReactNode
  className?: string
}

export function Tabs({ defaultTab = '', value, onChange, children, className }: TabsProps) {
  const [internalTab, setInternalTab] = useState(defaultTab)
  const baseId = useId()
  const activeTab = value ?? internalTab

  const setActiveTab = (id: string) => {
    setInternalTab(id)
    onChange?.(id)
  }

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab, baseId }}>
      <div className={cn('flex flex-col', className)}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

// ── Tab List ──────────────────────────────────────────────────────────────────

export type TabsVariant = 'line' | 'pills' | 'cards' | 'compact'

export function TabList({
  children,
  variant = 'line',
  className,
}: {
  children: React.ReactNode
  variant?: TabsVariant
  className?: string
}) {
  const listStyles: Record<TabsVariant, string> = {
    line:    'flex border-b border-border gap-0',
    pills:   'flex gap-1 p-1 bg-surface-2 rounded-xl border border-border',
    cards:   'flex gap-2',
    compact: 'flex gap-0 border-b border-border',
  }

  return (
    <div
      role="tablist"
      className={cn(listStyles[variant], 'overflow-x-auto no-scrollbar', className)}
      data-variant={variant}
    >
      {children}
    </div>
  )
}

// ── Tab ───────────────────────────────────────────────────────────────────────

export function Tab({
  id,
  children,
  icon,
  count,
  disabled = false,
}: {
  id: string
  children: React.ReactNode
  icon?: React.ReactNode
  count?: number
  disabled?: boolean
}) {
  const { activeTab, setActiveTab, baseId } = useContext(TabsContext)
  const isActive = activeTab === id

  return (
    <button
      role="tab"
      id={`${baseId}-tab-${id}`}
      aria-selected={isActive}
      aria-controls={`${baseId}-panel-${id}`}
      disabled={disabled}
      tabIndex={isActive ? 0 : -1}
      onClick={() => !disabled && setActiveTab(id)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveTab(id) }
      }}
      className={cn(
        'inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium',
        'transition-all duration-fast whitespace-nowrap',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        // line variant (default)
        '[&[data-variant=line]_&]:border-b-2',
        isActive
          ? '[data-variant=line] &:border-b-2 border-brand text-text-primary [data-variant=pills] &:bg-background text-text-primary shadow-sm [data-variant=cards] &:bg-surface-2 border-border text-text-primary shadow-sm'
          : 'text-text-tertiary hover:text-text-secondary',
      )}
    >
      {icon && <span className="shrink-0" aria-hidden>{icon}</span>}
      {children}
      {count !== undefined && (
        <span className={cn(
          'min-w-[20px] h-5 px-1.5 rounded-full text-2xs font-semibold flex items-center justify-center',
          isActive ? 'bg-brand/20 text-brand-hover' : 'bg-surface-2 text-text-tertiary',
        )}>
          {count}
        </span>
      )}
    </button>
  )
}

// ── Tab Panel ─────────────────────────────────────────────────────────────────

export function TabPanel({
  id,
  children,
  className,
}: {
  id: string
  children: React.ReactNode
  className?: string
}) {
  const { activeTab, baseId } = useContext(TabsContext)
  if (activeTab !== id) return null

  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${id}`}
      aria-labelledby={`${baseId}-tab-${id}`}
      className={cn('animate-fade-in', className)}
      tabIndex={0}
    >
      {children}
    </div>
  )
}
