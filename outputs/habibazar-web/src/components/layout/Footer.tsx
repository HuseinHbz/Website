'use client'

import Link from 'next/link'
import { SITE } from '@/lib/site'

const FOOTER_LINKS = {
  Services: [
    { label: 'Network Design', href: '/services#network-design' },
    { label: 'Network Security', href: '/services#network-security' },
    { label: 'Virtualization', href: '/services#virtualization' },
    { label: 'Monitoring', href: '/services#monitoring' },
    { label: 'Infrastructure Automation', href: '/services#automation' },
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

export function Footer({ locale }: { locale?: string }) {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="relative border-t border-border overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />

      <div className="container-site relative z-10">
        <div className="py-16 grid md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm text-white"
                style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)', boxShadow: '0 0 16px rgba(99,102,241,0.3)' }}
              >
                HBZ
              </div>
              <div>
                <div className="text-sm font-bold text-text-primary">Husein Habibazar</div>
                <div className="text-xs text-text-muted">Infrastructure Architect</div>
              </div>
            </div>
            <p className="text-sm text-text-muted leading-relaxed mb-4">
              Designing, Securing and Automating Modern Enterprise Infrastructure.
            </p>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-xs text-success font-medium">Available for Projects</span>
            </div>
          </div>

          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-xs font-bold uppercase tracking-widest text-text-muted mb-4">{title}</h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
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
            © {currentYear} Husein Habibazar (HBZ). All rights reserved.
          </p>
          <p className="text-xs text-text-muted">
            Infrastructure Architect · Network & Security Consultant
          </p>
        </div>
      </div>
    </footer>
  )
}
