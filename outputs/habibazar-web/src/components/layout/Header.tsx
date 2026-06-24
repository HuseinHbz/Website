'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { focusRing } from '@/lib/a11y'
import { NAV_ITEMS } from '@/lib/navigation'
import { SITE } from '@/lib/site'
import { Button } from '@/components/ui/Button'

interface HeaderProps {
  locale: string
}

export function Header({ locale }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const pathname = usePathname()
  const t = useTranslations('nav')
  const ta = useTranslations('a11y')
  const isRTL = locale === 'fa'

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Close menu on route change
  useEffect(() => {
    setIsMenuOpen(false)
  }, [pathname])

  function buildLocalizedPath(path: string) {
    if (locale === SITE.locale.default) return path
    return `/${locale}${path}`
  }

  function getAltLocale() {
    return locale === 'fa' ? 'en' : 'fa'
  }

  function getAltLocalePath() {
    // Strip current locale prefix if present
    const withoutLocale = pathname.replace(/^\/(fa|en)/, '') || '/'
    const altLocale = getAltLocale()
    if (altLocale === SITE.locale.default) return withoutLocale
    return `/${altLocale}${withoutLocale}`
  }

  function isActive(href: string) {
    const localizedHref = buildLocalizedPath(href)
    if (href === '/') return pathname === localizedHref
    return pathname.startsWith(localizedHref)
  }

  return (
    <header
      className={cn(
        'fixed top-0 inset-x-0 z-40 transition-all duration-300',
        isScrolled
          ? 'bg-background/95 backdrop-blur-md border-b border-border shadow-lg shadow-black/20'
          : 'bg-transparent'
      )}
    >
      <div className="container-site">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            href={buildLocalizedPath('/')}
            className={cn(
              'flex items-center gap-2 text-text-primary hover:text-accent transition-colors duration-200',
              focusRing,
              'rounded-md'
            )}
          >
            <span className="text-accent font-bold text-xl">
              {isRTL ? SITE.nameFa : SITE.name}
            </span>
          </Link>

          {/* Desktop nav */}
          <nav
            className="hidden md:flex items-center gap-1"
            aria-label={isRTL ? 'ناوبری اصلی' : 'Main navigation'}
          >
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.key}
                href={buildLocalizedPath(item.href)}
                className={cn(
                  'px-3 py-2 text-sm rounded-md transition-colors duration-150',
                  focusRing,
                  isActive(item.href)
                    ? 'text-accent bg-accent/10'
                    : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                )}
              >
                {isRTL ? item.labelFa : item.labelEn}
              </Link>
            ))}
          </nav>

          {/* Desktop right actions */}
          <div className="hidden md:flex items-center gap-3">
            {/* Language switcher */}
            <Link
              href={getAltLocalePath()}
              className={cn(
                'text-xs font-medium px-2.5 py-1.5 rounded-md',
                'text-text-muted hover:text-text-primary',
                'border border-border hover:border-accent/40',
                'transition-colors duration-150',
                focusRing
              )}
              aria-label={ta('langSwitch')}
            >
              {locale === 'fa' ? 'EN' : 'FA'}
            </Link>

            {/* CTA */}
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                window.location.href = buildLocalizedPath('/consultation')
              }}
            >
              {t('bookConsultation')}
            </Button>
          </div>

          {/* Mobile: lang + hamburger */}
          <div className="flex md:hidden items-center gap-2">
            <Link
              href={getAltLocalePath()}
              className={cn(
                'text-xs font-medium px-2 py-1 rounded',
                'text-text-muted hover:text-text-primary',
                'border border-border',
                focusRing
              )}
              aria-label={ta('langSwitch')}
            >
              {locale === 'fa' ? 'EN' : 'FA'}
            </Link>
            <button
              type="button"
              aria-label={isMenuOpen ? ta('closeMenu') : ta('openMenu')}
              aria-expanded={isMenuOpen}
              aria-controls="mobile-menu"
              onClick={() => setIsMenuOpen((v) => !v)}
              className={cn(
                'p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-white/5',
                'transition-colors duration-150',
                focusRing
              )}
            >
              {isMenuOpen ? (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div
          id="mobile-menu"
          className="md:hidden border-t border-border bg-background/98 backdrop-blur-md"
        >
          <nav
            className="container-site py-4 flex flex-col gap-1"
            aria-label={isRTL ? 'ناوبری موبایل' : 'Mobile navigation'}
          >
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.key}
                href={buildLocalizedPath(item.href)}
                className={cn(
                  'px-4 py-3 text-sm rounded-lg transition-colors duration-150',
                  focusRing,
                  isActive(item.href)
                    ? 'text-accent bg-accent/10'
                    : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                )}
              >
                {isRTL ? item.labelFa : item.labelEn}
              </Link>
            ))}
            <div className="pt-2 mt-2 border-t border-border">
              <Button
                variant="primary"
                size="md"
                fullWidth
                onClick={() => {
                  window.location.href = buildLocalizedPath('/consultation')
                }}
              >
                {t('bookConsultation')}
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
