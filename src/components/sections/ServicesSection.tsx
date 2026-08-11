'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { slideUp, staggerContainer, fadeIn, blurReveal, staggerFast } from '@/lib/motion'

interface ServiceData {
  id: string
  icon: string
  titleEn: string
  titleFa: string
  categoryEn: string
  categoryFa: string
  color: string
  shortDescEn: string
  shortDescFa: string
  featuresEn: string[]
  featuresFa: string[]
  technologies: string[]
}

interface DbService {
  id: number; slug: string; titleEn: string; titleFa: string; categoryEn: string; categoryFa: string
  shortDescEn: string | null; shortDescFa: string | null; featuresEn: string | null; featuresFa: string | null
  icon: string | null; color: string | null
}

interface ServicesSectionProps {
  locale?: string
  dbServices?: DbService[] | null
}

const SERVICES: ServiceData[] = [
  {
    id: 'network-design',
    icon: '🌐',
    titleEn: 'Network Design & Architecture',
    titleFa: 'طراحی و معماری شبکه',
    categoryEn: 'Infrastructure',
    categoryFa: 'زیرساخت',
    color: '#7477ff',
    shortDescEn: 'Enterprise LAN/WAN design with high availability, redundancy, and performance optimization.',
    shortDescFa: 'طراحی LAN/WAN سازمانی با دسترسی‌پذیری بالا، افزونگی و بهینه‌سازی عملکرد.',
    featuresEn: ['LAN / WAN Architecture', 'VPN & SD-WAN Solutions', 'Wireless Infrastructure', 'Network Segmentation', 'QoS & Traffic Management'],
    featuresFa: ['معماری LAN / WAN', 'راه‌حل‌های VPN و SD-WAN', 'زیرساخت بی‌سیم', 'تقسیم‌بندی شبکه', 'مدیریت QoS و ترافیک'],
    technologies: ['Cisco', 'MikroTik', 'Ubiquiti', 'Fortigate', 'SD-WAN'],
  },
  {
    id: 'network-security',
    icon: '🛡️',
    titleEn: 'Network Security',
    titleFa: 'امنیت شبکه',
    categoryEn: 'Security',
    categoryFa: 'امنیت',
    color: '#ef4444',
    shortDescEn: 'Multi-layer security architecture protecting your business against modern cyber threats.',
    shortDescFa: 'معماری امنیتی چندلایه برای حفاظت از کسب‌وکار در برابر تهدیدات سایبری مدرن.',
    featuresEn: ['Firewall Design & Management', 'IDS/IPS Implementation', 'Security Hardening', 'Zero-Trust Architecture', 'Penetration Testing Support'],
    featuresFa: ['طراحی و مدیریت فایروال', 'پیاده‌سازی IDS/IPS', 'سخت‌سازی امنیتی', 'معماری Zero-Trust', 'پشتیبانی تست نفوذ'],
    technologies: ['Fortigate', 'Sophos', 'MikroTik', 'Snort/Suricata', 'Fail2Ban'],
  },
  {
    id: 'virtualization',
    icon: '🖥️',
    titleEn: 'Virtualization & Cloud',
    titleFa: 'مجازی‌سازی و ابر',
    categoryEn: 'Infrastructure',
    categoryFa: 'زیرساخت',
    color: '#60b6e0',
    shortDescEn: 'Design and deploy virtualized environments that maximize hardware utilization and flexibility.',
    shortDescFa: 'طراحی و استقرار محیط‌های مجازی که استفاده از سخت‌افزار و انعطاف را به حداکثر می‌رسانند.',
    featuresEn: ['VMware vSphere/ESXi', 'Hyper-V Environments', 'Proxmox VE Clusters', 'Storage Architecture (SAN/NAS)', 'High Availability Clustering'],
    featuresFa: ['VMware vSphere/ESXi', 'محیط‌های Hyper-V', 'کلاسترهای Proxmox VE', 'معماری ذخیره‌سازی (SAN/NAS)', 'کلاسترینگ با دسترسی‌پذیری بالا'],
    technologies: ['VMware', 'Proxmox', 'Hyper-V', 'TrueNAS', 'Ceph'],
  },
  {
    id: 'monitoring',
    icon: '📊',
    titleEn: 'Monitoring & Observability',
    titleFa: 'پایش و مشاهده‌پذیری',
    categoryEn: 'Operations',
    categoryFa: 'عملیات',
    color: '#f59e0b',
    shortDescEn: 'End-to-end visibility into your infrastructure with real-time alerting and performance dashboards.',
    shortDescFa: 'دید کامل به زیرساخت با هشداردهی لحظه‌ای و داشبوردهای عملکرد.',
    featuresEn: ['Infrastructure Monitoring', 'Real-Time Alerting', 'Custom Dashboards', 'Capacity Planning', 'Log Management'],
    featuresFa: ['پایش زیرساخت', 'هشداردهی لحظه‌ای', 'داشبوردهای اختصاصی', 'برنامه‌ریزی ظرفیت', 'مدیریت لاگ'],
    technologies: ['Zabbix', 'Grafana', 'Prometheus', 'SolarWinds', 'PRTG'],
  },
  {
    id: 'backup-dr',
    icon: '💾',
    titleEn: 'Backup & Disaster Recovery',
    titleFa: 'پشتیبان‌گیری و بازیابی',
    categoryEn: 'Operations',
    categoryFa: 'عملیات',
    color: '#10b981',
    shortDescEn: 'Comprehensive backup strategies and DR plans ensuring business continuity.',
    shortDescFa: 'استراتژی‌های جامع پشتیبان‌گیری و برنامه DR برای تداوم کسب‌وکار.',
    featuresEn: ['Backup Strategy Design', 'Veeam Implementation', 'RTO/RPO Planning', 'DR Testing & Validation', 'Offsite Replication'],
    featuresFa: ['طراحی استراتژی پشتیبان‌گیری', 'پیاده‌سازی Veeam', 'برنامه‌ریزی RTO/RPO', 'تست و اعتبارسنجی DR', 'رپلیکیشن برون‌سازمانی'],
    technologies: ['Veeam', 'Acronis', 'TrueNAS', 'Rsync', 'AWS S3'],
  },
  {
    id: 'linux',
    icon: '🐧',
    titleEn: 'Linux Infrastructure',
    titleFa: 'زیرساخت لینوکس',
    categoryEn: 'Systems',
    categoryFa: 'سیستم',
    color: '#f59e0b',
    shortDescEn: 'Expert Linux server administration, automation, and open-source infrastructure solutions.',
    shortDescFa: 'مدیریت تخصصی سرور لینوکس، خودکارسازی و راه‌حل‌های زیرساختی متن‌باز.',
    featuresEn: ['RHEL / Ubuntu / Debian', 'Web Server Stacks (Nginx, Apache)', 'Database Administration', 'Shell Scripting & Automation', 'Container Orchestration'],
    featuresFa: ['RHEL / Ubuntu / Debian', 'وب سرور (Nginx، Apache)', 'مدیریت پایگاه‌داده', 'اسکریپت‌نویسی و خودکارسازی', 'ارکستراسیون کانتینر'],
    technologies: ['Ubuntu', 'RHEL', 'Nginx', 'Docker', 'Ansible'],
  },
  {
    id: 'microsoft',
    icon: '🪟',
    titleEn: 'Microsoft Services',
    titleFa: 'خدمات مایکروسافت',
    categoryEn: 'Systems',
    categoryFa: 'سیستم',
    color: '#00adef',
    shortDescEn: 'Windows Server environments, Active Directory, and Microsoft ecosystem management.',
    shortDescFa: 'محیط‌های Windows Server، Active Directory و مدیریت اکوسیستم مایکروسافت.',
    featuresEn: ['Active Directory Design', 'Windows Server 2022', 'Exchange / Mail Services', 'Group Policy Management', 'Azure AD Integration'],
    featuresFa: ['طراحی Active Directory', 'Windows Server 2022', 'Exchange / سرویس ایمیل', 'مدیریت Group Policy', 'یکپارچه‌سازی Azure AD'],
    technologies: ['Windows Server', 'Active Directory', 'Exchange', 'Azure', 'SCCM'],
  },
  {
    id: 'voip',
    icon: '📞',
    titleEn: 'VoIP Solutions',
    titleFa: 'راه‌حل‌های VoIP',
    categoryEn: 'Communications',
    categoryFa: 'ارتباطات',
    color: '#9698ff',
    shortDescEn: 'Modern IP telephony systems and unified communications for businesses.',
    shortDescFa: 'سیستم‌های تلفنی IP مدرن و ارتباطات یکپارچه برای کسب‌وکارها.',
    featuresEn: ['Asterisk / FreePBX', 'IP Phone Configuration', 'Call Center Solutions', 'SIP Trunk Integration', 'IVR & Auto-Attendant'],
    featuresFa: ['Asterisk / FreePBX', 'پیکربندی تلفن IP', 'راه‌حل‌های مرکز تماس', 'یکپارچه‌سازی SIP Trunk', 'IVR و پاسخگوی خودکار'],
    technologies: ['Asterisk', 'FreePBX', 'Yealink', '3CX', 'SIP Protocol'],
  },
  {
    id: 'automation',
    icon: '⚙️',
    titleEn: 'Infrastructure Automation',
    titleFa: 'خودکارسازی زیرساخت',
    categoryEn: 'DevOps',
    categoryFa: 'دواپس',
    color: '#22d3ee',
    shortDescEn: 'Automate repetitive tasks and provisioning to reduce human error and speed up operations.',
    shortDescFa: 'خودکارسازی وظایف تکراری و فراهم‌سازی برای کاهش خطای انسانی و تسریع عملیات.',
    featuresEn: ['Ansible Playbooks', 'Configuration Management', 'CI/CD for Infrastructure', 'Network Automation', 'Monitoring Automation'],
    featuresFa: ['Ansible Playbook‌ها', 'مدیریت پیکربندی', 'CI/CD برای زیرساخت', 'خودکارسازی شبکه', 'خودکارسازی پایش'],
    technologies: ['Ansible', 'Terraform', 'Python', 'Bash', 'GitLab CI'],
  },
]

