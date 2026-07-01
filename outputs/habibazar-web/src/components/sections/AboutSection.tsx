'use client'

import { motion } from 'framer-motion'
import { slideUp, staggerContainer, fadeIn } from '@/lib/motion'

interface DbTimeline { year: string; titleEn: string; titleFa: string; descEn: string | null; descFa: string | null; color: string | null }
interface DbSkill { nameEn: string; nameFa: string; categoryEn: string; categoryFa: string; level: number; color?: string | null; icon?: string | null }
interface DbCert { nameEn: string; nameFa: string; issuer?: string | null; color: string | null }
interface DbAbout { bio: string | null; photoUrl: string | null; resumeUrl: string | null; headline: string | null; subheadline: string | null }

interface ContactInfo { email?: string | null; phone?: string | null; locationEn?: string | null; locationFa?: string | null }
interface SocialLinks { linkedin?: string | null; github?: string | null; twitter?: string | null; instagram?: string | null; telegram?: string | null; email?: string | null }

interface AboutSectionProps {
  locale?: string
  dbAbout?: DbAbout | null
  dbTimeline?: DbTimeline[]
  dbSkills?: DbSkill[]
  dbCerts?: DbCert[]
  contactInfo?: ContactInfo
  socialLinks?: SocialLinks
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
  color: string
  icon: string | null
}

interface CertItem {
  nameEn: string
  nameFa: string
  issuer: string
  color: string
}

const TIMELINE: TimelineItem[] = [
  { year: '2013', titleEn: 'Technical Technician', titleFa: 'تکنسین فنی', descEn: 'Started career in IT support, hardware maintenance and basic network administration.', descFa: 'آغاز فعالیت در پشتیبانی IT، تعمیر سخت‌افزار و مدیریت پایه شبکه.', color: '#6366f1' },
  { year: '2017', titleEn: 'IT Specialist', titleFa: 'متخصص IT', descEn: 'Expanded into system administration, server management, and enterprise networking.', descFa: 'توسعه تخصص به مدیریت سیستم، سرور و شبکه‌های سازمانی.', color: '#818cf8' },
  { year: '2021', titleEn: 'Network Operations Engineer', titleFa: 'مهندس عملیات شبکه', descEn: 'Designed and implemented complex LAN/WAN infrastructures, VPN solutions and security systems.', descFa: 'طراحی و پیاده‌سازی زیرساخت‌های پیچیده LAN/WAN، راه‌حل‌های VPN و سیستم‌های امنیتی.', color: '#06b6d4' },
  { year: '2024', titleEn: 'Senior Infrastructure Engineer', titleFa: 'مهندس ارشد زیرساخت', descEn: 'Led enterprise-scale virtualization, cloud integration, and infrastructure automation projects.', descFa: 'رهبری پروژه‌های مجازی‌سازی سازمانی، یکپارچه‌سازی ابر و خودکارسازی زیرساخت.', color: '#10b981' },
  { year: '2025', titleEn: 'Network Operations Supervisor', titleFa: 'سرپرست عملیات شبکه', descEn: 'Overseeing multi-site infrastructure operations, mentoring teams and driving digital transformation.', descFa: 'نظارت بر عملیات زیرساخت چند سایته، راهنمایی تیم‌ها و هدایت تحول دیجیتال.', color: '#f59e0b' },
]

