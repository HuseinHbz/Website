'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { focusRing } from '@/lib/a11y'
import { NAV_ITEMS } from '@/lib/navigation'
import { SITE } from '@/lib/site'

interface HeaderProps {
  locale: string
}

export function Header({ locale }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const pathname = usePathname()
  const isRTL = locale === 'fa'

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 40)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => { setIsMenuOpen(false) }, [pathname])

  function buildLocalizedPath(path: string) {
    return `/${locale}${path === '/' ? '' : path}`
  }

  function getAltLocale() {
    return locale === 'fa' ? 'en' : 'fa'
  }

  function getAltLocalePath() {
    const withoutLocale = pathname.replace(/^\/(fa|en)/, '')
    return `/${getAltLocale()}${withoutLocale}`
  }

  function isActive(href: string) {
    const localizedHref = buildLocalizedPath(href)
    if (href === '/') return pathname === localizedHref
    return pathname.startsWith(localizedHref)
  }

  return (
    <header
      className={cn(
        'fixed top-0 inset-x-0 z-40 transition-all duration-500',
        isScrolled
          ? 'bg-background/95 backdrop-blur-xl border-b border-border/60 shadow-xl shadow-black/30'
          : 'bg-transparent'
      )}
    >
      <div className="container-site">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Brand */}
          <Link
            href={buildLocalizedPath('/')}
            className={cn('flex items-center gap-3 group', focusRing, 'rounded-md')}
          >
            {/* HBZ Logo Mark */}
            <div className="relative">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center font-black text-base text-white tracking-tight"
                style={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
                  boxShadow: '0 0 16px rgba(99,102,241,0.4)',
                }}
              >
                HBZ
              </div>
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-success border-2 border-background" />
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-bold text-text-primary group-hover:text-accent transition-colors">
                {isRTL ? 'حسین حبیب‌آذر' : 'Husein Habibazar'}
              </div>
              <div className="text-xs text-text-muted leading-none">
                {isRTL ? 'معمار زیرساخت' : 'Infrastructure Architect'}
              </div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-0.5" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.key}
                href={buildLocalizedPath(item.href)}
                className={cn(
                  'px-3.5 py-2 text-sm rounded-lg transition-all duration-150',
                  focusRing,
                  isActive(item.href)
                    ? 'text-accent bg-accent/10 font-medium'
                    : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                )}
              >
                {isRTL ? item.labelFa : item.labelEn}
              </Link>
            ))}
          </nav>

          {/* Desktop right */}
          <div className="hidden md:flex items-center gap-2">
            {/* Lang */}
            <Link
              href={getAltLocalePath()}
              className={cn(
                'text-xs font-semibold px-2.5 py-1.5 rounded-lg',
                'text-text-muted hover:text-text-primary',
                'border border-border hover:border-accent/40',
                'transition-all duration-150',
                focusRing
              )}
            >
              {locale === 'fa' ? 'EN' : 'FA'}
            </Link>

            {/* CTA */}
            <Link
              href={buildLocalizedPath('/consultation')}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all duration-200',
                'hover:scale-105 hover:shadow-lg hover:shadow-accent/30',
                focusRing
              )}
              style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)' }}
            >
              Book Consultation
            </Link>
          </div>

          {/* Mobile hamburger */}
          <div className="flex md:hidden items-center gap-2">
            <Link
              href={getAltLocalePath()}
              className={cn(
                'text-xs font-medium px-2 py-1 rounded border border-border text-text-muted',
                focusRing
              )}
            >
              {locale === 'fa' ? 'EN' : 'FA'}
            </Link>
            <button
              type="button"
              aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMenuOpen}
              onClick={() => setIsMenuOpen((v) => !v)}
              className={cn(
                'p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/5',
                'transition-colors duration-150',
                focusRing
              )}
            >
              <motion.div animate={{ rotate: isMenuOpen ? 90 : 0 }} transition={{ duration: 0.2 }}>
                {isMenuOpen ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </motion.div>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            id="mobile-menu"
            className="md:hidden border-t border-border bg-background/98 backdrop-blur-xl overflow-hidden"
          >
            <nav className="container-site py-4 flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.key}
                  href={buildLocalizedPath(item.href)}
                  className={cn(
                    'px-4 py-3 text-sm rounded-xl transition-colors duration-150',
                    focusRing,
                    isActive(item.href)
                      ? 'text-accent bg-accent/10 font-medium'
                      : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                  )}
                >
                  {isRTL ? item.labelFa : item.labelEn}
                </Link>
              ))}
              <div className="pt-3 mt-2 border-t border-border">
                <Link
                  href={buildLocalizedPath('/consultation')}
                  className="flex items-center justify-center w-full px-5 py-3 rounded-xl text-sm font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)' }}
                >
                  Book Free Consultation
                </Link>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
