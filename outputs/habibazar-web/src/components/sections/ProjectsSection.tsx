'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { slideUp, staggerContainer, fadeIn } from '@/lib/motion'

interface ProjectsSectionProps {
  locale?: string
}

interface Project {
  id: string
  nameEn: string
  nameFa: string
  client: string
  industryEn: string
  industryFa: string
  year: string
  color: string
  icon: string
  challengeEn: string
  challengeFa: string
  solutionEn: string
  solutionFa: string
  technologies: string[]
  resultsEn: string[]
  resultsFa: string[]
  tagsEn: string[]
  tagsFa: string[]
}

const PROJECTS: Project[] = [
  {
    id: 'kenzo',
    nameEn: 'Kenzo Restaurant',
    nameFa: 'رستوران کنزو',
    client: 'Kenzo Group',
    industryEn: 'Hospitality',
    industryFa: 'هتلداری',
    year: '2023',
    color: '#f59e0b',
    icon: '🍽️',
    challengeEn: 'Multi-branch restaurant chain with outdated network infrastructure causing POS system outages, poor WiFi coverage, and zero centralized management across 5 locations.',
    challengeFa: 'زنجیره رستوران چند شعبه‌ای با زیرساخت شبکه قدیمی که باعث قطعی سیستم POS، پوشش ضعیف WiFi و عدم مدیریت متمرکز در ۵ شعبه می‌شد.',
    solutionEn: 'Designed and deployed a unified MikroTik-based network infrastructure with centralized management, VLAN segmentation (POS, Staff, Guest WiFi), site-to-site VPN between branches, and real-time monitoring via Zabbix.',
    solutionFa: 'طراحی و استقرار زیرساخت شبکه یکپارچه مبتنی بر MikroTik با مدیریت متمرکز، تقسیم‌بندی VLAN (POS، کارمندان، WiFi مهمان)، VPN سایت به سایت بین شعب و پایش لحظه‌ای با Zabbix.',
    technologies: ['MikroTik', 'Ubiquiti APs', 'Zabbix', 'VPN/IPSEC', 'VLAN', 'QoS'],
    resultsEn: ['99.9% uptime across all 5 branches', 'Zero POS system outages post-deployment', 'Centralized management from single pane of glass', '60% reduction in IT support tickets', 'Guest WiFi with captive portal & bandwidth control'],
    resultsFa: ['آپتایم ۹۹.۹٪ در تمام ۵ شعبه', 'صفر قطعی سیستم POS پس از استقرار', 'مدیریت متمرکز از یک پنل واحد', 'کاهش ۶۰٪ تیکت‌های پشتیبانی IT', 'WiFi مهمان با پورتال اختصاصی و کنترل پهنای باند'],
    tagsEn: ['Networking', 'WiFi', 'VPN', 'Monitoring'],
    tagsFa: ['شبکه', 'وای‌فای', 'VPN', 'پایش'],
  },
  {
    id: 'popcorn',
    nameEn: 'Popcorn Holding',
    nameFa: 'هلدینگ پاپ‌کورن',
    client: 'Popcorn Holding Co.',
    industryEn: 'Holding Company',
    industryFa: 'هلدینگ',
    year: '2024',
    color: '#10b981',
    icon: '🏢',
    challengeEn: 'Holding company managing 8 subsidiaries with completely isolated IT systems, no centralized security policy, mixed infrastructure (Windows/Linux), and no disaster recovery plan.',
    challengeFa: 'هلدینگ با ۸ شرکت زیرمجموعه با سیستم‌های IT کاملاً مجزا، بدون سیاست امنیتی متمرکز، زیرساخت ترکیبی (Windows/Linux) و بدون برنامه بازیابی فاجعه.',
    solutionEn: 'Architected a unified enterprise infrastructure: centralized Active Directory with subsidiary OUs, site-to-site VPN mesh, Fortigate-based security perimeter, VMware vSphere virtualization layer, and Veeam backup solution with offsite DR.',
    solutionFa: 'طراحی زیرساخت سازمانی یکپارچه: Active Directory مرکزی با واحدهای سازمانی زیرمجموعه‌ها، شبکه VPN سایت به سایت، محیط امنیتی مبتنی بر Fortigate، لایه مجازی‌سازی VMware vSphere و راه‌حل پشتیبان‌گیری Veeam با DR برون‌سازمانی.',
    technologies: ['Fortigate', 'VMware vSphere', 'Active Directory', 'Veeam', 'Cisco', 'MPLS VPN'],
    resultsEn: ['Unified identity management across 8 subsidiaries', 'RTO reduced from days to 4 hours', 'Security incidents reduced by 80%', 'Infrastructure cost reduced by 35% via consolidation', 'Full DR capability with tested failover procedures'],
    resultsFa: ['مدیریت هویت یکپارچه در ۸ زیرمجموعه', 'RTO از چند روز به ۴ ساعت کاهش یافت', 'حوادث امنیتی ۸۰٪ کاهش یافت', 'هزینه زیرساخت ۳۵٪ از طریق ادغام کاهش یافت', 'قابلیت DR کامل با رویه‌های Failover آزموده‌شده'],
    tagsEn: ['Enterprise', 'Security', 'Virtualization', 'DR'],
    tagsFa: ['سازمانی', 'امنیت', 'مجازی‌سازی', 'بازیابی'],
  },
  {
    id: 'senso',
    nameEn: 'Senso Restaurant Group',
    nameFa: 'گروه رستوران سنسو',
    client: 'Senso Group',
    industryEn: 'Food & Beverage',
    industryFa: 'غذا و نوشیدنی',
    year: '2024',
    color: '#818cf8',
    icon: '🍷',
    challengeEn: 'Upscale restaurant chain requiring premium WiFi experience for guests, CCTV integration, VoIP system for reservations, and compliance with data privacy requirements.',
    challengeFa: 'زنجیره رستوران لوکس نیازمند تجربه WiFi ممتاز برای مهمانان، یکپارچه‌سازی دوربین مداربسته، سیستم VoIP برای رزرواسیون و رعایت الزامات حریم خصوصی داده.',
    solutionEn: 'End-to-end infrastructure: Ubiquiti enterprise WiFi with guest portal, Asterisk VoIP PBX with extension routing, IP CCTV over dedicated VLAN, Sophos XG firewall with web filtering, and automated backup for POS data.',
    solutionFa: 'زیرساخت کامل: WiFi سازمانی Ubiquiti با پورتال مهمان، PBX VoIP Asterisk با مسیریابی داخلی، CCTV IP روی VLAN اختصاصی، فایروال Sophos XG با فیلترینگ وب و پشتیبان‌گیری خودکار داده POS.',
    technologies: ['Ubiquiti', 'Sophos XG', 'Asterisk PBX', 'IP CCTV', 'TrueNAS', 'Zabbix'],
    resultsEn: ['Guest WiFi satisfaction score: 4.8/5', 'VoIP system handling 200+ daily calls', 'CCTV retention: 30 days across all cameras', 'POS backup: 15-minute RPO', 'Fully compliant data handling procedures'],
    resultsFa: ['امتیاز رضایت WiFi مهمان: ۴.۸/۵', 'سیستم VoIP با +۲۰۰ تماس روزانه', 'نگهداری CCTV: ۳۰ روز روی تمام دوربین‌ها', 'پشتیبان POS: RPO 15 دقیقه', 'رویه‌های مدیریت داده کاملاً منطبق'],
    tagsEn: ['VoIP', 'WiFi', 'Security', 'CCTV'],
    tagsFa: ['VoIP', 'وای‌فای', 'امنیت', 'دوربین مداربسته'],
  },
  {
    id: 'enterprise',
    nameEn: 'Industrial Enterprise',
    nameFa: 'مجتمع صنعتی',
    client: 'Confidential Client',
    industryEn: 'Industrial',
    industryFa: 'صنعتی',
    year: '2023',
    color: '#06b6d4',
    icon: '🏭',
    challengeEn: 'Large industrial facility requiring OT/IT network convergence, 24/7 monitoring of critical production equipment, zero-downtime network migration, and multi-shift VoIP communication system.',
    challengeFa: 'مجتمع صنعتی بزرگ نیازمند همگرایی شبکه OT/IT، پایش ۲۴/۷ تجهیزات تولیدی حیاتی، مهاجرت شبکه بدون توقف و سیستم ارتباطی VoIP چند شیفته.',
    solutionEn: 'Designed OT/IT segmented network with industrial-grade switches, SCADA-compatible network architecture, Grafana-based production monitoring dashboard, and redundant Cisco core infrastructure with sub-second failover.',
    solutionFa: 'طراحی شبکه تقسیم‌بندی‌شده OT/IT با سوئیچ‌های صنعتی، معماری شبکه سازگار با SCADA، داشبورد پایش تولید مبتنی بر Grafana و زیرساخت هسته‌ای افزونه Cisco با Failover زیر یک ثانیه.',
    technologies: ['Cisco', 'Grafana', 'Prometheus', 'Industrial Switches', 'SCADA', 'VoIP'],
    resultsEn: ['Zero production downtime during migration', 'Real-time visibility into 150+ production nodes', 'Sub-second network failover achieved', 'OT/IT convergence without security compromise', '40% reduction in network-related production stoppages'],
    resultsFa: ['صفر توقف تولید در طول مهاجرت', 'دید لحظه‌ای به +۱۵۰ نود تولیدی', 'Failover شبکه زیر یک ثانیه محقق شد', 'همگرایی OT/IT بدون مصالحه امنیتی', 'کاهش ۴۰٪ توقف‌های تولید مرتبط با شبکه'],
    tagsEn: ['Industrial', 'OT/IT', 'Monitoring', 'Cisco'],
    tagsFa: ['صنعتی', 'OT/IT', 'پایش', 'سیسکو'],
  },
]