const SKILLS: SkillItem[] = [
  { nameEn: 'Network Architecture', nameFa: 'معماری شبکه', categoryEn: 'Networking', categoryFa: 'شبکه', level: 95, color: '#6366f1', icon: '/uploads/logos/mikrotik.svg' },
  { nameEn: 'MikroTik RouterOS', nameFa: 'میکروتیک RouterOS', categoryEn: 'Networking', categoryFa: 'شبکه', level: 92, color: '#c03030', icon: '/uploads/logos/mikrotik.svg' },
  { nameEn: 'Cisco IOS/IOS-XE', nameFa: 'سیسکو IOS', categoryEn: 'Networking', categoryFa: 'شبکه', level: 88, color: '#1ba0d7', icon: '/uploads/logos/cisco.svg' },
  { nameEn: 'Fortigate / Sophos', nameFa: 'فورتیگیت / سوفوس', categoryEn: 'Security', categoryFa: 'امنیت', level: 90, color: '#ee3124', icon: '/uploads/logos/fortinet.svg' },
  { nameEn: 'Network Security', nameFa: 'امنیت شبکه', categoryEn: 'Security', categoryFa: 'امنیت', level: 88, color: '#ef4444', icon: '/uploads/logos/fortinet.svg' },
  { nameEn: 'VMware vSphere', nameFa: 'VMware vSphere', categoryEn: 'Virtualization', categoryFa: 'مجازی‌سازی', level: 85, color: '#60b6e0', icon: '/uploads/logos/vmware.svg' },
  { nameEn: 'Proxmox VE', nameFa: 'Proxmox VE', categoryEn: 'Virtualization', categoryFa: 'مجازی‌سازی', level: 82, color: '#e57000', icon: '/uploads/logos/proxmox.svg' },
  { nameEn: 'Linux Server Admin', nameFa: 'مدیریت سرور لینوکس', categoryEn: 'Systems', categoryFa: 'سیستم', level: 90, color: '#f59e0b', icon: '/uploads/logos/linux.svg' },
  { nameEn: 'Zabbix / Grafana', nameFa: 'زابیکس / گرافانا', categoryEn: 'Monitoring', categoryFa: 'پایش', level: 85, color: '#f59e0b', icon: '/uploads/logos/zabbix.svg' },
  { nameEn: 'Infrastructure Automation', nameFa: 'خودکارسازی زیرساخت', categoryEn: 'Automation', categoryFa: 'خودکارسازی', level: 78, color: '#06b6d4', icon: '/uploads/logos/ansible.svg' },
  { nameEn: 'Veeam Backup & DR', nameFa: 'Veeam پشتیبان‌گیری', categoryEn: 'Operations', categoryFa: 'عملیات', level: 85, color: '#00b336', icon: '/uploads/logos/windows-server.svg' },
  { nameEn: 'VoIP Solutions', nameFa: 'راه‌حل‌های VoIP', categoryEn: 'Communications', categoryFa: 'ارتباطات', level: 80, color: '#818cf8', icon: '/uploads/logos/linux.svg' },
]

const CERTS: CertItem[] = [
  { nameEn: 'MikroTik MTCNA', nameFa: 'میکروتیک MTCNA', issuer: 'MikroTik', color: '#c03030' },
  { nameEn: 'MikroTik MTCRE', nameFa: 'میکروتیک MTCRE', issuer: 'MikroTik', color: '#c03030' },
  { nameEn: 'Fortinet NSE', nameFa: 'فورتینت NSE', issuer: 'Fortinet', color: '#ee3124' },
  { nameEn: 'VMware VCP', nameFa: 'VMware VCP', issuer: 'VMware', color: '#60b6e0' },
  { nameEn: 'Linux LPIC', nameFa: 'لینوکس LPIC', issuer: 'Linux Professional Institute', color: '#f59e0b' },
  { nameEn: 'Cisco CCNA', nameFa: 'سیسکو CCNA', issuer: 'Cisco', color: '#1ba0d7' },
]

// Map issuer to logo SVG path
const ISSUER_LOGOS: Record<string, string> = {
  'MikroTik': '/uploads/logos/mikrotik.svg',
  'Fortinet': '/uploads/logos/fortinet.svg',
  'VMware': '/uploads/logos/vmware.svg',
  'Linux Professional Institute': '/uploads/logos/linux.svg',
  'Cisco': '/uploads/logos/cisco.svg',
}

// Level dots — 5 dots filled proportionally
function LevelDots({ level, color }: { level: number; color: string }) {
  const filled = Math.round(level / 20)
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(i => (
        <div
          key={i}
          className="w-2 h-2 rounded-full transition-all"
          style={{ background: i <= filled ? color : `${color}25`, boxShadow: i <= filled ? `0 0 4px ${color}60` : 'none' }}
        />
      ))}
    </div>
  )
}

// Group skills by category
function groupByCategory(skills: SkillItem[], isRTL: boolean): Map<string, SkillItem[]> {
  const map = new Map<string, SkillItem[]>()
  for (const s of skills) {
    const cat = isRTL ? s.categoryFa : s.categoryEn
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(s)
  }
  return map
}

