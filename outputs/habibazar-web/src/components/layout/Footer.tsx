import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from '@/lib/navigation'
import { SITE } from '@/lib/site'
import { focusRing } from '@/lib/a11y'

interface FooterProps {
  locale: string
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn('w-5 h-5', className)}
      aria-hidden="true"
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

export async function Footer({ locale }: FooterProps) {
  const t = await getTranslations({ locale, namespace: 'footer' })
  const isRTL = locale === 'fa'
  const currentYear = new Date().getFullYear()

  function buildLocalizedPath(path: string) {
    if (locale === SITE.locale.default) return path
    return `/${locale}${path}`
  }

  return (
    <footer className="bg-surface border-t border-border">
      <div className="container-site py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link
              href={buildLocalizedPath('/')}
              className={cn(
                'text-xl font-bold text-text-primary hover:text-accent transition-colors',
                focusRing,
                'rounded inline-block mb-3'
              )}
            >
              {isRTL ? SITE.nameFa : SITE.name}
            </Link>
            <p className="text-sm text-text-secondary leading-relaxed max-w-xs">
              {t('tagline')}
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-4 uppercase tracking-wider">
              {t('links')}
            </h3>
            <ul className="space-y-2.5">
              {NAV_ITEMS.map((item) => (
                <li key={item.key}>
                  <Link
                    href={buildLocalizedPath(item.href)}
                    className={cn(
                      'text-sm text-text-secondary hover:text-accent transition-colors duration-150',
                      focusRing,
                      'rounded'
                    )}
                  >
                    {isRTL ? item.labelFa : item.labelEn}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Social */}
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-4 uppercase tracking-wider">
              {t('contact')}
            </h3>
            <div className="flex items-center gap-3">
              <a
                href={SITE.social.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'p-2 rounded-lg text-text-muted hover:text-accent',
                  'border border-border hover:border-accent/40',
                  'transition-colors duration-150',
                  focusRing
                )}
                aria-label="LinkedIn"
              >
                <LinkedInIcon />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-text-muted">
            {currentYear} {isRTL ? `© ${SITE.nameFa}` : `© ${SITE.name}`} —{' '}
            {t('rights')}
          </p>
          <p className="text-xs text-text-muted">
            {isRTL ? SITE.ownerFa : SITE.owner}
          </p>
        </div>
      </div>
    </footer>
  )
}
