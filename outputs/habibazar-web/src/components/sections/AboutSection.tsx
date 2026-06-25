'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { slideUp, staggerContainer, fadeIn } from '@/lib/motion'

interface AboutSectionProps {
  locale?: string
}

interface TimelineItem {
  year: string
  titleEn: string
  titleFa: string
  descEn: string
  descFa: string
  color: string
}

interface SkillItem {
  nameEn: string
  nameFa: string
  categoryEn: string
  categoryFa: string
  level: number
}

interface CertItem {
  name: string
  icon: string
  color: string
}

const TIMELINE: TimelineItem[] = [
  {
    year: '2013',
    titleEn: 'Technical Technician',
    titleFa: 'تکنسین فنی',
    descEn: 'Started career in IT support, hardware maintenance and basic network administration.',
    descFa: 'آغاز فعالیت در پشتیبانی IT، تعمیر سخت‌افزار و مدیریت پایه شبکه.',
    color: '#6366f1',
  },
  {
    year: '2017',
    titleEn: 'IT Specialist',
    titleFa: 'متخصص IT',
    descEn: 'Expanded into system administration, server management, and enterprise networking.',
    descFa: 'توسعه تخصص به مدیریت سیستم، سرور و شبکه‌های سازمانی.',
    color: '#818cf8',
  },
  {
    year: '2021',
    titleEn: 'Network Operations Engineer',
    titleFa: 'مهندس عملیات شبکه',
    descEn: 'Designed and implemented complex LAN/WAN infrastructures, VPN solutions and security systems.',
    descFa: 'طراحی و پیاده‌سازی زیرساخت‌های پیچیده LAN/WAN، راه‌حل‌های VPN و سیستم‌های امنیتی.',
    color: '#06b6d4',
  },
  {
    year: '2024',
    titleEn: 'Senior Infrastructure Engineer',
    titleFa: 'مهندس ارشد زیرساخت',
    descEn: 'Led enterprise-scale virtualization, cloud integration, and infrastructure automation projects.',
    descFa: 'رهبری پروژه‌های مجازی‌سازی سازمانی، یکپارچه‌سازی ابر و خودکارسازی زیرساخت.',
    color: '#10b981',
  },
  {
    year: '2025',
    titleEn: 'Network Operations Supervisor',
    titleFa: 'سرپرست عملیات شبکه',
    descEn: 'Overseeing multi-site infrastructure operations, mentoring teams and driving digital transformation.',
    descFa: 'نظارت بر عملیات زیرساخت چند سایته، راهنمایی تیم‌ها و هدایت تحول دیجیتال.',
    color: '#f59e0b',
  },
]

const SKILLS: SkillItem[] = [
  { nameEn: 'Network Architecture', nameFa: 'معماری شبکه', categoryEn: 'Networking', categoryFa: 'شبکه', level: 95 },
  { nameEn: 'MikroTik RouterOS', nameFa: 'میکروتیک RouterOS', categoryEn: 'Networking', categoryFa: 'شبکه', level: 92 },
  { nameEn: 'Cisco IOS/IOS-XE', nameFa: 'سیسکو IOS', categoryEn: 'Networking', categoryFa: 'شبکه', level: 88 },
  { nameEn: 'Fortigate / Sophos', nameFa: 'فورتیگیت / سوفوس', categoryEn: 'Security', categoryFa: 'امنیت', level: 90 },
  { nameEn: 'Network Security', nameFa: 'امنیت شبکه', categoryEn: 'Security', categoryFa: 'امنیت', level: 88 },
  { nameEn: 'VMware vSphere', nameFa: 'VMware vSphere', categoryEn: 'Virtualization', categoryFa: 'مجازی‌سازی', level: 85 },
  { nameEn: 'Proxmox VE', nameFa: 'Proxmox VE', categoryEn: 'Virtualization', categoryFa: 'مجازی‌سازی', level: 82 },
  { nameEn: 'Linux Server Admin', nameFa: 'مدیریت سرور لینوکس', categoryEn: 'Systems', categoryFa: 'سیستم', level: 90 },
  { nameEn: 'Zabbix / Grafana', nameFa: 'زابیکس / گرافانا', categoryEn: 'Monitoring', categoryFa: 'پایش', level: 85 },
  { nameEn: 'Infrastructure Automation', nameFa: 'خودکارسازی زیرساخت', categoryEn: 'DevOps', categoryFa: 'دواپس', level: 78 },
  { nameEn: 'Veeam Backup & DR', nameFa: 'Veeam پشتیبان‌گیری', categoryEn: 'Operations', categoryFa: 'عملیات', level: 85 },
  { nameEn: 'VoIP Solutions', nameFa: 'راه‌حل‌های VoIP', categoryEn: 'Communications', categoryFa: 'ارتباطات', level: 80 },
]