function SkillCard({ skill, isRTL, index }: { skill: SkillItem; isRTL: boolean; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      className="relative group flex items-center gap-3 p-3 rounded-xl border border-border bg-surface/50 hover:border-accent/40 hover:bg-surface transition-all duration-200"
    >
      {/* Logo */}
      <div
        className="w-10 h-10 flex-shrink-0 rounded-lg flex items-center justify-center p-1.5"
        style={{ background: `${skill.color}15`, border: `1px solid ${skill.color}30` }}
      >
        {skill.icon ? (
          <img src={skill.icon} alt={skill.nameEn} className="w-full h-full object-contain" />
        ) : (
          <div className="w-5 h-5 rounded" style={{ background: skill.color }} />
        )}
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text-primary truncate">
          {isRTL ? skill.nameFa : skill.nameEn}
        </p>
        <LevelDots level={skill.level} color={skill.color} />
      </div>
      {/* Level % */}
      <span className="text-xs font-mono font-bold flex-shrink-0" style={{ color: skill.color }}>
        {skill.level}%
      </span>
    </motion.div>
  )
}

const CATEGORY_ICONS: Record<string, string> = {
  'Networking': '🌐', 'شبکه': '🌐',
  'Security': '🛡️', 'امنیت': '🛡️',
  'Virtualization': '🖥️', 'مجازی‌سازی': '🖥️',
  'Systems': '⚙️', 'سیستم': '⚙️',
  'Monitoring': '📊', 'پایش': '📊',
  'Automation': '🤖', 'خودکارسازی': '🤖',
  'Operations': '💾', 'عملیات': '💾',
  'Communications': '📞', 'ارتباطات': '📞',
}

