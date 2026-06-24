'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { focusRing } from '@/lib/a11y'
import { LoadingSpinner } from './LoadingSpinner'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  fullWidth?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: cn(
    'bg-accent hover:bg-accent-hover text-white',
    'shadow-lg shadow-accent/20 hover:shadow-accent/30',
    'border border-transparent',
    'transition-all duration-200'
  ),
  secondary: cn(
    'bg-transparent hover:bg-surface text-text-primary',
    'border border-border hover:border-accent/50',
    'transition-all duration-200'
  ),
  ghost: cn(
    'bg-transparent hover:bg-white/5 text-text-secondary hover:text-text-primary',
    'border border-transparent',
    'transition-all duration-200'
  ),
  danger: cn(
    'bg-red-600 hover:bg-red-500 text-white',
    'border border-transparent',
    'transition-all duration-200'
  ),
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-md gap-1.5',
  md: 'px-5 py-2.5 text-sm rounded-lg gap-2',
  lg: 'px-7 py-3.5 text-base rounded-xl gap-2.5',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      children,
      className,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          'inline-flex items-center justify-center font-medium',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && 'w-full',
          focusRing,
          className
        )}
        {...props}
      >
        {loading ? (
          <LoadingSpinner size={size === 'sm' ? 'sm' : 'md'} />
        ) : (
          leftIcon
        )}
        {children}
        {!loading && rightIcon}
      </button>
    )
  }
)

Button.displayName = 'Button'
