'use client'

import { forwardRef, useRef } from 'react'
import { cn } from '@/lib/utils'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline'
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  fullWidth?: boolean
  ripple?: boolean
}

const variants: Record<ButtonVariant, string> = {
  primary: cn(
    'bg-brand text-white border border-transparent',
    'hover:bg-brand-hover',
    'shadow-brand hover:shadow-brand-lg',
    'active:scale-[0.98]',
  ),
  secondary: cn(
    'bg-surface-2 text-text-primary border border-border',
    'hover:border-border-strong hover:bg-surface-2',
    'active:scale-[0.98]',
  ),
  outline: cn(
    'bg-transparent text-text-secondary border border-border-strong',
    'hover:text-brand-hover hover:border-brand hover:bg-brand-subtle',
    'active:scale-[0.98]',
  ),
  ghost: cn(
    'bg-transparent text-text-secondary border border-transparent',
    'hover:bg-white/5 hover:text-text-primary',
    'active:scale-[0.98]',
  ),
  danger: cn(
    'bg-danger-muted text-danger-text border border-danger/20',
    'hover:bg-danger/20 hover:border-danger/40',
    'active:scale-[0.98]',
  ),
  success: cn(
    'bg-success-muted text-success-text border border-success/20',
    'hover:bg-success/20 hover:border-success/40',
    'active:scale-[0.98]',
  ),
}

const sizes: Record<ButtonSize, string> = {
  xs: 'h-7  px-2.5 text-xs  rounded-md  gap-1',
  sm: 'h-8  px-3   text-sm  rounded-lg  gap-1.5',
  md: 'h-9  px-4   text-base rounded-lg  gap-2',
  lg: 'h-11 px-5   text-base rounded-xl  gap-2',
  xl: 'h-13 px-7   text-lg  rounded-xl  gap-2.5',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  ripple = true,
  disabled,
  children,
  className,
  onClick,
  ...props
}, ref) => {
  const innerRef = useRef<HTMLButtonElement>(null)
  const buttonRef = (ref as React.RefObject<HTMLButtonElement>) || innerRef
  const isDisabled = disabled || loading

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (ripple && buttonRef.current && !isDisabled) {
      const btn = buttonRef.current
      const rect = btn.getBoundingClientRect()
      const rippleEl = document.createElement('span')
      const size = Math.max(rect.width, rect.height)
      rippleEl.style.cssText = `
        position:absolute;width:${size}px;height:${size}px;
        left:${e.clientX - rect.left - size / 2}px;
        top:${e.clientY - rect.top - size / 2}px;
        border-radius:50%;background:rgba(255,255,255,0.15);
        pointer-events:none;transform:scale(0);
        animation:ripple 0.6s cubic-bezier(0,0,0.2,1) forwards;
      `
      btn.appendChild(rippleEl)
      setTimeout(() => rippleEl.remove(), 700)
    }
    onClick?.(e)
  }

  return (
    <button
      ref={buttonRef}
      disabled={isDisabled}
      onClick={handleClick}
      className={cn(
        'relative inline-flex items-center justify-center overflow-hidden',
        'font-semibold tracking-wide leading-none',
        'transition-all duration-normal ease-spring',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
        'select-none cursor-pointer',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading ? (
        <span className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" aria-hidden />
      ) : leftIcon ? (
        <span className="shrink-0 flex items-center" aria-hidden>{leftIcon}</span>
      ) : null}
      {children && <span className="truncate">{children}</span>}
      {!loading && rightIcon && (
        <span className="shrink-0 flex items-center" aria-hidden>{rightIcon}</span>
      )}
    </button>
  )
})
Button.displayName = 'Button'

// Icon-only button
export const IconButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'leftIcon' | 'rightIcon' | 'fullWidth'>>(({
  size = 'md', children, className, ...props
}, ref) => {
  const iconSizes: Record<ButtonSize, string> = {
    xs: 'w-7  h-7  rounded-md',
    sm: 'w-8  h-8  rounded-lg',
    md: 'w-9  h-9  rounded-lg',
    lg: 'w-11 h-11 rounded-xl',
    xl: 'w-13 h-13 rounded-xl',
  }

  return (
    <Button ref={ref} size={size} className={cn('px-0', iconSizes[size], className)} {...props}>
      {children}
    </Button>
  )
})
IconButton.displayName = 'IconButton'
