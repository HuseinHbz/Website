import { forwardRef, useId } from 'react'
import { cn } from '@/lib/utils'
import { focusRing } from '@/lib/a11y'

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helper?: string
  required?: boolean
  containerClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helper,
      required,
      containerClassName,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const generatedId = useId()
    const inputId = id || generatedId
    const errorId = `${inputId}-error`
    const helperId = `${inputId}-helper`

    return (
      <div className={cn('w-full', containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-text-secondary mb-1.5"
          >
            {label}
            {required && (
              <span className="text-accent ms-1" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-required={required}
          aria-invalid={!!error}
          aria-describedby={
            [error && errorId, helper && helperId]
              .filter(Boolean)
              .join(' ') || undefined
          }
          className={cn(
            'w-full px-4 py-2.5 text-sm',
            'bg-background border border-border rounded-lg',
            'text-text-primary placeholder:text-text-muted',
            'transition-colors duration-150',
            'hover:border-accent/40',
            error
              ? 'border-red-500 focus:border-red-500'
              : 'focus:border-accent',
            focusRing,
            className
          )}
          {...props}
        />
        {error && (
          <p id={errorId} role="alert" className="mt-1.5 text-xs text-red-400">
            {error}
          </p>
        )}
        {helper && !error && (
          <p id={helperId} className="mt-1.5 text-xs text-text-muted">
            {helper}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