function CertCard({ cert, isRTL, index }: { cert: CertItem; isRTL: boolean; index: number }) {
  const logo = ISSUER_LOGOS[cert.issuer]
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.07, duration: 0.4 }}
      className="relative overflow-hidden rounded-xl border border-border bg-surface group hover:border-accent/40 transition-all duration-200"
    >
      {/* Top color band */}
      <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${cert.color}, ${cert.color}80)` }} />
      <div className="p-4">
        {/* Issuer logo + badge */}
        <div className="flex items-start justify-between mb-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center p-1.5 flex-shrink-0"
            style={{ background: `${cert.color}15`, border: `1px solid ${cert.color}30` }}
          >
            {logo ? (
              <img src={logo} alt={cert.issuer} className="w-full h-full object-contain" />
            ) : (
              <span className="text-lg">🏅</span>
            )}
          </div>
          <span
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ background: `${cert.color}15`, color: cert.color, border: `1px solid ${cert.color}30` }}
          >
            {isRTL ? 'تأیید شده' : 'Verified'}
          </span>
        </div>
        {/* Cert name */}
        <p className="text-sm font-bold text-text-primary leading-tight mb-1">
          {isRTL ? cert.nameFa : cert.nameEn}
        </p>
        {/* Issuer */}
        <p className="text-xs text-text-muted">{cert.issuer}</p>
      </div>
    </motion.div>
  )
}

export function AboutSection({ locale = 'en', dbAbout, dbTimeline, dbSkills, dbCerts, contactInfo, socialLinks }: AboutSectionProps) {
  const isRTL = locale === 'fa'

  const TIMELINE_DATA: TimelineItem[] = (dbTimeline && dbTimeline.length > 0)
    ? dbTimeline.map(t => ({ year: t.year, titleEn: t.titleEn, titleFa: t.titleFa, descEn: t.descEn || '', descFa: t.descFa || '', color: t.color || '#6366f1' }))
    : TIMELINE

  const SKILLS_DATA: SkillItem[] = (dbSkills && dbSkills.length > 0)
    ? dbSkills.map(s => ({ nameEn: s.nameEn, nameFa: s.nameFa, categoryEn: s.categoryEn, categoryFa: s.categoryFa, level: s.level, color: s.color || '#6366f1', icon: s.icon || null }))
    : SKILLS

  const CERTS_DATA: CertItem[] = (dbCerts && dbCerts.length > 0)
    ? dbCerts.map(c => ({ nameEn: c.nameEn, nameFa: c.nameFa, issuer: c.issuer || '', color: c.color || '#6366f1' }))
    : CERTS

  const categoryGroups = groupByCategory(SKILLS_DATA, isRTL)

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
          <motion.p variants={fadeIn} className="section-label mb-4 justify-center">
            {isRTL ? 'پروفایل اجرایی' : 'Executive Profile'}
          </motion.p>
          <motion.h2 variants={slideUp} className="section-title mb-4">
            {isRTL ? 'رهبر فناوری زیرساخت ' : 'The Infrastructure '}
            <span className="gradient-text">
              {isRTL ? 'سازمانی' : 'Technology Leader'}
            </span>
          </motion.h2>
          <motion.p variants={slideUp} className="section-subtitle max-w-2xl mx-auto">
            {isRTL
              ? 'بیش از یک دهه رهبری فناوری، طراحی معماری سازمانی و ارائه راه‌حل‌های زیرساختی پایدار در صنایع مختلف.'
              : 'Over a decade of technology leadership — designing enterprise architectures, securing critical infrastructure, and delivering measurable business outcomes across industries.'}
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
              {/* Profile image — focal point */}
              <div className="flex justify-center mb-8">
                <div className="relative">
                  {dbAbout?.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={dbAbout.photoUrl.startsWith('/') ? dbAbout.photoUrl : `/${dbAbout.photoUrl}`}
                      alt="Husein Habibazar"
                      className="w-48 sm:w-56 aspect-[3/4] rounded-2xl object-cover border border-accent/30 shadow-2xl"
                      style={{ boxShadow: '0 0 48px rgba(99,102,241,0.2), 0 24px 48px rgba(0,0,0,0.4)' }}
                    />
                  ) : (
                    <div
                      className="relative w-48 sm:w-56 aspect-[3/4] rounded-2xl flex flex-col items-center justify-center border border-accent/30"
                      style={{
                        background: 'linear-gradient(135deg, #1a1a3e 0%, #0d0d1a 50%, #1e1e3f 100%)',
                        boxShadow: '0 0 48px rgba(99,102,241,0.2), 0 24px 48px rgba(0,0,0,0.4)',
                      }}
                    >
                      <div
                        className="absolute inset-0 rounded-2xl pointer-events-none"
                        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 30%, rgba(99,102,241,0.15) 0%, transparent 70%)' }}
                      />
                      <span className="font-black text-5xl text-white tracking-tight relative z-10" style={{ background: 'linear-gradient(135deg, #f1f5f9, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>HBZ</span>
                      <span className="text-xs text-text-muted mt-2 relative z-10 tracking-wider uppercase">Infrastructure</span>
                      <span className="absolute bottom-3 right-3 w-4 h-4 rounded-full bg-emerald-500 border-2 border-background z-10" />
                    </div>
                  )}
                  {/* Decorative ring */}
                  <div
                    className="absolute -inset-3 rounded-2xl pointer-events-none"
                    style={{ border: '1px solid rgba(99,102,241,0.12)', background: 'transparent' }}
                  />
                  {/* Status badge */}
                  <div
                    className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold border"
                    style={{ background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.3)', color: '#10b981' }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block mr-1.5 animate-pulse" />
                    {isRTL ? 'آماده همکاری' : 'Available'}
                  </div>
                </div>
              </div>
              <h3 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-accent/20 flex items-center justify-center text-sm">◈</span>
                {isRTL ? 'مسیر حرفه‌ای' : 'Professional Journey'}
              </h3>
              <div className="space-y-4 text-text-secondary leading-relaxed">
                {dbAbout?.bio
                  ? <p>{dbAbout.bio}</p>
                  : (<>
                    <p>{isRTL ? BIO_FA : BIO_EN}</p>
                    <p>{isRTL ? BIO_DETAIL_FA : BIO_DETAIL_EN}</p>
                    <p>{isRTL ? BIO_CLIENT_FA : BIO_CLIENT_EN}</p>
                    <p>{isRTL ? BIO_METHOD_FA : BIO_METHOD_EN}</p>
                  </>)
                }
              </div>
              {/* Contact Info */}
              {(contactInfo?.email || contactInfo?.phone || contactInfo?.locationEn) && (
                <div className="mt-6 pt-5 border-t border-border/50 space-y-2">
                  {contactInfo.email && (
                    <a href={`mailto:${contactInfo.email}`} className="flex items-center gap-2 text-sm text-text-secondary hover:text-accent transition-colors">
                      <span className="text-accent">✉</span> {contactInfo.email}
                    </a>
                  )}
                  {contactInfo.phone && (
                    <a href={`tel:${contactInfo.phone}`} className="flex items-center gap-2 text-sm text-text-secondary hover:text-accent transition-colors">
                      <span className="text-accent">📞</span> {contactInfo.phone}
                    </a>
                  )}
                  {(isRTL ? contactInfo.locationFa : contactInfo.locationEn) && (
                    <p className="flex items-center gap-2 text-sm text-text-secondary">
                      <span className="text-accent">📍</span> {isRTL ? contactInfo.locationFa : contactInfo.locationEn}
                    </p>
                  )}
                </div>
              )}
              {/* Social Links */}
              {(socialLinks?.linkedin || socialLinks?.github || socialLinks?.twitter || socialLinks?.instagram || socialLinks?.telegram || socialLinks?.email || contactInfo?.email) && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {socialLinks?.linkedin && (
                    <a href={socialLinks.linkedin} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#0077b5]/10 text-[#0077b5] hover:bg-[#0077b5]/20 transition-colors border border-[#0077b5]/20">
                      <span>in</span> LinkedIn
                    </a>
                  )}
                  {socialLinks?.github && (
                    <a href={socialLinks.github} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-text-secondary hover:text-white hover:bg-white/10 transition-colors border border-border">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.4.6.11.82-.26.82-.58v-2c-3.34.73-4.04-1.61-4.04-1.61-.54-1.38-1.33-1.75-1.33-1.75-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .1-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.11-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 013.01-.4c1.02 0 2.05.14 3.01.4 2.28-1.55 3.3-1.23 3.3-1.23.65 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.21.7.82.58C20.56 21.8 24 17.3 24 12 24 5.37 18.63 0 12 0z"/></svg>
                      GitHub
                    </a>
                  )}
                  {socialLinks?.twitter && (
                    <a href={socialLinks.twitter} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-black/20 text-white hover:bg-black/40 transition-colors border border-white/10">
                      𝕏 Twitter
                    </a>
                  )}
                  {socialLinks?.instagram && (
                    <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#e1306c]/10 text-[#e1306c] hover:bg-[#e1306c]/20 transition-colors border border-[#e1306c]/20">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                      Instagram
                    </a>
                  )}
                  {socialLinks?.telegram && (
                    <a href={socialLinks.telegram} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#0088cc]/10 text-[#0088cc] hover:bg-[#0088cc]/20 transition-colors border border-[#0088cc]/20">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                      Telegram
                    </a>
                  )}
                  {(socialLinks?.email || contactInfo?.email) && (
                    <a href={`mailto:${socialLinks?.email || contactInfo?.email}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent/10 text-accent hover:bg-accent/20 transition-colors border border-accent/20">
                      ✉ Email
                    </a>
                  )}
                </div>
              )}
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
              <span className="w-6 h-6 rounded bg-accent/20 flex items-center justify-center text-sm">◎</span>
              {isRTL ? 'مسیر رهبری' : 'Leadership Journey'}
            </h3>
            <div className="space-y-8">
              {TIMELINE_DATA.map((item, i) => (
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

        {/* Skills — Category Grouped Cards */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="mb-20"
        >
          <div className="text-center mb-10">
            <p className="section-label mb-3 justify-center">{isRTL ? 'تخصص‌های محوری' : 'Core Expertise'}</p>
            <h3 className="text-2xl font-bold text-text-primary">
              {isRTL ? 'حوزه‌های تخصصی' : 'Technical Competencies'}
            </h3>
            <p className="text-sm text-text-muted mt-2 max-w-xl mx-auto">
              {isRTL
                ? 'مجموعه‌ای از تخصص‌های عمیق که در دهه‌ای از پروژه‌های سازمانی واقعی شکل گرفته‌اند.'
                : 'Deep competencies forged across a decade of real enterprise projects and production environments.'}
            </p>
          </div>

          <div className="space-y-8">
            {Array.from(categoryGroups.entries()).map(([category, catSkills], ci) => (
              <motion.div
                key={category}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: ci * 0.1, duration: 0.5 }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">{CATEGORY_ICONS[category] || '⚡'}</span>
                  <h4 className="text-sm font-bold text-text-primary uppercase tracking-widest">{category}</h4>
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-text-muted">{catSkills.length} {isRTL ? 'مهارت' : 'skills'}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {catSkills.map((skill, si) => (
                    <SkillCard key={skill.nameEn} skill={skill} isRTL={isRTL} index={ci * 5 + si} />
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Certifications — Full Cards */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <div className="text-center mb-10">
            <p className="section-label mb-3 justify-center">{isRTL ? 'اعتبارسنجی حرفه‌ای' : 'Professional Credentials'}</p>
            <h3 className="text-2xl font-bold text-text-primary">
              {isRTL ? 'گواهینامه‌های تخصصی' : 'Industry Certifications'}
            </h3>
            <p className="text-sm text-text-muted mt-2 max-w-xl mx-auto">
              {isRTL
                ? 'تأیید صلاحیت از معتبرترین سازمان‌های فناوری جهان.'
                : 'Validated expertise recognized by the world\'s leading technology organizations.'}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {CERTS_DATA.map((cert, i) => (
              <CertCard key={cert.nameEn} cert={cert} isRTL={isRTL} index={i} />
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
