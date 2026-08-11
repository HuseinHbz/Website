'use client'

import { motion } from 'framer-motion'
import { staggerContainer, slideUp, fadeIn, blurReveal, staggerFast } from '@/lib/motion'

interface DbClient { nameEn: string; nameFa: string; typeEn: string | null; typeFa: string | null; isTechPartner: boolean; logoUrl?: string | null }

interface CompanyPortfolioProps {
  locale?: string
  dbClients?: DbClient[] | null
}

const CLIENTS = [
  { nameEn: 'Kenzo Restaurant', nameFa: 'رستوران کنزو', icon: '🍽️', typeEn: 'Hospitality', typeFa: 'هتلداری' },
  { nameEn: 'Popcorn Holding', nameFa: 'هلدینگ پاپ‌کورن', icon: '🏢', typeEn: 'Holding', typeFa: 'هلدینگ' },
  { nameEn: 'Senso Group', nameFa: 'گروه سنسو', icon: '🍷', typeEn: 'F&B', typeFa: 'غذا و نوشیدنی' },
  { nameEn: 'Industrial Co.', nameFa: 'شرکت صنعتی', icon: '🏭', typeEn: 'Industrial', typeFa: 'صنعتی' },
  { nameEn: 'Retail Chain', nameFa: 'زنجیره خرده‌فروشی', icon: '🛒', typeEn: 'Retail', typeFa: 'خرده‌فروشی' },
  { nameEn: 'Tech Startup', nameFa: 'استارت‌آپ فناوری', icon: '💡', typeEn: 'Technology', typeFa: 'فناوری' },
  { nameEn: 'Medical Center', nameFa: 'مرکز پزشکی', icon: '🏥', typeEn: 'Healthcare', typeFa: 'بهداشت' },
  { nameEn: 'Logistics Firm', nameFa: 'شرکت لجستیک', icon: '🚛', typeEn: 'Logistics', typeFa: 'لجستیک' },
  { nameEn: 'Finance Group', nameFa: 'گروه مالی', icon: '💳', typeEn: 'Finance', typeFa: 'مالی' },
  { nameEn: 'Education Institute', nameFa: 'موسسه آموزشی', icon: '🎓', typeEn: 'Education', typeFa: 'آموزش' },
]

const TECH_PARTNERS = [
  { name: 'MikroTik', icon: '🌐', color: '#c03030' },
  { name: 'Cisco', icon: '🔷', color: '#1ba0d7' },
  { name: 'Fortigate', icon: '🛡️', color: '#ee3124' },
  { name: 'VMware', icon: '☁️', color: '#60b6e0' },
  { name: 'Ubiquiti', icon: '📡', color: '#0559c9' },
  { name: 'Zabbix', icon: '📊', color: '#d40000' },
  { name: 'Proxmox', icon: '🖥️', color: '#e57000' },
  { name: 'Sophos', icon: '🔒', color: '#2672b8' },
  { name: 'Veeam', icon: '💾', color: '#00b336' },
  { name: 'Grafana', icon: '📈', color: '#f46800' },
  { name: 'Linux', icon: '🐧', color: '#f59e0b' },
  { name: 'Ansible', icon: '⚙️', color: '#e00' },
]

