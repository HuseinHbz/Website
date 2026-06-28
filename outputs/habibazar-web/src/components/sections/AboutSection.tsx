'use client'

import { motion } from 'framer-motion'
import { slideUp, staggerContainer, fadeIn } from '@/lib/motion'

interface DbTimeline { year: string; titleEn: string; titleFa: string; descEn: string | null; descFa: string | null; color: string | null }
interface DbSkill { nameEn: string; nameFa: string; categoryEn: string; categoryFa: string; level: number; color?: string | null; icon?: string | null }
interface DbCert { nameEn: string; nameFa: string; issuer?: string | null; color: string | null }
interface DbAbout { bio: string | null; photoUrl: string | null; resumeUrl: string | null; headline: string | null; subheadline: string | null }

interface AboutSectionProps {
  locale?: string
  dbAbout?: DbAbout | null
  dbTimeline?: DbTimeline[]
  dbSkills?: DbSkill[]
  dbCerts?: DbCert[]
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

export function AboutSection({ locale = 'en', dbAbout, dbTimeline, dbSkills, dbCerts }: AboutSectionProps) {
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
              {dbAbout?.photoUrl && (
                <div className="flex justify-center mb-6">
                  <img
                    src={dbAbout.photoUrl}
                    alt="Husein Habibazar"
                    className="w-28 h-28 rounded-full object-cover border-2 border-accent/30 shadow-lg"
                  />
                </div>
              )}
              <h3 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-accent/20 flex items-center justify-center text-sm">👤</span>
                {isRTL ? 'داستان حرفه‌ای' : 'Professional Story'}
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
            <p className="section-label mb-2">{isRTL ? 'سطح تخصص فنی' : 'Technical Proficiency'}</p>
            <h3 className="text-2xl font-bold text-text-primary">
              {isRTL ? 'مهارت‌های تخصصی' : 'Technical Skills'}
            </h3>
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
            <p className="section-label mb-2">{isRTL ? 'تأییدیه‌های حرفه‌ای' : 'Professional Credentials'}</p>
            <h3 className="text-2xl font-bold text-text-primary">
              {isRTL ? 'گواهینامه‌ها' : 'Certifications'}
            </h3>
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
