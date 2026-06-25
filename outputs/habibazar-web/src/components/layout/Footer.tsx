'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { SITE } from '@/lib/site'

interface FooterProps {
  locale?: string
}

export function Footer({ locale = 'en' }: FooterProps) {
  const t = useTranslations('footer')
  const isRTL = locale === 'fa'
  const currentYear = new Date().getFullYear()

  const LINKS_EN = {
    Services: [
      { label: 'Network Design', href: '/services#network-design' },
      { label: 'Network Security', href: '/services#network-security' },
      { label: 'Virtualization', href: '/services#virtualization' },
      { label: 'Monitoring', href: '/services#monitoring' },
      { label: 'Automation', href: '/services#automation' },
    ],
    Company: [
      { label: 'About HBZ', href: '/about' },
      { label: 'Projects', href: '/projects' },
      { label: 'Blog', href: '/blog' },
      { label: 'Clients', href: '/#clients' },
    ],
    Contact: [
      { label: 'Book Consultation', href: '/consultation' },
      { label: 'Intro Call', href: '/consultation/intro-call' },
      { label: 'LinkedIn', href: SITE.social.linkedin, external: true },
    ],
  }

  const LINKS_FA = {
    'خدمات': [
      { label: 'طراحی شبکه', href: '/services#network-design' },
      { label: 'امنیت شبکه', href: '/services#network-security' },
      { label: 'مجازی‌سازی', href: '/services#virtualization' },
      { label: 'پایش', href: '/services#monitoring' },
      { label: 'خودکارسازی', href: '/services#automation' },
    ],
    'شرکت': [
      { label: 'درباره HBZ', href: '/about' },
      { label: 'پروژه‌ها', href: '/projects' },
      { label: 'وبلاگ', href: '/blog' },
      { label: 'مشتریان', href: '/#clients' },
    ],
    'تماس': [
      { label: 'رزرو مشاوره', href: '/consultation' },
      { label: 'تماس اولیه', href: '/consultation/intro-call' },
      { label: 'لینکدین', href: SITE.social.linkedin, external: true },
    ],
  }

  const LINKS = isRTL ? LINKS_FA : LINKS_EN

  function buildLocalizedPath(path: string) {
    if (locale === SITE.locale.default) return path
    return `/${locale}${path}`
  }

  return (
    <footer className="relative border-t border-border overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />

      <div className="container-site relative z-10">
        <div className="py-16 grid md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href={buildLocalizedPath('/')} className="flex items-center gap-3 mb-4 group">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm text-white"
                style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)', boxShadow: '0 0 16px rgba(99,102,241,0.3)' }}
              >
                HBZ
              </div>
              <div>
                <div className="text-sm font-bold text-text-primary group-hover:text-accent transition-colors">
                  {isRTL ? 'حسین حبیب‌آذر' : 'Husein Habibazar'}
                </div>
                <div className="text-xs text-text-muted">
                  {isRTL ? 'معمار زیرساخت' : 'Infrastructure Architect'}
                </div>
              </div>
            </Link>
            <p className="text-sm text-text-muted leading-relaxed mb-4">
              {isRTL
                ? 'طراحی، ایمن‌سازی و خودکارسازی زیرساخت سازمانی مدرن.'
                : 'Designing, Securing and Automating Modern Enterprise Infrastructure.'}
            </p>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-xs text-success font-medium">
                {t('available')}
              </span>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(LINKS).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-xs font-bold uppercase tracking-widest text-text-muted mb-4">{title}</h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={buildLocalizedPath(link.href)}
                      target={'external' in link && link.external ? '_blank' : undefined}
                      rel={'external' in link && link.external ? 'noopener noreferrer' : undefined}
                      className="text-sm text-text-secondary hover:text-accent transition-colors duration-150"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="py-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-text-muted">
            © {currentYear} {isRTL ? 'حسین حبیب‌آذر (HBZ).' : 'Husein Habibazar (HBZ).'}{' '}
            {t('rights')}.
          </p>
          <p className="text-xs text-text-muted">
            {t('tagline')}
          </p>
        </div>
      </div>
    </footer>
  )
}
