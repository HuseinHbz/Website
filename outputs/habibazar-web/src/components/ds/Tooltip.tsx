'use client'

import { useState, useRef, useCallback, useId, cloneElement } from 'react'
import { cn } from '@/lib/utils'

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right'

export interface TooltipProps {
  content: React.ReactNode
  placement?: TooltipPlacement
  delay?: number
  children: React.ReactElement<React.HTMLAttributes<HTMLElement>>
  className?: string
}

const placementClasses: Record<TooltipPlacement, string> = {
  top:    'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left:   'right-full top-1/2 -translate-y-1/2 mr-2',
  right:  'left-full top-1/2 -translate-y-1/2 ml-2',
}

export function Tooltip({ content, placement = 'top', delay = 150, children, className }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const id = useId()

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => setVisible(true), delay)
  }, [delay])

  const hide = useCallback(() => {
    clearTimeout(timerRef.current)
    setVisible(false)
  }, [])

  const box = placementClasses[placement]

  const trigger = cloneElement(children, {
    'aria-describedby': visible ? id : undefined,
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => { show(); children.props.onMouseEnter?.(e) },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => { hide(); children.props.onMouseLeave?.(e) },
    onFocus:      (e: React.FocusEvent<HTMLElement>) => { show(); children.props.onFocus?.(e) },
    onBlur:       (e: React.FocusEvent<HTMLElement>) => { hide(); children.props.onBlur?.(e) },
  })

  return (
    <span className="relative inline-flex">
      {trigger}
      {visible && (
        <span
          role="tooltip"
          id={id}
          className={cn(
            'absolute z-tooltip pointer-events-none',
            'px-2.5 py-1.5 rounded-lg',
            'bg-surface-2 border border-border',
            'text-xs font-medium text-text-primary',
            'shadow-lg backdrop-blur-md',
            'whitespace-nowrap animate-scale-in',
            box,
            className,
          )}
        >
          {content}
        </span>
      )}
    </span>
  )
}
