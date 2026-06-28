'use client'

import { useState, FormEvent, useId } from 'react'
import { useTranslations } from 'next-intl'
import { z } from 'zod'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { focusRing } from '@/lib/a11y'
import { SITE } from '@/lib/site'

// ─── Types ───────────────────────────────────────────────────────────────────

export type ConsultationKind = 'ASSESSMENT' | 'INTRO_CALL'

interface ConsultationFormProps {
  kind: ConsultationKind
  locale: string
}

type FormState = 'idle' | 'submitting' | 'success' | 'error'

interface FormValues {
  name: string
  email: string
  phone: string
  company: string
  message: string
  preferredDate: string
  marketingConsent: boolean
}

interface FormErrors {
  name?: string
  email?: string
  phone?: string
  message?: string
}

// ─── Validation ──────────────────────────────────────────────────────────────

const assessmentSchema = z.object({
  name: z.string().min(2, 'minLength:2'),
  email: z.string().email('email'),
  phone: z.string().regex(/^[+\d\s\-()]{7,}$/, 'phone').optional().or(z.literal('')),
  company: z.string().optional(),
  message: z.string().min(10, 'minLength:10'),
  marketingConsent: z.boolean(),
})

const introCallSchema = assessmentSchema.extend({
  preferredDate: z.string().optional(),
})

// ─── Success Icon ─────────────────────────────────────────────────────────────

function SuccessIcon() {
  return (
    <div className="w-16 h-16 rounded-full bg-success/10 border border-success/20 flex items-center justify-center mx-auto mb-4">
      <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ConsultationForm({ kind, locale }: ConsultationFormProps) {
  const tConsult = useTranslations('consultation')
  const tIntro = useTranslations('introCall')
  const tErrors = useTranslations('errors')
  const isRTL = locale === 'fa'

  const consentId = useId()

  const [values, setValues] = useState<FormValues>({
    name: '',
    email: '',
    phone: '',
    company: '',
    message: '',
    preferredDate: '',
    marketingConsent: false,
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [formState, setFormState] = useState<FormState>('idle')

  function t(key: string): string {
    return tConsult(`form.${key}` as Parameters<typeof tConsult>[0])
  }

  function getErrorMessage(code: string): string {
    if (code.startsWith('minLength:')) {
      const min = code.split(':')[1]
      return tErrors('minLength', { min })
    }
    const map: Record<string, string> = {
      email: tErrors('email'),
      phone: tErrors('phone'),
      required: tErrors('required'),
    }
    return map[code] || tErrors('generic')
  }

  function validate(): boolean {
    const schema = kind === 'INTRO_CALL' ? introCallSchema : assessmentSchema
    const result = schema.safeParse(values)

    if (result.success) {
      setErrors({})
      return true
    }

    const newErrors: FormErrors = {}
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof FormErrors
      if (!newErrors[field]) {
        newErrors[field] = getErrorMessage(issue.message)
      }
    }
    setErrors(newErrors)
    return false
  }

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
    // Clear error on change
    if (key in errors) {
      setErrors((prev) => ({ ...prev, [key]: undefined }))
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setFormState('submitting')

    try {
      const endpoint =
        kind === 'INTRO_CALL'
          ? '/api/consultation/intro-call'
          : '/api/consultation'

      const payload = {
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim() || undefined,
        company: values.company.trim() || undefined,
        message: values.message.trim(),
        preferredDate: kind === 'INTRO_CALL' ? values.preferredDate.trim() || undefined : undefined,
        marketingConsent: values.marketingConsent,
        locale,
        kind,
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      setFormState('success')
    } catch {
      setFormState('error')
    }
  }

  // ── Success state ─────────────────────────────────────────────────────────

  if (formState === 'success') {
    return (
      <Card padding="lg" className="text-center">
        <SuccessIcon />
        <h2 className="text-lg font-semibold text-text-primary mb-2">
          {isRTL ? 'درخواست ارسال شد' : 'Request Submitted'}
        </h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          {t('success')}
        </p>
      </Card>
    )
  }

  // ── Form ─────────────────────────────────────────────────────────────────

  return (
    <Card padding="lg">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        {/* Name + Email row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label={t('name')}
            placeholder={isRTL ? 'حسین احمدی' : 'John Smith'}
            value={values.name}
            onChange={(e) => update('name', e.target.value)}
            error={errors.name}
            required
            dir={isRTL ? 'rtl' : 'ltr'}
          />
          <Input
            label={t('email')}
            type="email"
            placeholder="you@company.com"
            value={values.email}
            onChange={(e) => update('email', e.target.value)}
            error={errors.email}
            required
            dir="ltr"
          />
        </div>

        {/* Phone + Company row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label={t('phone')}
            type="tel"
            placeholder={isRTL ? '۰۹۱۲ ۳۴۵ ۶۷۸۹' : '+1 (555) 000-0000'}
            value={values.phone}
            onChange={(e) => update('phone', e.target.value)}
            error={errors.phone}
            dir="ltr"
          />
          <Input
            label={t('company')}
            placeholder={isRTL ? 'نام شرکت' : 'Company name'}
            value={values.company}
            onChange={(e) => update('company', e.target.value)}
            dir={isRTL ? 'rtl' : 'ltr'}
          />
        </div>

        {/* Preferred date (intro call only) */}
        {kind === 'INTRO_CALL' && (
          <Input
            label={tIntro('form.preferredDate')}
            placeholder={tIntro('form.preferredDatePlaceholder')}
            value={values.preferredDate}
            onChange={(e) => update('preferredDate', e.target.value)}
            dir={isRTL ? 'rtl' : 'ltr'}
          />
        )}

        {/* Message */}
        <Textarea
          label={t('message')}
          placeholder={t('messagePlaceholder')}
          value={values.message}
          onChange={(e) => update('message', e.target.value)}
          error={errors.message}
          required
          rows={4}
          dir={isRTL ? 'rtl' : 'ltr'}
        />

        {/* Marketing consent */}
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id={consentId}
            checked={values.marketingConsent}
            onChange={(e) => update('marketingConsent', e.target.checked)}
            className={cn(
              'mt-0.5 w-4 h-4 rounded border-border bg-background',
              'text-accent accent-accent flex-shrink-0',
              focusRing
            )}
          />
          <label
            htmlFor={consentId}
            className="text-xs text-text-muted leading-relaxed cursor-pointer select-none"
          >
            {t('consent')}
          </label>
        </div>

        {/* Error banner */}
        {formState === 'error' && (
          <div
            role="alert"
            className="px-4 py-3 rounded-lg bg-red-900/20 border border-red-800/30 text-sm text-red-400"
          >
            {t('error')}
          </div>
        )}

        {/* Submit */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={formState === 'submitting'}
        >
          {formState === 'submitting' ? t('submitting') : t('submit')}
        </Button>
      </form>
    </Card>
  )
}