const CATEGORIES_EN = ['All', 'Infrastructure', 'Security', 'Operations', 'Systems', 'Communications', 'DevOps']
const CATEGORIES_FA = ['همه', 'زیرساخت', 'امنیت', 'عملیات', 'سیستم', 'ارتباطات', 'دواپس']

function parseArr(v: string | null | undefined): string[] {
  if (!v) return []
  try { const p = JSON.parse(v); return Array.isArray(p) ? p : [] } catch { return [] }
}

export function ServicesSection({ locale = 'en', dbServices }: ServicesSectionProps) {
  const isRTL = locale === 'fa'
  const [activeCategory, setActiveCategory] = useState(isRTL ? 'همه' : 'All')
  const [expandedService, setExpandedService] = useState<string | null>(null)

  // 26.29 BUG-114: null = never configured → demo; [] = all deactivated → show nothing
  const SERVICES_DATA: ServiceData[] = dbServices !== null && dbServices !== undefined
    ? dbServices.map((s) => ({
        id: s.slug,
        icon: s.icon || '🔧',
        titleEn: s.titleEn,
        titleFa: s.titleFa,
        categoryEn: s.categoryEn,
        categoryFa: s.categoryFa,
        color: s.color || '#7477ff',
        shortDescEn: s.shortDescEn || '',
        shortDescFa: s.shortDescFa || '',
        featuresEn: parseArr(s.featuresEn),
        featuresFa: parseArr(s.featuresFa),
        technologies: [],
      }))
    : SERVICES

  const allCatsEn = ['All', ...Array.from(new Set(SERVICES_DATA.map(s => s.categoryEn)))]
  const allCatsFa = ['همه', ...Array.from(new Set(SERVICES_DATA.map(s => s.categoryFa)))]
  const CATEGORIES = isRTL ? allCatsFa : allCatsEn

  const filtered = (activeCategory === 'All' || activeCategory === 'همه')
    ? SERVICES_DATA
    : SERVICES_DATA.filter(s => (isRTL ? s.categoryFa : s.categoryEn) === activeCategory)

  return (
    <section className="section-padding relative overflow-hidden" id="services">
      <div className="absolute inset-0 grid-bg" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-DEFAULT/30 to-transparent" />

      <div className="container-site relative z-10">
        {/* Header */}
        <motion.div
          variants={staggerFast}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <motion.p variants={blurReveal} className="section-label mb-4 justify-center">
            {isRTL ? 'راهکارهای فناوری' : 'Technology Solutions'}
          </motion.p>
          <motion.h2 variants={blurReveal} className="section-title mb-4">
            {isRTL ? 'آنچه ' : 'What '}
            <span className="gradient-text-cyan">HBZ</span>
            {isRTL ? ' ارائه می‌دهد' : ' Delivers'}
          </motion.h2>
          <motion.p variants={blurReveal} className="section-subtitle max-w-2xl mx-auto">
            {isRTL
              ? 'مشاوره زیرساختی جامع از طراحی تا استقرار، از پایش تا خودکارسازی — برای قابلیت اطمینان سازمانی.'
              : 'End-to-end infrastructure consulting from design to deployment, monitoring to automation — built for enterprise reliability.'}
          </motion.p>
        </motion.div>

        {/* Category Filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-wrap justify-center gap-2 mb-12"
        >
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeCategory === cat
                  ? 'bg-accent text-white shadow-lg shadow-accent/30'
                  : 'bg-surface border border-border text-text-secondary hover:text-text-primary hover:border-accent/30'
              }`}
            >
              {cat}
            </button>
          ))}
        </motion.div>

        {/* Services Grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filtered.map((service, i) => (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07, duration: 0.4 }}
                className="service-card cursor-pointer"
                style={{ '--card-accent': service.color } as React.CSSProperties}
                onClick={() => setExpandedService(expandedService === service.id ? null : service.id)}
              >
                <div
                  className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl opacity-60"
                  style={{ background: `linear-gradient(90deg, ${service.color}, transparent)` }}
                />
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                    style={{ background: `${service.color}15`, border: `1px solid ${service.color}30` }}
                  >
                    {service.icon}
                  </div>
                  <span
                    className="badge-pill"
                    style={{ '--pill-color': `${service.color}18`, '--pill-text': service.color, '--pill-border': `${service.color}30` } as React.CSSProperties}
                  >
                    {isRTL ? service.categoryFa : service.categoryEn}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-text-primary mb-2">
                  {isRTL ? service.titleFa : service.titleEn}
                </h3>
                <p className="text-base text-text-secondary leading-relaxed mb-4">
                  {isRTL ? service.shortDescFa : service.shortDescEn}
                </p>

                <AnimatePresence>
                  {expandedService === service.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-4 border-t border-border mt-2 space-y-4">
                        <div>
                          <p className="text-xs text-text-muted uppercase tracking-widest mb-2 font-semibold">
                            {isRTL ? 'خدمات شامل' : 'Services Include'}
                          </p>
                          <ul className="space-y-1">
                            {(isRTL ? service.featuresFa : service.featuresEn).map((f) => (
                              <li key={f} className="flex items-center gap-2 text-base text-text-secondary">
                                <span style={{ color: service.color }}>▸</span>
                                {f}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs text-text-muted uppercase tracking-widest mb-2 font-semibold">
                            {isRTL ? 'تکنولوژی‌ها' : 'Technologies'}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {service.technologies.map((t) => (
                              <span
                                key={t}
                                className="px-2 py-0.5 text-xs rounded-md font-medium"
                                style={{ background: `${service.color}15`, color: service.color, border: `1px solid ${service.color}25` }}
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
                  <span className="text-xs text-text-muted">
                    {expandedService === service.id
                      ? (isRTL ? 'کلیک برای بستن' : 'Click to collapse')
                      : (isRTL ? 'کلیک برای باز کردن' : 'Click to expand')}
                  </span>
                  <motion.div animate={{ rotate: expandedService === service.id ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </motion.div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        {/* CTA Banner */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="mt-16 relative rounded-2xl overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(6,182,212,0.1) 100%)', border: '1px solid rgba(99,102,241,0.25)' }}
        >
          <div className="absolute inset-0 grid-bg opacity-50" />
          <div className="relative z-10 p-8 md:p-12 text-center">
            <h3 className="text-2xl md:text-3xl font-bold text-text-primary mb-3">
              {isRTL ? 'مطمئن نیستید کدام خدمت مناسب شماست؟' : 'Not sure which service fits your needs?'}
            </h3>
            <p className="text-text-secondary mb-6 max-w-xl mx-auto">
              {isRTL
                ? 'یک جلسه کشف ۳۰ دقیقه‌ای رایگان رزرو کنید و ارزیابی شخصی زیرساخت دریافت کنید.'
                : 'Book a free 30-minute discovery call and get a personalized infrastructure assessment.'}
            </p>
            <Link
              href="/consultation"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all duration-200 hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #7477ff, #9698ff)', boxShadow: '0 8px 30px rgba(99,102,241,0.3)' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {isRTL ? 'رزرو مشاوره رایگان' : 'Book Free Consultation'}
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
