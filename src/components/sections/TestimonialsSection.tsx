'use client'

/**
 * 26.31 بند ۵ — client testimonials on the homepage.
 *
 * They were only rendered inside `/solutions/[slug]` — a page that was itself
 * missing from the menu, so the content was double-hidden. Same `testimonials`
 * table, no new module (Reuse rule). Renders nothing when the list is empty, so
 * deactivating them really removes them (26.29 rule 22).
 */
import { motion } from 'framer-motion'

export interface PublicTestimonial {
  id: number
  clientName: string
  clientTitle: string | null
  clientCompany: string | null
  clientAvatar: string | null
  quoteEn: string
  quoteFa: string | null
  rating: number
}

export function TestimonialsSection({ locale = 'en', items }: { locale?: string; items: PublicTestimonial[] }) {
  const isRTL = locale === 'fa'
  if (!items || items.length === 0) return null

  return (
    <section className="section-padding relative" id="testimonials" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="container-site relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <p className="section-label mb-3 justify-center">
            {isRTL ? 'صدای مشتریان' : 'Client Voices'}
          </p>
          <h2 className="section-title mb-3">
            {isRTL ? 'نظرات مشتریان' : 'What Clients Say'}
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((t, i) => {
            const quote = isRTL ? (t.quoteFa || t.quoteEn) : t.quoteEn
            return (
              <motion.figure
                key={t.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: Math.min(i * 0.06, 0.4) }}
                className="rounded-2xl p-6 h-full flex flex-col"
                style={{ background: 'rgba(13,13,23,0.8)', border: '1px solid rgba(26,26,46,0.8)' }}
              >
                <div className="flex gap-0.5 mb-3" aria-label={`${t.rating} / 5`}>
                  {Array.from({ length: 5 }).map((_, n) => (
                    <span key={n} aria-hidden className={n < t.rating ? 'text-accent' : 'text-text-muted/30'}>★</span>
                  ))}
                </div>
                <blockquote className="text-sm text-text-secondary leading-relaxed flex-1">“{quote}”</blockquote>
                <figcaption className="mt-5 pt-4 border-t border-border flex items-center gap-3">
                  {t.clientAvatar
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={t.clientAvatar} alt={t.clientName} className="w-9 h-9 rounded-full object-cover" />
                    : <div className="w-9 h-9 rounded-full bg-accent/15 border border-accent/25 flex items-center justify-center text-sm font-bold text-accent">{t.clientName.charAt(0)}</div>}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary truncate">{t.clientName}</p>
                    {(t.clientTitle || t.clientCompany) && (
                      <p className="text-xs text-text-muted truncate">
                        {[t.clientTitle, t.clientCompany].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                </figcaption>
              </motion.figure>
            )
          })}
        </div>
      </div>
    </section>
  )
}
