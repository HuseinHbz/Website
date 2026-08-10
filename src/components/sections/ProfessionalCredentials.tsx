'use client'

/**
 * 26.29 BUG-116 — «مدارک تخصصی» on the executive-profile page.
 *
 * Reuses the existing `credentials` table (managed at /admin/credentials); no
 * new module, no new table. Distinct from the organizational «گواهینامه‌های
 * سازمانی» block (`certifications`) that AboutSection already renders — see
 * بند ۳ for the naming split. Renders nothing when the list is empty, so a
 * deactivated credential really disappears (BUG-114 rule).
 */
import { motion } from 'framer-motion'

export interface PublicCredential {
  id: number
  type: string
  nameEn: string
  nameFa: string | null
  issuer: string | null
  issueDate: string | null
  credentialUrl: string | null
  badgeUrl: string | null
  color: string | null
  icon: string | null
}

const TYPE_ICON: Record<string, string> = {
  certification: '🏅', award: '🏆', membership: '🎫',
  badge: '🔖', license: '📜', recognition: '⭐',
}

export function ProfessionalCredentials({ locale = 'en', items }: { locale?: string; items: PublicCredential[] }) {
  const isRTL = locale === 'fa'
  if (!items || items.length === 0) return null

  return (
    <section className="section-padding relative" id="credentials" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="container-site relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <p className="section-label mb-3 justify-center">
            {isRTL ? 'اعتبارنامه‌های فردی' : 'Individual Accreditation'}
          </p>
          <h2 className="section-title mb-3">
            {isRTL ? 'مدارک تخصصی' : 'Professional Credentials'}
          </h2>
          <p className="section-subtitle max-w-xl mx-auto">
            {isRTL
              ? 'مدارک و اعتبارنامه‌های تخصصی احرازشده از سازمان‌های فناوری.'
              : 'Professional certifications and accreditations earned from technology vendors.'}
          </p>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {items.map((c, i) => {
            const name = isRTL ? (c.nameFa || c.nameEn) : c.nameEn
            const accent = c.color || '#6366f1'
            const card = (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.4) }}
                className="h-full rounded-xl p-4 text-center transition-all duration-300"
                style={{
                  background: 'rgba(13,13,23,0.8)',
                  border: `1px solid ${accent}2e`,
                  boxShadow: `0 0 0 1px ${accent}10 inset`,
                  '--card-accent': accent,
                } as React.CSSProperties}
              >
                <div
                  className="w-10 h-10 mx-auto mb-3 rounded-lg flex items-center justify-center text-lg"
                  style={{ background: `${accent}20`, border: `1px solid ${accent}30` }}
                >
                  {c.badgeUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={c.badgeUrl} alt={name} className="w-7 h-7 object-contain" />
                    : <span>{c.icon || TYPE_ICON[c.type] || '🏅'}</span>}
                </div>
                <p className="text-sm font-semibold text-text-primary leading-snug">{name}</p>
                {c.issuer && (
                  <span className="badge-pill mt-1.5" style={{ '--pill-color': `${accent}18`, '--pill-text': accent, '--pill-border': `${accent}30` } as React.CSSProperties}>
                    {c.issuer}
                  </span>
                )}
                {c.issueDate && (
                  <p className="text-2xs text-text-muted mt-0.5">
                    {isRTL ? String(c.issueDate).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]) : c.issueDate}
                  </p>
                )}
              </motion.div>
            )
            return c.credentialUrl
              ? <a key={c.id} href={c.credentialUrl} target="_blank" rel="noopener noreferrer">{card}</a>
              : <div key={c.id}>{card}</div>
          })}
        </div>
      </div>
    </section>
  )
}