const CERTS: CertItem[] = [
  { name: 'MikroTik MTCNA', icon: '🏅', color: '#c03030' },
  { name: 'MikroTik MTCRE', icon: '🏅', color: '#c03030' },
  { name: 'Fortinet NSE', icon: '🛡️', color: '#ee3124' },
  { name: 'VMware VCP', icon: '☁️', color: '#60b6e0' },
  { name: 'Linux LPIC', icon: '🐧', color: '#f59e0b' },
  { name: 'Cisco CCNA', icon: '🔷', color: '#1ba0d7' },
]

function SkillBar({ skill, isRTL, index }: { skill: SkillItem; isRTL: boolean; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.06, duration: 0.5 }}
    >
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-text-primary">
          {isRTL ? skill.nameFa : skill.nameEn}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted px-2 py-0.5 rounded-full bg-surface border border-border">
            {isRTL ? skill.categoryFa : skill.categoryEn}
          </span>
          <span className="text-xs font-mono text-accent">{skill.level}%</span>
        </div>
      </div>
      <div className="h-1.5 bg-surface rounded-full overflow-hidden border border-border">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${skill.level}%` }}
          viewport={{ once: true }}
          transition={{ delay: index * 0.06 + 0.3, duration: 0.8, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, #6366f1, #818cf8)', boxShadow: '0 0 8px rgba(99,102,241,0.4)' }}
        />
      </div>
    </motion.div>
  )
}

export function AboutSection({ locale = 'en' }: AboutSectionProps) {
  const isRTL = locale === 'fa'

  const BIO_FA = `حسین حبیب‌آذر (HBZ) معمار ارشد زیرساخت و مشاور امنیت شبکه با بیش از ۱۰ سال تجربه سازمانی در صنایع مختلف ایران است.`
  const BIO_DETAIL_FA = `او در طراحی معماری شبکه‌های مقاوم، پیاده‌سازی چارچوب‌های امنیتی چندلایه و ساخت پایپ‌لاین‌های خودکار زیرساخت تخصص دارد که هزینه‌های عملیاتی را کاهش داده و قابلیت اطمینان را افزایش می‌دهد.`
  const BIO_CLIENT_FA = `مشتریان او شامل رستوران‌ها، شرکت‌های خرده‌فروشی، هلدینگ‌ها و سازمان‌های صنعتی می‌شوند — کسب‌وکارهایی که به قابلیت اطمینان سازمانی نیاز دارند.`
  const BIO_METHOD_FA = `روش‌شناسی حسین ترکیبی از تخصص فنی عمیق و رویکرد کسب‌وکار محور است که اطمینان می‌دهد هر تصمیم زیرساختی به ارزش کسب‌وکار قابل اندازه‌گیری تبدیل می‌شود.`

  const BIO_EN = `Husein Habibazar (HBZ) is a Senior Infrastructure Architect and Network & Security Consultant with over 10 years of enterprise IT experience across diverse industries in Iran.`
  const BIO_DETAIL_EN = `He specializes in designing resilient network architectures, implementing multi-layer security frameworks, and building automated infrastructure pipelines that reduce operational overhead while improving reliability.`
  const BIO_CLIENT_EN = `His clientele includes restaurant chains, retail businesses, holding companies, and industrial organizations — enterprises that demand enterprise-grade reliability without enterprise-level complexity.`
  const BIO_METHOD_EN = `Husein's methodology combines deep technical expertise with a business-first approach, ensuring every infrastructure decision translates to measurable business value.`

  return (
    <section className="section-padding relative overflow-hidden" id="about">
      <div className="absolute inset-0 grid-bg opacity-100" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />

      <div className="container-site relative z-10">
        {/* Header */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <motion.p variants={fadeIn} className="section-label mb-3">
            {isRTL ? 'درباره' : 'About'}
          </motion.p>
          <motion.h2 variants={slideUp} className="section-title mb-4">
            {isRTL ? 'معمار پشت ' : 'The Architect Behind '}
            <span className="gradient-text">
              {isRTL ? 'زیرساخت' : 'The Infrastructure'}
            </span>
          </motion.h2>
          <motion.p variants={slideUp} className="section-subtitle max-w-2xl mx-auto">
            {isRTL
              ? 'بیش از یک دهه تجربه عملی در طراحی، ایمن‌سازی و خودکارسازی زیرساخت سازمانی در صنایع مختلف.'
              : 'Over a decade of hands-on experience designing, securing, and automating enterprise-grade infrastructure across industries.'}
          </motion.p>
        </motion.div>

        {/* Bio + Timeline */}
        <div className="grid md:grid-cols-2 gap-12 md:gap-20 mb-24">
          {/* Bio Card */}
          <motion.div
            initial={{ opacity: 0, x: isRTL ? 30 : -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <div className="glass-card p-8 h-full">
              <h3 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-accent/20 flex items-center justify-center text-sm">👤</span>
                {isRTL ? 'داستان حرفه‌ای' : 'Professional Story'}
              </h3>
              <div className="space-y-4 text-text-secondary leading-relaxed">
                <p>{isRTL ? BIO_FA : BIO_EN}</p>
                <p>{isRTL ? BIO_DETAIL_FA : BIO_DETAIL_EN}</p>
                <p>{isRTL ? BIO_CLIENT_FA : BIO_CLIENT_EN}</p>
                <p>{isRTL ? BIO_METHOD_FA : BIO_METHOD_EN}</p>
              </div>

              {/* Cert badges */}
              <div className="mt-6 pt-6 border-t border-border">
                <p className="text-xs text-text-muted mb-3 uppercase tracking-widest font-semibold">
                  {isRTL ? 'گواهینامه‌ها' : 'Certifications'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {CERTS.map((cert) => (
                    <span
                      key={cert.name}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ background: `${cert.color}15`, border: `1px solid ${cert.color}30`, color: cert.color }}
                    >
                      {cert.icon} {cert.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Timeline */}
          <motion.div
            initial={{ opacity: 0, x: isRTL ? -30 : 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <h3 className="text-xl font-bold text-text-primary mb-8 flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-accent/20 flex items-center justify-center text-sm">📈</span>
              {isRTL ? 'مسیر شغلی' : 'Career Timeline'}
            </h3>
            <div className="space-y-8">
              {TIMELINE.map((item, i) => (
                <motion.div
                  key={item.year}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="timeline-item"
                >
                  <div
                    className="timeline-dot"
                    style={{ background: `linear-gradient(135deg, ${item.color}, ${item.color}99)`, boxShadow: `0 0 12px ${item.color}50` }}
                  />
                  <div className="glass-card p-4 hover:border-accent/30 transition-colors">
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className="text-xs font-mono font-bold px-2 py-0.5 rounded"
                        style={{ background: `${item.color}20`, color: item.color, border: `1px solid ${item.color}30` }}
                      >
                        {item.year}
                      </span>
                      <h4 className="font-semibold text-text-primary text-sm">
                        {isRTL ? item.titleFa : item.titleEn}
                      </h4>
                    </div>
                    <p className="text-sm text-text-secondary leading-relaxed">
                      {isRTL ? item.descFa : item.descEn}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Skills Matrix */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <div className="text-center mb-10">
            <p className="section-label mb-2">{isRTL ? 'سطح تخصص فنی' : 'Technical Proficiency'}</p>
            <h3 className="text-2xl font-bold text-text-primary">
              {isRTL ? 'ماتریس مهارت‌ها' : 'Skills Matrix'}
            </h3>
          </div>
          <div className="glass-card p-8">
            <div className="grid md:grid-cols-2 gap-6">
              {SKILLS.map((skill, i) => (
                <SkillBar key={skill.nameEn} skill={skill} isRTL={isRTL} index={i} />
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
