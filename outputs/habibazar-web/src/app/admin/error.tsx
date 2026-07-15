'use client'

/**
 * Admin error boundary (Phase 26.26, BUG-012). A rendering exception in ONE admin
 * page/widget (e.g. a missing API field) must not white-screen the whole panel —
 * Next.js renders this in place with a retry, keeping the rest of the app usable.
 */
import { useEffect } from 'react'
import Link from 'next/link'

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[admin] page error:', error) }, [error])
  return (
    <div className="p-8 max-w-lg mx-auto text-center" dir="rtl">
      <div className="text-4xl mb-3">⚠️</div>
      <h1 className="text-lg font-bold text-text-primary mb-1">خطایی در این صفحه رخ داد</h1>
      <p className="text-sm text-text-secondary mb-1">Something went wrong on this page.</p>
      <p className="text-xs text-text-tertiary mb-5">سایر بخش‌های پنل هم‌چنان در دسترس‌اند. / The rest of the admin is still available.</p>
      <div className="flex items-center justify-center gap-2">
        <button onClick={reset} className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold">تلاش دوباره / Retry</button>
        <Link href="/admin" className="px-4 py-2 rounded-lg bg-surface-2 border border-border text-sm">بازگشت به خانه / Home</Link>
      </div>
      {error?.digest && <p className="text-3xs text-text-disabled mt-4 font-mono">ref: {error.digest}</p>}
    </div>
  )
}
