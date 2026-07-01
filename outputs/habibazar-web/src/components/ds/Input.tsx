'use client'

import { forwardRef, useState, useId } from 'react'
import { cn } from '@/lib/utils'

// ── Text Input ───────────────────────────────────────────────────────────────

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  inputSize?: 'sm' | 'md' | 'lg'
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  hint,
  error,
  leftIcon,
  rightIcon,
  inputSize = 'md',
  className,
  id: idProp,
  required,
  disabled,
  ...props
}, ref) => {
  const generatedId = useId()
  const id = idProp || generatedId

  const heights = { sm: 'h-8 text-sm px-3', md: 'h-9 text-base px-3.5', lg: 'h-11 text-base px-4' }

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="form-label">
          {label}
          {required && <span className="text-danger ml-1" aria-hidden>*</span>}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" aria-hidden>
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={id}
          required={required}
          disabled={disabled}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          aria-invalid={!!error}
          className={cn(
            'form-input',
            heights[inputSize],
            leftIcon && 'pl-10',
            rightIcon && 'pr-10',
            error && 'border-danger focus:ring-danger/20 focus:border-danger',
            className,
          )}
          {...props}
        />
        {rightIcon && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" aria-hidden>
            {rightIcon}
          </span>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="form-error" role="alert">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm-.75 3.75a.75.75 0 0 1 1.5 0v3.5a.75.75 0 0 1-1.5 0v-3.5zm.75 7a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
          </svg>
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={`${id}-hint`} className="form-hint">{hint}</p>
      )}
    </div>
  )
})
Input.displayName = 'Input'

// ── Textarea ─────────────────────────────────────────────────────────────────

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string
  resize?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
  label, hint, error, resize = false, className, id: idProp, required, ...props
}, ref) => {
  const generatedId = useId()
  const id = idProp || generatedId

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="form-label">
          {label}
          {required && <span className="text-danger ml-1" aria-hidden>*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={id}
        required={required}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        aria-invalid={!!error}
        className={cn(
          'form-input py-2.5 min-h-[100px]',
          !resize && 'resize-none',
          error && 'border-danger focus:ring-danger/20 focus:border-danger',
          className,
        )}
        {...props}
      />
      {error && (
        <p id={`${id}-error`} className="form-error" role="alert">{error}</p>
      )}
      {!error && hint && (
        <p id={`${id}-hint`} className="form-hint">{hint}</p>
      )}
    </div>
  )
})
Textarea.displayName = 'Textarea'

// ── Select ───────────────────────────────────────────────────────────────────

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  hint?: string
  error?: string
  options?: { value: string; label: string; disabled?: boolean }[]
  inputSize?: 'sm' | 'md' | 'lg'
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  label, hint, error, options, inputSize = 'md', className, id: idProp, required, children, ...props
}, ref) => {
  const generatedId = useId()
  const id = idProp || generatedId
  const heights = { sm: 'h-8 text-sm', md: 'h-9 text-base', lg: 'h-11 text-base' }

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="form-label">
          {label}
          {required && <span className="text-danger ml-1" aria-hidden>*</span>}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={id}
          required={required}
          aria-invalid={!!error}
          className={cn(
            'form-input pr-9 appearance-none cursor-pointer',
            heights[inputSize],
            error && 'border-danger',
            className,
          )}
          {...props}
        >
          {options ? options.map(o => (
            <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
          )) : children}
        </select>
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" aria-hidden>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.5 6.5l3.5 4 3.5-4"/>
          </svg>
        </span>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {!error && hint && <p className="form-hint">{hint}</p>}
    </div>
  )
})
Select.displayName = 'Select'

// ── Checkbox ─────────────────────────────────────────────────────────────────

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode
  description?: string
  error?: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(({
  label, description, error, className, id: idProp, ...props
}, ref) => {
  const generatedId = useId()
  const id = idProp || generatedId

  return (
    <div className="flex gap-3">
      <input
        ref={ref}
        type="checkbox"
        id={id}
        className={cn(
          'mt-0.5 w-4 h-4 rounded cursor-pointer',
          'bg-sunken border border-border-strong',
          'checked:bg-brand checked:border-brand',
          'focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 focus-visible:ring-offset-background',
          'transition-all duration-fast',
          className,
        )}
        {...props}
      />
      {(label || description) && (
        <div className="flex flex-col gap-0.5">
          {label && (
            <label htmlFor={id} className="text-sm font-medium text-text-primary cursor-pointer leading-snug">
              {label}
            </label>
          )}
          {description && <p className="text-caption">{description}</p>}
          {error && <p className="form-error">{error}</p>}
        </div>
      )}
    </div>
  )
})
Checkbox.displayName = 'Checkbox'

// ── Switch ───────────────────────────────────────────────────────────────────

export interface SwitchProps {
  checked?: boolean
  onChange?: (checked: boolean) => void
  label?: string
  description?: string
  disabled?: boolean
  size?: 'sm' | 'md'
  id?: string
}

export function Switch({ checked = false, onChange, label, description, disabled, size = 'md', id: idProp }: SwitchProps) {
  const generatedId = useId()
  const id = idProp || generatedId

  const track = size === 'sm'
    ? 'w-8 h-4'
    : 'w-10 h-5'
  const thumb = size === 'sm'
    ? 'w-3 h-3 translate-x-0.5 peer-checked:translate-x-4'
    : 'w-4 h-4 translate-x-0.5 peer-checked:translate-x-5'

  return (
    <div className="flex items-start gap-3">
      <label htmlFor={id} className="relative inline-flex items-center cursor-pointer mt-0.5">
        <input
          id={id}
          type="checkbox"
          className="sr-only peer"
          checked={checked}
          disabled={disabled}
          onChange={e => onChange?.(e.target.checked)}
        />
        <div className={cn(
          track,
          'rounded-full transition-all duration-moderate',
          'bg-border-strong peer-checked:bg-brand',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background',
          disabled && 'opacity-50 cursor-not-allowed',
        )} />
        <div className={cn(
          thumb,
          'absolute top-0.5 rounded-full bg-white',
          'shadow-sm transition-all duration-moderate ease-spring',
        )} />
      </label>
      {(label || description) && (
        <div>
          {label && (
            <label htmlFor={id} className="text-sm font-medium text-text-primary cursor-pointer">
              {label}
            </label>
          )}
          {description && <p className="text-caption mt-0.5">{description}</p>}
        </div>
      )}
    </div>
  )
}
