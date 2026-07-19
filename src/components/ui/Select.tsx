import { forwardRef, useId } from 'react'
import { cn } from '@/lib/utils'
import { focusRing } from '@/lib/a11y'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  helper?: string
  required?: boolean
  options: SelectOption[]
  placeholder?: string
  containerClassName?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helper,
      required,
      options,
      placeholder,
      containerClassName,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const generatedId = useId()
    const selectId = id || generatedId
    const errorId = `${selectId}-error`
    const helperId = `${selectId}-helper`

    return (
      <div className={cn('w-full', containerClassName)}>
        {label && (
          <label
            htmlFor={selectId}
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
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            aria-required={required}
            aria-invalid={!!error}
            aria-describedby={
              [error && errorId, helper && helperId]
                .filter(Boolean)
                .join(' ') || undefined
            }
            className={cn(
              'w-full px-4 py-2.5 text-sm appearance-none',
              'bg-background border border-border rounded-lg',
              'text-text-primary',
              'transition-colors duration-150',
              'hover:border-accent/40',
              error
                ? 'border-red-500 focus:border-red-500'
                : 'focus:border-accent',
              focusRing,
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3">
            <svg
              className="h-4 w-4 text-text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
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

Select.displayName = 'Select'