export function ProjectsSection({ locale = 'en' }: ProjectsSectionProps) {
  const isRTL = locale === 'fa'
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)

  return (
    <section className="section-padding relative overflow-hidden" id="projects">
      <div className="absolute inset-0 grid-bg" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-DEFAULT/30 to-transparent" />

      <div className="container-site relative z-10">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <motion.p variants={fadeIn} className="section-label mb-3">
            {isRTL ? 'نمونه‌کارها' : 'Case Studies'}
          </motion.p>
          <motion.h2 variants={slideUp} className="section-title mb-4">
            {isRTL ? 'پروژه‌های واقعی. ' : 'Real Projects. '}
            <span className="gradient-text">{isRTL ? 'نتایج واقعی.' : 'Real Results.'}</span>
          </motion.h2>
          <motion.p variants={slideUp} className="section-subtitle max-w-2xl mx-auto">
            {isRTL
              ? 'تحول زیرساخت در صنایع هتلداری، هلدینگ، غذا و نوشیدنی و صنعتی.'
              : 'Infrastructure transformations across hospitality, holding companies, food & beverage, and industrial sectors.'}
          </motion.p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {PROJECTS.map((project, i) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
            >
              <motion.div
                className="service-card cursor-pointer group"
                onClick={() => setSelectedProject(project)}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
              >
                <div
                  className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
                  style={{ background: `linear-gradient(90deg, ${project.color}, transparent)` }}
                />
                <div className="flex items-start gap-4 mb-4">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl flex-shrink-0"
                    style={{ background: `${project.color}15`, border: `1px solid ${project.color}30` }}
                  >
                    {project.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-text-primary group-hover:text-accent transition-colors">
                      {isRTL ? project.nameFa : project.nameEn}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-text-muted">
                        {isRTL ? project.industryFa : project.industryEn}
                      </span>
                      <span className="text-text-muted/40">•</span>
                      <span className="text-xs font-mono" style={{ color: project.color }}>{project.year}</span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-text-secondary leading-relaxed mb-4 line-clamp-3">
                  {isRTL ? project.challengeFa : project.challengeEn}
                </p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {(isRTL ? project.tagsFa : project.tagsEn).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 text-xs rounded-md"
                      style={{ background: `${project.color}15`, color: project.color, border: `1px solid ${project.color}25` }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  <div className="flex gap-1">
                    {project.technologies.slice(0, 3).map((tech) => (
                      <span key={tech} className="px-2 py-0.5 text-xs bg-surface border border-border rounded-md font-mono">
                        {tech}
                      </span>
                    ))}
                    {project.technologies.length > 3 && (
                      <span className="px-2 py-0.5 text-xs bg-surface border border-border rounded-md text-text-muted">
                        +{project.technologies.length - 3}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-accent font-medium group-hover:text-accent-hover transition-colors">
                    {isRTL ? 'مشاهده مطالعه موردی ←' : 'View Case Study →'}
                  </span>
                </div>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {selectedProject && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedProject(null)}
          >
            <div className="absolute inset-0 bg-background/90 backdrop-blur-md" />
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative z-10 w-full max-w-2xl max-h-[85vh] overflow-y-auto glass-card p-8 rounded-2xl"
              style={{ border: `1px solid ${selectedProject.color}30` }}
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              <button
                onClick={() => setSelectedProject(null)}
                className="absolute top-4 end-4 w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
              >
                ✕
              </button>
              <div className="flex items-center gap-4 mb-6">
                <div
                  className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl flex-shrink-0"
                  style={{ background: `${selectedProject.color}15`, border: `1px solid ${selectedProject.color}30` }}
                >
                  {selectedProject.icon}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-text-primary">
                    {isRTL ? selectedProject.nameFa : selectedProject.nameEn}
                  </h2>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm text-text-muted">{selectedProject.client}</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: `${selectedProject.color}20`, color: selectedProject.color }}>
                      {selectedProject.year}
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-text-muted uppercase tracking-widest mb-2">
                    {isRTL ? 'چالش' : 'Challenge'}
                  </h4>
                  <p className="text-text-secondary leading-relaxed">
                    {isRTL ? selectedProject.challengeFa : selectedProject.challengeEn}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-text-muted uppercase tracking-widest mb-2">
                    {isRTL ? 'راه‌حل' : 'Solution'}
                  </h4>
                  <p className="text-text-secondary leading-relaxed">
                    {isRTL ? selectedProject.solutionFa : selectedProject.solutionEn}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-text-muted uppercase tracking-widest mb-3">
                    {isRTL ? 'تکنولوژی‌های استفاده‌شده' : 'Technologies Used'}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedProject.technologies.map((tech) => (
                      <span
                        key={tech}
                        className="px-3 py-1 text-sm rounded-lg font-medium"
                        style={{ background: `${selectedProject.color}15`, color: selectedProject.color, border: `1px solid ${selectedProject.color}25` }}
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-text-muted uppercase tracking-widest mb-3">
                    {isRTL ? 'نتایج و دستاوردها' : 'Results & Outcomes'}
                  </h4>
                  <ul className="space-y-2">
                    {(isRTL ? selectedProject.resultsFa : selectedProject.resultsEn).map((result) => (
                      <li key={result} className="flex items-start gap-2 text-sm text-text-secondary">
                        <span
                          className="mt-1 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: `${selectedProject.color}20` }}
                        >
                          <span style={{ color: selectedProject.color, fontSize: '10px' }}>✓</span>
                        </span>
                        {result}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="mt-8 pt-6 border-t border-border">
                <a
                  href="/consultation"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105"
                  style={{ background: `linear-gradient(135deg, ${selectedProject.color}, ${selectedProject.color}cc)`, boxShadow: `0 8px 24px ${selectedProject.color}30` }}
                >
                  {isRTL ? 'مشاوره درباره پروژه مشابه' : 'Discuss a Similar Project'}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
