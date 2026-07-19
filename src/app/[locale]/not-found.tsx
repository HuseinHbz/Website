import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

export default async function NotFound() {
  let t: ((k: string) => string) | null = null
  try {
    const translations = await getTranslations('errors')
    t = translations
  } catch {
    t = null
  }

  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-8xl font-black text-text-disabled mb-6 select-none" aria-hidden>
        404
      </p>
      <h1 className="text-2xl font-bold text-text-primary mb-3">
        {t?.('notFoundTitle') ?? 'Page not found'}
      </h1>
      <p className="text-sm text-text-secondary mb-8 max-w-md leading-relaxed">
        {t?.('notFoundDescription') ?? "The page you're looking for doesn't exist or has been moved."}
      </p>
      <Link
        href="/"
        className="px-5 py-2.5 rounded-lg bg-brand hover:bg-brand-hover text-white text-sm font-semibold transition-all duration-fast shadow-brand"
      >
        {t?.('goHome') ?? 'Go home'}
      </Link>
    </main>
  )
}