function MarqueeRow({ items, reverse = false, speed = 30, isRTL = false }: {
  items: typeof CLIENTS | typeof TECH_PARTNERS
  reverse?: boolean
  speed?: number
  isRTL?: boolean
}) {
  // 26.29 BUG-115 — the marquee duplicates the list to make the loop seamless.
  // With only a handful of partners that duplicate is plainly visible (Senso,
  // Popcorn, Kenzo twice in a row). Below the threshold, render a centered
  // static row instead: no duplication, no animation, nothing to notice.
  const MIN_FOR_MARQUEE = 8
  const isMarquee = items.length >= MIN_FOR_MARQUEE
  const rendered = isMarquee ? [...items, ...items] : items
  if (items.length === 0) return null   // BUG-114: deactivated → show nothing

  return (
    <div className={`flex relative ${isMarquee ? 'overflow-hidden' : 'justify-center flex-wrap'}`}>
      <div
        className={`flex gap-4 items-center ${isMarquee ? '' : 'flex-wrap justify-center'}`}
        style={isMarquee ? {
          animation: `${reverse ? 'marqueeReverse' : 'marquee'} ${speed}s linear infinite`,
          willChange: 'transform',
        } : undefined}
      >
        {rendered.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-5 py-3 rounded-xl flex-shrink-0 hover:border-accent/40 transition-colors duration-200 cursor-default"
            style={{ background: 'rgba(13,13,23,0.8)', border: '1px solid rgba(26,26,46,0.8)', backdropFilter: 'blur(8px)' }}
          >
            {'logoUrl' in item && typeof item.logoUrl === 'string' && item.logoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={item.logoUrl as string} alt={('nameEn' in item ? item.nameEn : item.name)} className="w-8 h-8 object-contain" />
              : <span className="text-xl">{item.icon}</span>
            }
            <div>
              <div className="text-sm font-semibold text-text-primary whitespace-nowrap">
                {'nameEn' in item ? (isRTL ? item.nameFa : item.nameEn) : item.name}
              </div>
              <div className="text-xs text-text-muted">
                {'typeEn' in item ? (isRTL ? item.typeFa : item.typeEn) : (isRTL ? 'شریک فناوری' : 'Tech Partner')}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CompanyPortfolio({ locale = 'en', dbClients }: CompanyPortfolioProps) {
  const isRTL = locale === 'fa'

  // 26.29 BUG-114: null = never configured → demo logos; [] = all deactivated → empty
  const regularClients = dbClients !== null && dbClients !== undefined
    ? dbClients.filter(c => !c.isTechPartner).map(c => ({ nameEn: c.nameEn, nameFa: c.nameFa, icon: '🏢', typeEn: c.typeEn || '', typeFa: c.typeFa || '', logoUrl: c.logoUrl }))
    : CLIENTS

  const techPartners = dbClients !== null && dbClients !== undefined
    ? dbClients.filter(c => c.isTechPartner).map(c => ({ name: c.nameEn, icon: '🔧', color: '#7477ff', logoUrl: c.logoUrl }))
    : TECH_PARTNERS

  return (
    <section className="section-padding relative overflow-hidden" id="clients">
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #07070d 0%, #0d0d17 50%, #07070d 100%)' }} />
      <div className="absolute inset-0 grid-bg opacity-60" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent" />

      <div className="container-site relative z-10 mb-16">
        <motion.div
          variants={staggerFast}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="text-center"
        >
          <motion.p variants={blurReveal} className="section-label mb-4 justify-center">
            {isRTL ? 'شرکای سازمانی' : 'Enterprise Partners'}
          </motion.p>
          <motion.h2 variants={blurReveal} className="section-title mb-4">
            {isRTL ? 'مورد اعتماد ' : 'Trusted By '}
            <span className="gradient-text">{isRTL ? 'سازمان‌های پیشرو' : 'Industry Leaders'}</span>
          </motion.h2>
          <motion.p variants={blurReveal} className="section-subtitle max-w-xl mx-auto">
            {isRTL
              ? 'سازمان‌های پیشرو در صنایع مختلف به HBZ اعتماد کرده‌اند تا زیرساخت حیاتی‌شان را طراحی، ایمن و خودکار کند.'
              : 'Industry-leading organizations have trusted HBZ to design, secure, and automate their mission-critical infrastructure.'}
          </motion.p>
        </motion.div>
      </div>

      {/* Marquee */}
      <div className="space-y-4 relative">
        <div className="absolute inset-y-0 left-0 w-24 z-10 pointer-events-none" style={{ background: 'linear-gradient(90deg, #07070d, transparent)' }} />
        <div className="absolute inset-y-0 right-0 w-24 z-10 pointer-events-none" style={{ background: 'linear-gradient(270deg, #07070d, transparent)' }} />
        <MarqueeRow items={regularClients} speed={35} isRTL={isRTL} />
        <MarqueeRow items={techPartners} reverse speed={28} isRTL={isRTL} />
      </div>
      {/* Stats grid removed — was a third repetition of the same numbers
          already shown in Hero and in the dedicated Performance Indicators
          section (EnterpriseMetrics); see maintainer instruction to
          de-duplicate stats across the page. */}
    </section>
  )
}
