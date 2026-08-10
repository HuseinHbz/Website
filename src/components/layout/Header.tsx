'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { focusRing } from '@/lib/a11y'
import { DEFAULT_HEADER, type NavNode } from '@/lib/navigation'
import { SITE } from '@/lib/site'

interface HeaderProps {
  locale: string
  /** 26.31 بند ۱ — the menu now comes from the DB (server layout passes it in).
   *  Undefined only in old call sites/tests → the built-in structure (R4). */
  nav?: NavNode[]
}

export function Header({ locale, nav }: HeaderProps) {
  const items: NavNode[] = nav && nav.length > 0 ? nav : DEFAULT_HEADER
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [openDrop, setOpenDrop] = useState<string | null>(null)
  const [openAccordion, setOpenAccordion] = useState<string | null>(null)
  const [isScrolled, setIsScrolled] = useState(false)
  const pathname = usePathname()
  const isRTL = locale === 'fa'

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 40)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => { setIsMenuOpen(false); setOpenDrop(null); setOpenAccordion(null) }, [pathname])

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
    return pathname === localizedHref || pathname.startsWith(localizedHref + '/')
  }

  /** A dropdown parent is highlighted when the visitor is on any of its children. */
  function isBranchActive(item: NavNode) {
    return isActive(item.href) || item.children.some(c => isActive(c.href))
  }

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={cn(
        'site-header fixed top-0 inset-x-0 z-40 transition-all duration-500',
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
                className="w-9 h-9 rounded-lg flex items-center justify-center font-black text-base text-white tracking-tight transition-transform duration-300 group-hover:scale-105"
                style={{
                  background: 'linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-hover) 100%)',
                  boxShadow: '0 0 16px rgba(116,119,255,0.4)',
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
          <nav className="hidden lg:flex items-center gap-0.5" aria-label="Main navigation"
            onKeyDown={e => { if (e.key === 'Escape') setOpenDrop(null) }}>
            {items.map((item) => {
              const label = isRTL ? item.labelFa : item.labelEn
              const active = isBranchActive(item)
              const cls = cn(
                'nav-link-indicator px-3.5 py-2 text-sm rounded-lg transition-all duration-150',
                focusRing,
                active
                  ? 'text-accent font-medium'
                  : 'text-text-secondary hover:text-text-primary',
              )
              if (item.children.length === 0) {
                return <Link key={item.key} href={buildLocalizedPath(item.href)} data-active={active} className={cls}>{label}</Link>
              }
              const open = openDrop === item.key
              return (
                <div
                  key={item.key}
                  className="relative"
                  onMouseEnter={() => setOpenDrop(item.key)}
                  onMouseLeave={() => setOpenDrop(null)}
                >
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-haspopup="true"
                    data-active={active}
                    className={cn(cls, 'inline-flex items-center gap-1')}
                    onClick={() => setOpenDrop(open ? null : item.key)}
                  >
                    {label}
                    <span aria-hidden className={cn('text-3xs transition-transform', open && 'rotate-180')}>▾</span>
                  </button>
                  {open && (
                    <div
                      className={cn(
                        'absolute top-full mt-1 min-w-[13rem] rounded-xl border border-border bg-background/98 backdrop-blur-xl p-1.5 shadow-xl z-50',
                        isRTL ? 'right-0' : 'left-0',
                      )}
                      role="menu"
                    >
                      {item.children.map(child => (
                        <Link
                          key={child.key}
                          role="menuitem"
                          href={buildLocalizedPath(child.href)}
                          onClick={() => setOpenDrop(null)}
                          className={cn(
                            'block px-3 py-2 text-sm rounded-lg transition-colors',
                            focusRing,
                            isActive(child.href)
                              ? 'text-accent bg-accent/10 font-medium'
                              : 'text-text-secondary hover:text-text-primary hover:bg-white/5',
                          )}
                        >
                          {isRTL ? child.labelFa : child.labelEn}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>

          {/* Desktop right */}
          <div className="hidden md:flex items-center gap-2">
            {/* 26.31 بند ۴ — search entry point in the header (the /search page
                existed but nothing linked to it) */}
            <Link
              href={buildLocalizedPath('/search')}
              aria-label={isRTL ? 'جستجو' : 'Search'}
              title={isRTL ? 'جستجو' : 'Search'}
              className={cn(
                'px-2.5 py-1.5 rounded-lg text-text-muted hover:text-text-primary',
                'border border-border hover:border-accent/40 transition-all duration-150',
                focusRing,
              )}
            >
              <span aria-hidden>⌕</span>
            </Link>
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
                'btn-sheen px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all duration-200',
                'hover:scale-105 hover:shadow-lg hover:shadow-accent/30',
                focusRing
              )}
              style={{ background: 'linear-gradient(135deg, var(--color-brand), var(--color-brand-hover))' }}
            >
              {isRTL ? 'رزرو مشاوره' : 'Book Consultation'}
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
                'w-11 h-11 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/5',
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
              {items.map((item) => {
                const label = isRTL ? item.labelFa : item.labelEn
                const cls = cn(
                  'px-4 py-3 text-sm rounded-xl transition-colors duration-150',
                  focusRing,
                  isBranchActive(item)
                    ? 'text-accent bg-accent/10 font-medium'
                    : 'text-text-secondary hover:text-text-primary hover:bg-white/5',
                )
                if (item.children.length === 0) {
                  return <Link key={item.key} href={buildLocalizedPath(item.href)} className={cls}>{label}</Link>
                }
                // 26.31 بند ۲ — accordion on mobile: hover/HTML5 tricks do not
                // exist on touch, so the parent is a real tap target.
                const open = openAccordion === item.key
                return (
                  <div key={item.key}>
                    <button
                      type="button"
                      aria-expanded={open}
                      className={cn(cls, 'w-full flex items-center justify-between')}
                      onClick={() => setOpenAccordion(open ? null : item.key)}
                    >
                      {label}
                      <span aria-hidden className={cn('text-3xs transition-transform', open && 'rotate-180')}>▾</span>
                    </button>
                    {open && (
                      <div className="ps-4 flex flex-col gap-0.5 pb-1">
                        {item.children.map(child => (
                          <Link
                            key={child.key}
                            href={buildLocalizedPath(child.href)}
                            className={cn(
                              'px-4 py-2.5 text-sm rounded-lg transition-colors',
                              focusRing,
                              isActive(child.href)
                                ? 'text-accent bg-accent/10 font-medium'
                                : 'text-text-tertiary hover:text-text-primary hover:bg-white/5',
                            )}
                          >
                            {isRTL ? child.labelFa : child.labelEn}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              <div className="pt-3 mt-2 border-t border-border">
                <Link
                  href={buildLocalizedPath('/consultation')}
                  className="btn-sheen flex items-center justify-center w-full min-h-[44px] px-5 py-3 rounded-xl text-sm font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg, var(--color-brand), var(--color-brand-hover))' }}
                >
                  {isRTL ? 'رزرو مشاوره رایگان' : 'Book Free Consultation'}
                </Link>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
