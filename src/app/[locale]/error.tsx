'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[Page Error]', error)
  }, [error])

  // useTranslations may fail if the intl context is broken — fall back to strings
  let t: ((k: string) => string) | null = null
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    t = useTranslations('errors')
  } catch {
    t = null
  }

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 text-3xl bg-danger-muted border border-danger/20 text-danger-text">
        ✕
      </div>
      <h1 className="text-2xl font-bold text-text-primary mb-3">
        {t?.('title') ?? 'Something went wrong'}
      </h1>
      <p className="text-sm text-text-secondary mb-8 max-w-md leading-relaxed">
        {t?.('description') ?? 'An unexpected error occurred. Our team has been notified.'}
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-text-disabled mb-6">Error ID: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="px-5 py-2.5 rounded-lg bg-brand hover:bg-brand-hover text-white text-sm font-semibold transition-all duration-fast shadow-brand"
      >
        {t?.('retry') ?? 'Try again'}
      </button>
    </main>
  )
}
