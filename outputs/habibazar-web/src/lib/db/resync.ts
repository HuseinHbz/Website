import Database from 'better-sqlite3'
import path from 'path'
import { BLOG_CONTENT } from './blogContent'

const DB_PATH = path.join(process.cwd(), 'data', 'habibazar.db')

export function resyncPublicContent() {
  const db = new Database(DB_PATH)

  // ── About Content ────────────────────────────────────────────────────────────
  // Seed about_content if not set; preserve any manually entered bio/photo from admin
  const existingAboutEn = db.prepare("SELECT id, photo_url FROM about_content WHERE locale = 'en'").get() as { id: number; photo_url: string | null } | undefined
  const existingAboutFa = db.prepare("SELECT id, photo_url FROM about_content WHERE locale = 'fa'").get() as { id: number; photo_url: string | null } | undefined
  if (!existingAboutEn) {
    db.prepare(`INSERT INTO about_content (locale, headline, subheadline, bio, photo_url) VALUES ('en', 'Senior Infrastructure Engineer', 'Building reliable, secure, and automated enterprise infrastructure', null, null)`).run()
  } else if (existingAboutEn.photo_url && existingAboutEn.photo_url.includes('/uploads/logos/')) {
    // Clear if someone accidentally set a tech logo as profile photo
    db.prepare("UPDATE about_content SET photo_url = null WHERE locale = 'en'").run()
  }
  if (!existingAboutFa) {
    db.prepare(`INSERT INTO about_content (locale, headline, subheadline, bio, photo_url) VALUES ('fa', 'مهندس ارشد زیرساخت', 'ساخت زیرساخت سازمانی قابل‌اعتماد، امن و خودکار', null, null)`).run()
  } else if (existingAboutFa.photo_url && existingAboutFa.photo_url.includes('/uploads/logos/')) {
    db.prepare("UPDATE about_content SET photo_url = null WHERE locale = 'fa'").run()
  }

  // ── Timeline ────────────────────────────────────────────────────────────────
  db.prepare('DELETE FROM timeline_items').run()
  const insTimeline = db.prepare(`
    INSERT INTO timeline_items (year, title_en, title_fa, company_en, company_fa, desc_en, desc_fa, color, sort_order)
    VALUES (?,?,?,?,?,?,?,?,?)
  `)
  const timeline = [
    ['2013', 'Technical Technician', 'تکنسین فنی', 'Local ISP', 'ISP محلی',
     'Started career in IT support, hardware maintenance and basic network administration.',
     'آغاز فعالیت در پشتیبانی IT، تعمیر سخت‌افزار و مدیریت پایه شبکه.', '#6366f1', 1],
    ['2017', 'IT Specialist', 'متخصص IT', 'Enterprise Clients', 'مشتریان سازمانی',
     'Expanded into system administration, server management, and enterprise networking.',
     'توسعه تخصص به مدیریت سیستم، سرور و شبکه‌های سازمانی.', '#818cf8', 2],
    ['2021', 'Network Operations Engineer', 'مهندس عملیات شبکه', 'Enterprise Deployments', 'استقرار سازمانی',
     'Designed and implemented complex LAN/WAN infrastructures, VPN solutions and security systems.',
     'طراحی و پیاده‌سازی زیرساخت‌های پیچیده LAN/WAN، راه‌حل‌های VPN و سیستم‌های امنیتی.', '#06b6d4', 3],
    ['2024', 'Senior Infrastructure Engineer', 'مهندس ارشد زیرساخت', 'Multi-client', 'چند مشتری',
     'Led enterprise-scale virtualization, cloud integration, and infrastructure automation projects.',
     'رهبری پروژه‌های مجازی‌سازی سازمانی، یکپارچه‌سازی ابر و خودکارسازی زیرساخت.', '#10b981', 4],
    ['2025', 'Network Operations Supervisor', 'سرپرست عملیات شبکه', 'HBZ Consulting', 'مشاوره HBZ',
     'Overseeing multi-site infrastructure operations, mentoring teams and driving digital transformation.',
     'نظارت بر عملیات زیرساخت چند سایته، راهنمایی تیم‌ها و هدایت تحول دیجیتال.', '#f59e0b', 5],
  ]
  for (const r of timeline) insTimeline.run(...r)

  // ── Skills ──────────────────────────────────────────────────────────────────
  // Preserve admin's active/hidden settings: read first, then DELETE + re-INSERT
  const existingSkillActive = new Map<string, boolean>()
  const existingSkillIcons = new Map<string, string | null>()
  for (const s of db.prepare('SELECT name_en, active, icon FROM skills').all() as { name_en: string; active: number; icon: string | null }[]) {
    existingSkillActive.set(s.name_en, s.active === 1)
    existingSkillIcons.set(s.name_en, s.icon)
  }
  db.prepare('DELETE FROM skills').run()
  const insSkill = db.prepare(`
    INSERT INTO skills (name_en, name_fa, category_en, category_fa, level, color, icon, sort_order, active)
    VALUES (?,?,?,?,?,?,?,?,?)
  `)
  const skills: [string, string, string, string, number, string, string, number, number][] = [
    ['Network Architecture', 'معماری شبکه', 'Networking', 'شبکه', 95, '#6366f1', '/uploads/logos/mikrotik.svg', 1, 1],
    ['MikroTik RouterOS', 'میکروتیک RouterOS', 'Networking', 'شبکه', 92, '#c03030', '/uploads/logos/mikrotik.svg', 2, 1],
    ['Cisco IOS/IOS-XE', 'سیسکو IOS', 'Networking', 'شبکه', 88, '#1ba0d7', '/uploads/logos/cisco.svg', 3, 1],
    ['Fortigate / Sophos', 'فورتیگیت / سوفوس', 'Security', 'امنیت', 90, '#ee3124', '/uploads/logos/fortinet.svg', 4, 1],
    ['Network Security', 'امنیت شبکه', 'Security', 'امنیت', 88, '#ef4444', '/uploads/logos/fortinet.svg', 5, 1],
    ['VMware vSphere', 'VMware vSphere', 'Virtualization', 'مجازی‌سازی', 85, '#60b6e0', '/uploads/logos/vmware.svg', 6, 1],
    ['Proxmox VE', 'Proxmox VE', 'Virtualization', 'مجازی‌سازی', 82, '#e57000', '/uploads/logos/proxmox.svg', 7, 1],
    ['Linux Server Admin', 'مدیریت سرور لینوکس', 'Systems', 'سیستم', 90, '#f59e0b', '/uploads/logos/linux.svg', 8, 1],
    ['Zabbix / Grafana', 'زابیکس / گرافانا', 'Monitoring', 'پایش', 85, '#f59e0b', '/uploads/logos/zabbix.svg', 9, 1],
    ['Infrastructure Automation', 'خودکارسازی زیرساخت', 'Automation', 'خودکارسازی', 78, '#06b6d4', '/uploads/logos/ansible.svg', 10, 1],
    ['Veeam Backup & DR', 'Veeam پشتیبان‌گیری', 'Operations', 'عملیات', 85, '#00b336', '/uploads/logos/windows-server.svg', 11, 1],
    ['VoIP Solutions', 'راه‌حل‌های VoIP', 'Communications', 'ارتباطات', 80, '#818cf8', '/uploads/logos/linux.svg', 12, 1],
  ]
  for (const r of skills) {
    const nameEn = r[0]
    const active = existingSkillActive.has(nameEn) ? (existingSkillActive.get(nameEn) ? 1 : 0) : r[8]
    const icon = existingSkillIcons.has(nameEn) && existingSkillIcons.get(nameEn) ? existingSkillIcons.get(nameEn)! : r[6]
    insSkill.run(r[0], r[1], r[2], r[3], r[4], r[5], icon, r[7], active)
  }

  // ── Certifications ──────────────────────────────────────────────────────────
  // Preserve admin's active/hidden settings: read first, then DELETE + re-INSERT
  const existingCertActive = new Map<string, boolean>()
  for (const c of db.prepare('SELECT name_en, active FROM certifications').all() as { name_en: string; active: number }[]) {
    existingCertActive.set(c.name_en, c.active === 1)
  }
  db.prepare('DELETE FROM certifications').run()
  const insCert = db.prepare(`
    INSERT INTO certifications (name_en, name_fa, issuer, color, sort_order, active)
    VALUES (?,?,?,?,?,?)
  `)
  const certs: [string, string, string, string, number, number][] = [
    ['MikroTik MTCNA', 'میکروتیک MTCNA', 'MikroTik', '#c03030', 1, 1],
    ['MikroTik MTCRE', 'میکروتیک MTCRE', 'MikroTik', '#c03030', 2, 1],
    ['Fortinet NSE', 'فورتینت NSE', 'Fortinet', '#ee3124', 3, 1],
    ['VMware VCP', 'VMware VCP', 'VMware', '#60b6e0', 4, 1],
    ['Linux LPIC', 'لینوکس LPIC', 'Linux Professional Institute', '#f59e0b', 5, 1],
    ['Cisco CCNA', 'سیسکو CCNA', 'Cisco', '#1ba0d7', 6, 1],
  ]
  for (const r of certs) {
    const nameEn = r[0]
    const active = existingCertActive.has(nameEn) ? (existingCertActive.get(nameEn) ? 1 : 0) : r[5]
    insCert.run(r[0], r[1], r[2], r[3], r[4], active)
  }

  // ── Services ────────────────────────────────────────────────────────────────
  db.prepare('DELETE FROM services').run()
  const insSvc = db.prepare(`
    INSERT INTO services (slug, title_en, title_fa, category_en, category_fa, short_desc_en, short_desc_fa, features_en, features_fa, icon, color, sort_order)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `)
  const services = [
    ['network-design', 'Network Design & Architecture', 'طراحی و معماری شبکه', 'Infrastructure', 'زیرساخت',
     'Enterprise LAN/WAN design with high availability, redundancy, and performance optimization.',
     'طراحی LAN/WAN سازمانی با دسترسی‌پذیری بالا، افزونگی و بهینه‌سازی عملکرد.',
     '["LAN / WAN Architecture","VPN & SD-WAN Solutions","Wireless Infrastructure","Network Segmentation","QoS & Traffic Management"]',
     '["معماری LAN / WAN","راه‌حل‌های VPN و SD-WAN","زیرساخت بی‌سیم","تقسیم‌بندی شبکه","مدیریت QoS و ترافیک"]',
     '🌐', '#6366f1', 1],
    ['network-security', 'Network Security', 'امنیت شبکه', 'Security', 'امنیت',
     'Multi-layer security architecture protecting your business against modern cyber threats.',
     'معماری امنیتی چندلایه برای حفاظت از کسب‌وکار در برابر تهدیدات سایبری مدرن.',
     '["Firewall Design & Management","IDS/IPS Implementation","Security Hardening","Zero-Trust Architecture","Penetration Testing Support"]',
     '["طراحی و مدیریت فایروال","پیاده‌سازی IDS/IPS","سخت‌سازی امنیتی","معماری Zero-Trust","پشتیبانی تست نفوذ"]',
     '🛡️', '#ef4444', 2],
    ['virtualization', 'Virtualization & Cloud', 'مجازی‌سازی و ابر', 'Infrastructure', 'زیرساخت',
     'Design and deploy virtualized environments that maximize hardware utilization and flexibility.',
     'طراحی و استقرار محیط‌های مجازی که استفاده از سخت‌افزار و انعطاف را به حداکثر می‌رسانند.',
     '["VMware vSphere/ESXi","Hyper-V Environments","Proxmox VE Clusters","Storage Architecture (SAN/NAS)","High Availability Clustering"]',
     '["VMware vSphere/ESXi","محیط‌های Hyper-V","کلاسترهای Proxmox VE","معماری ذخیره‌سازی (SAN/NAS)","کلاسترینگ با دسترسی‌پذیری بالا"]',
     '🖥️', '#60b6e0', 3],
    ['monitoring', 'Monitoring & Observability', 'پایش و مشاهده‌پذیری', 'Operations', 'عملیات',
     'End-to-end visibility into your infrastructure with real-time alerting and performance dashboards.',
     'دید کامل به زیرساخت با هشداردهی لحظه‌ای و داشبوردهای عملکرد.',
     '["Infrastructure Monitoring","Real-Time Alerting","Custom Dashboards","Capacity Planning","Log Management"]',
     '["پایش زیرساخت","هشداردهی لحظه‌ای","داشبوردهای اختصاصی","برنامه‌ریزی ظرفیت","مدیریت لاگ"]',
     '📊', '#f59e0b', 4],
    ['backup-dr', 'Backup & Disaster Recovery', 'پشتیبان‌گیری و بازیابی', 'Operations', 'عملیات',
     'Comprehensive backup strategies and DR plans ensuring business continuity.',
     'استراتژی‌های جامع پشتیبان‌گیری و برنامه DR برای تداوم کسب‌وکار.',
     '["Backup Strategy Design","Veeam Implementation","RTO/RPO Planning","DR Testing & Validation","Offsite Replication"]',
     '["طراحی استراتژی پشتیبان‌گیری","پیاده‌سازی Veeam","برنامه‌ریزی RTO/RPO","تست و اعتبارسنجی DR","رپلیکیشن برون‌سازمانی"]',
     '💾', '#10b981', 5],
    ['linux', 'Linux Infrastructure', 'زیرساخت لینوکس', 'Systems', 'سیستم',
     'Expert Linux server administration, automation, and open-source infrastructure solutions.',
     'مدیریت تخصصی سرور لینوکس، خودکارسازی و راه‌حل‌های زیرساختی متن‌باز.',
     '["RHEL / Ubuntu / Debian","Web Server Stacks (Nginx, Apache)","Database Administration","Shell Scripting & Automation","Container Orchestration"]',
     '["RHEL / Ubuntu / Debian","وب سرور (Nginx، Apache)","مدیریت پایگاه‌داده","اسکریپت‌نویسی و خودکارسازی","ارکستراسیون کانتینر"]',
     '🐧', '#f59e0b', 6],
    ['microsoft', 'Microsoft Services', 'خدمات مایکروسافت', 'Systems', 'سیستم',
     'Windows Server environments, Active Directory, and Microsoft ecosystem management.',
     'محیط‌های Windows Server، Active Directory و مدیریت اکوسیستم مایکروسافت.',
     '["Active Directory Design","Windows Server 2022","Exchange / Mail Services","Group Policy Management","Azure AD Integration"]',
     '["طراحی Active Directory","Windows Server 2022","Exchange / سرویس ایمیل","مدیریت Group Policy","یکپارچه‌سازی Azure AD"]',
     '🪟', '#00adef', 7],
    ['voip', 'VoIP Solutions', 'راه‌حل‌های VoIP', 'Communications', 'ارتباطات',
     'Modern IP telephony systems and unified communications for businesses.',
     'سیستم‌های تلفنی IP مدرن و ارتباطات یکپارچه برای کسب‌وکارها.',
     '["Asterisk / FreePBX","IP Phone Configuration","Call Center Solutions","SIP Trunk Integration","IVR & Auto-Attendant"]',
     '["Asterisk / FreePBX","پیکربندی تلفن IP","راه‌حل‌های مرکز تماس","یکپارچه‌سازی SIP Trunk","IVR و پاسخگوی خودکار"]',
     '📞', '#818cf8', 8],
    ['automation', 'Infrastructure Automation', 'خودکارسازی زیرساخت', 'DevOps', 'دواپس',
     'Automate repetitive tasks and provisioning to reduce human error and speed up operations.',
     'خودکارسازی وظایف تکراری و فراهم‌سازی برای کاهش خطای انسانی و تسریع عملیات.',
     '["Ansible Playbooks","Configuration Management","CI/CD for Infrastructure","Network Automation","Monitoring Automation"]',
     '["Ansible Playbook‌ها","مدیریت پیکربندی","CI/CD برای زیرساخت","خودکارسازی شبکه","خودکارسازی پایش"]',
     '⚙️', '#06b6d4', 9],
  ]
  for (const r of services) insSvc.run(...r)

  // ── Projects ────────────────────────────────────────────────────────────────
  db.prepare('DELETE FROM projects').run()
  const insProj = db.prepare(`
    INSERT INTO projects (slug, name_en, name_fa, industry_en, industry_fa, client_en, client_fa,
      challenge_en, challenge_fa, solution_en, solution_fa, results_en, results_fa,
      tags_en, tags_fa, color, year, featured, sort_order)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `)
  const projects = [
    ['kenzo-restaurant', 'Kenzo Restaurant', 'رستوران کنزو', 'Hospitality', 'هتلداری', 'Kenzo Group', 'گروه کنزو',
     'Multi-branch restaurant chain with outdated network infrastructure causing POS system outages, poor WiFi coverage, and zero centralized management across 5 locations.',
     'زنجیره رستوران چند شعبه‌ای با زیرساخت شبکه قدیمی که باعث قطعی سیستم POS، پوشش ضعیف WiFi و عدم مدیریت متمرکز در ۵ شعبه می‌شد.',
     'Designed and deployed a unified MikroTik-based network infrastructure with centralized management, VLAN segmentation (POS, Staff, Guest WiFi), site-to-site VPN between branches, and real-time monitoring via Zabbix.',
     'طراحی و استقرار زیرساخت شبکه یکپارچه مبتنی بر MikroTik با مدیریت متمرکز، تقسیم‌بندی VLAN (POS، کارمندان، WiFi مهمان)، VPN سایت به سایت بین شعب و پایش لحظه‌ای با Zabbix.',
     '["99.9% uptime across all 5 branches","Zero POS system outages post-deployment","Centralized management from single pane of glass","60% reduction in IT support tickets","Guest WiFi with captive portal & bandwidth control"]',
     '["آپتایم ۹۹.۹٪ در تمام ۵ شعبه","صفر قطعی سیستم POS پس از استقرار","مدیریت متمرکز از یک پنل واحد","کاهش ۶۰٪ تیکت‌های پشتیبانی IT","WiFi مهمان با پورتال اختصاصی و کنترل پهنای باند"]',
     '["MikroTik","VLAN","QoS","WiFi","Zabbix","VPN"]',
     '["میکروتیک","VLAN","QoS","وای‌فای","Zabbix","VPN"]',
     '#f59e0b', '2023', 1, 1],
    ['popcorn-holding', 'Popcorn Holding', 'هلدینگ پاپ‌کورن', 'Holding Company', 'هلدینگ', 'Popcorn Holding Co.', 'هلدینگ پاپ‌کورن',
     'Holding company managing 8 subsidiaries with completely isolated IT systems, no centralized security policy, mixed infrastructure (Windows/Linux), and no disaster recovery plan.',
     'هلدینگ با ۸ شرکت زیرمجموعه با سیستم‌های IT کاملاً مجزا، بدون سیاست امنیتی متمرکز، زیرساخت ترکیبی (Windows/Linux) و بدون برنامه بازیابی فاجعه.',
     'Architected a unified enterprise infrastructure: centralized Active Directory with subsidiary OUs, site-to-site VPN mesh, Fortigate-based security perimeter, VMware vSphere virtualization layer, and Veeam backup solution with offsite DR.',
     'طراحی زیرساخت سازمانی یکپارچه: Active Directory مرکزی با واحدهای سازمانی زیرمجموعه‌ها، شبکه VPN سایت به سایت، محیط امنیتی مبتنی بر Fortigate، لایه مجازی‌سازی VMware vSphere و راه‌حل پشتیبان‌گیری Veeam با DR برون‌سازمانی.',
     '["Unified identity management across 8 subsidiaries","RTO reduced from days to 4 hours","Security incidents reduced by 80%","Infrastructure cost reduced by 35% via consolidation","Full DR capability with tested failover procedures"]',
     '["مدیریت هویت یکپارچه در ۸ زیرمجموعه","RTO از چند روز به ۴ ساعت کاهش یافت","حوادث امنیتی ۸۰٪ کاهش یافت","هزینه زیرساخت ۳۵٪ از طریق ادغام کاهش یافت","قابلیت DR کامل با رویه‌های Failover آزموده‌شده"]',
     '["Fortigate","VMware vSphere","Active Directory","Veeam","Cisco","MPLS VPN"]',
     '["فورتی‌گیت","VMware vSphere","Active Directory","Veeam","سیسکو","MPLS VPN"]',
     '#10b981', '2024', 1, 2],
    ['senso-restaurant-group', 'Senso Restaurant Group', 'گروه رستوران سنسو', 'Food & Beverage', 'غذا و نوشیدنی', 'Senso Group', 'گروه سنسو',
     'Upscale restaurant chain requiring premium WiFi experience for guests, CCTV integration, VoIP system for reservations, and compliance with data privacy requirements.',
     'زنجیره رستوران لوکس نیازمند تجربه WiFi ممتاز برای مهمانان، یکپارچه‌سازی دوربین مداربسته، سیستم VoIP برای رزرواسیون و رعایت الزامات حریم خصوصی داده.',
     'End-to-end infrastructure: Ubiquiti enterprise WiFi with guest portal, Asterisk VoIP PBX with extension routing, IP CCTV over dedicated VLAN, Sophos XG firewall with web filtering, and automated backup for POS data.',
     'زیرساخت کامل: WiFi سازمانی Ubiquiti با پورتال مهمان، PBX VoIP Asterisk با مسیریابی داخلی، CCTV IP روی VLAN اختصاصی، فایروال Sophos XG با فیلترینگ وب و پشتیبان‌گیری خودکار داده POS.',
     '["Guest WiFi satisfaction score: 4.8/5","VoIP system handling 200+ daily calls","CCTV retention: 30 days across all cameras","POS backup: 15-minute RPO","Fully compliant data handling procedures"]',
     '["امتیاز رضایت WiFi مهمان: ۴.۸/۵","سیستم VoIP با +۲۰۰ تماس روزانه","نگهداری CCTV: ۳۰ روز روی تمام دوربین‌ها","پشتیبان POS: RPO 15 دقیقه","رویه‌های مدیریت داده کاملاً منطبق"]',
     '["Ubiquiti","Sophos XG","Asterisk PBX","IP CCTV","TrueNAS","Zabbix"]',
     '["Ubiquiti","Sophos XG","Asterisk PBX","دوربین IP","TrueNAS","Zabbix"]',
     '#818cf8', '2024', 1, 3],
    ['industrial-enterprise', 'Industrial Enterprise', 'مجتمع صنعتی', 'Industrial', 'صنعتی', 'Confidential Client', 'مشتری محرمانه',
     'Large industrial facility requiring OT/IT network convergence, 24/7 monitoring of critical production equipment, zero-downtime network migration, and multi-shift VoIP communication system.',
     'مجتمع صنعتی بزرگ نیازمند همگرایی شبکه OT/IT، پایش ۲۴/۷ تجهیزات تولیدی حیاتی، مهاجرت شبکه بدون توقف و سیستم ارتباطی VoIP چند شیفته.',
     'Designed OT/IT segmented network with industrial-grade switches, SCADA-compatible network architecture, Grafana-based production monitoring dashboard, and redundant Cisco core infrastructure with sub-second failover.',
     'طراحی شبکه تقسیم‌بندی‌شده OT/IT با سوئیچ‌های صنعتی، معماری شبکه سازگار با SCADA، داشبورد پایش تولید مبتنی بر Grafana و زیرساخت هسته‌ای افزونه Cisco با Failover زیر یک ثانیه.',
     '["Zero production downtime during migration","Real-time visibility into 150+ production nodes","Sub-second network failover achieved","OT/IT convergence without security compromise","40% reduction in network-related production stoppages"]',
     '["صفر توقف تولید در طول مهاجرت","دید لحظه‌ای به +۱۵۰ نود تولیدی","Failover شبکه زیر یک ثانیه محقق شد","همگرایی OT/IT بدون مصالحه امنیتی","کاهش ۴۰٪ توقف‌های تولید مرتبط با شبکه"]',
     '["Cisco","Grafana","Prometheus","Industrial Switches","SCADA","VoIP"]',
     '["سیسکو","Grafana","Prometheus","سوئیچ صنعتی","SCADA","VoIP"]',
     '#06b6d4', '2023', 1, 4],
  ]
  for (const r of projects) insProj.run(...r)

  // ── Clients ─────────────────────────────────────────────────────────────────
  db.prepare('DELETE FROM clients').run()
  const insClient = db.prepare(`
    INSERT INTO clients (name_en, name_fa, type_en, type_fa, logo_url, is_tech_partner, sort_order)
    VALUES (?,?,?,?,?,?,?)
  `)
  const clientsData = [
    ['Kenzo Restaurant', 'رستوران کنزو', 'Hospitality', 'هتلداری', '/uploads/general/restaurant-chain.svg', 0, 1],
    ['Popcorn Holding', 'هلدینگ پاپ‌کورن', 'Holding', 'هلدینگ', '/uploads/general/enterprise.svg', 0, 2],
    ['Senso Group', 'گروه سنسو', 'Food & Beverage', 'غذا و نوشیدنی', '/uploads/general/restaurant-chain.svg', 0, 3],
    ['Industrial Co.', 'شرکت صنعتی', 'Industrial', 'صنعتی', '/uploads/general/industrial.svg', 0, 4],
    ['Retail Chain', 'زنجیره خرده‌فروشی', 'Retail', 'خرده‌فروشی', '/uploads/general/enterprise.svg', 0, 5],
    ['Tech Startup', 'استارت‌آپ فناوری', 'Technology', 'فناوری', '/uploads/general/datacenter.svg', 0, 6],
    ['Medical Center', 'مرکز پزشکی', 'Healthcare', 'بهداشت', '/uploads/general/hospital.svg', 0, 7],
    ['Logistics Firm', 'شرکت لجستیک', 'Logistics', 'لجستیک', '/uploads/general/network-co.svg', 0, 8],
    ['Finance Group', 'گروه مالی', 'Finance', 'مالی', '/uploads/general/government.svg', 0, 9],
    ['Education Institute', 'موسسه آموزشی', 'Education', 'آموزش', '/uploads/general/university.svg', 0, 10],
    ['MikroTik', 'میکروتیک', 'Technology Partner', 'شریک فناوری', '/uploads/logos/mikrotik.svg', 1, 11],
    ['Cisco', 'سیسکو', 'Technology Partner', 'شریک فناوری', '/uploads/logos/cisco.svg', 1, 12],
    ['Fortigate', 'فورتی‌گیت', 'Technology Partner', 'شریک فناوری', '/uploads/logos/fortinet.svg', 1, 13],
    ['VMware', 'VMware', 'Technology Partner', 'شریک فناوری', '/uploads/logos/vmware.svg', 1, 14],
    ['Ubiquiti', 'Ubiquiti', 'Technology Partner', 'شریک فناوری', '/uploads/logos/cisco.svg', 1, 15],
    ['Zabbix', 'Zabbix', 'Technology Partner', 'شریک فناوری', '/uploads/logos/zabbix.svg', 1, 16],
    ['Proxmox', 'Proxmox', 'Technology Partner', 'شریک فناوری', '/uploads/logos/proxmox.svg', 1, 17],
    ['Sophos', 'Sophos', 'Technology Partner', 'شریک فناوری', '/uploads/logos/fortinet.svg', 1, 18],
    ['Veeam', 'Veeam', 'Technology Partner', 'شریک فناوری', '/uploads/logos/windows-server.svg', 1, 19],
    ['Grafana', 'Grafana', 'Technology Partner', 'شریک فناوری', '/uploads/logos/grafana.svg', 1, 20],
    ['Linux', 'لینوکس', 'Technology Partner', 'شریک فناوری', '/uploads/logos/linux.svg', 1, 21],
    ['Ansible', 'Ansible', 'Technology Partner', 'شریک فناوری', '/uploads/logos/ansible.svg', 1, 22],
  ]
  for (const r of clientsData) insClient.run(...r)

  // ── Blog Categories ──────────────────────────────────────────────────────────
  const insCat = db.prepare(`
    INSERT OR IGNORE INTO blog_categories (slug, name_en, name_fa, icon, color, sort_order)
    VALUES (?,?,?,?,?,?)
  `)
  const blogCats = [
    ['mikrotik', 'MikroTik', 'میکروتیک', '🌐', '#c03030', 1],
    ['cisco', 'Cisco', 'سیسکو', '🔷', '#1ba0d7', 2],
    ['linux', 'Linux', 'لینوکس', '🐧', '#f59e0b', 3],
    ['windows-server', 'Windows Server', 'ویندوز سرور', '🪟', '#00adef', 4],
    ['vmware', 'VMware', 'VMware', '☁️', '#60b6e0', 5],
    ['proxmox', 'Proxmox', 'Proxmox', '🖥️', '#e57000', 6],
    ['security', 'Security', 'امنیت', '🛡️', '#ef4444', 7],
    ['monitoring', 'Monitoring', 'پایش', '📊', '#f59e0b', 8],
    ['automation', 'Automation', 'خودکارسازی', '⚙️', '#06b6d4', 9],
    ['devops', 'DevOps', 'دواپس', '🚀', '#818cf8', 10],
  ]
  for (const r of blogCats) insCat.run(...r)

  // ── Blog Posts ───────────────────────────────────────────────────────────────
  const getCatId = db.prepare('SELECT id FROM blog_categories WHERE slug = ?')
  const insPost = db.prepare(`
    INSERT OR REPLACE INTO blog_posts
      (slug, title_en, title_fa, excerpt_en, excerpt_fa, content_en, content_fa, category_id, read_time_en, read_time_fa, published_at_en, published_at_fa, status, featured)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `)
  const blogPostsData = [
    // MikroTik
    { slug: 'mikrotik-ospf-multi-site', catSlug: 'mikrotik', titleEn: 'Building a Multi-Site MikroTik Network with OSPF', titleFa: 'ساخت شبکه چند سایته MikroTik با OSPF', excerptEn: 'A complete guide to designing and deploying multi-site OSPF routing with MikroTik RouterOS for enterprise branch offices.', excerptFa: 'راهنمای کامل طراحی و استقرار مسیریابی OSPF چند سایته با MikroTik RouterOS برای دفاتر شعبه سازمانی.', readTimeEn: '12 min read', readTimeFa: '۱۲ دقیقه مطالعه', publishedAtEn: 'Jan 2025', publishedAtFa: 'دی ۱۴۰۳', featured: 1 },
    { slug: 'mikrotik-vlan-segmentation', catSlug: 'mikrotik', titleEn: 'VLAN Segmentation on MikroTik: A Practical Guide', titleFa: 'تقسیم‌بندی VLAN روی MikroTik: راهنمای عملی', excerptEn: 'Master VLAN tagging, trunking, and inter-VLAN routing on MikroTik CRS and CCR devices for secure network segmentation.', excerptFa: 'تسلط بر VLAN tagging، Trunking و مسیریابی بین VLAN در MikroTik CRS و CCR برای تقسیم‌بندی امن شبکه.', readTimeEn: '10 min read', readTimeFa: '۱۰ دقیقه مطالعه', publishedAtEn: 'Feb 2025', publishedAtFa: 'بهمن ۱۴۰۳', featured: 0 },
    { slug: 'mikrotik-ipsec-vpn', catSlug: 'mikrotik', titleEn: 'Site-to-Site IPSec VPN with MikroTik: Complete Setup', titleFa: 'VPN IPSec سایت به سایت با MikroTik: راه‌اندازی کامل', excerptEn: 'Configure IPSec IKEv2 site-to-site VPN tunnels between MikroTik routers for secure inter-office connectivity.', excerptFa: 'پیکربندی تانل‌های VPN IPSec IKEv2 سایت به سایت بین روترهای MikroTik برای اتصال امن بین دفاتر.', readTimeEn: '14 min read', readTimeFa: '۱۴ دقیقه مطالعه', publishedAtEn: 'Mar 2025', publishedAtFa: 'اسفند ۱۴۰۳', featured: 0 },
    // Security
    { slug: 'zero-trust-fortigate', catSlug: 'security', titleEn: 'Zero-Trust Network Architecture with Fortigate', titleFa: 'معماری شبکه Zero-Trust با Fortigate', excerptEn: 'Implementing a zero-trust security model using Fortigate NGFW, SSL inspection, and micro-segmentation for enterprise environments.', excerptFa: 'پیاده‌سازی مدل امنیتی Zero-Trust با استفاده از Fortigate NGFW، بازرسی SSL و میکرو-تقسیم‌بندی برای محیط‌های سازمانی.', readTimeEn: '15 min read', readTimeFa: '۱۵ دقیقه مطالعه', publishedAtEn: 'Feb 2025', publishedAtFa: 'بهمن ۱۴۰۳', featured: 1 },
    { slug: 'network-penetration-testing-basics', catSlug: 'security', titleEn: 'Network Penetration Testing: Getting Started', titleFa: 'تست نفوذ شبکه: شروع کار', excerptEn: 'An introduction to network penetration testing methodology, tools (nmap, Metasploit), and how to identify common vulnerabilities.', excerptFa: 'مقدمه‌ای بر روش‌شناسی تست نفوذ شبکه، ابزارها (nmap، Metasploit) و نحوه شناسایی آسیب‌پذیری‌های رایج.', readTimeEn: '13 min read', readTimeFa: '۱۳ دقیقه مطالعه', publishedAtEn: 'Apr 2025', publishedAtFa: 'فروردین ۱۴۰۴', featured: 0 },
    { slug: 'firewall-policy-best-practices', catSlug: 'security', titleEn: 'Enterprise Firewall Policy Design Best Practices', titleFa: 'بهترین شیوه‌های طراحی پالیسی فایروال سازمانی', excerptEn: 'Design principles for effective firewall policies: rule ordering, deny-by-default, logging, and periodic review cycles.', excerptFa: 'اصول طراحی پالیسی‌های فایروال موثر: ترتیب قوانین، رد پیش‌فرض، لاگ‌گیری و چرخه‌های بازبینی دوره‌ای.', readTimeEn: '11 min read', readTimeFa: '۱۱ دقیقه مطالعه', publishedAtEn: 'May 2025', publishedAtFa: 'اردیبهشت ۱۴۰۴', featured: 0 },
    // Proxmox
    { slug: 'proxmox-cluster-production', catSlug: 'proxmox', titleEn: 'Proxmox VE Cluster Setup for Production Workloads', titleFa: 'راه‌اندازی کلاستر Proxmox VE برای بارکارهای تولیدی', excerptEn: 'Step-by-step guide to building a 3-node Proxmox cluster with Ceph storage, HA failover, and live migration for production VMs.', excerptFa: 'راهنمای گام به گام ساخت کلاستر ۳ نودی Proxmox با ذخیره‌سازی Ceph، Failover HA و Live Migration برای VM‌های تولیدی.', readTimeEn: '18 min read', readTimeFa: '۱۸ دقیقه مطالعه', publishedAtEn: 'Mar 2025', publishedAtFa: 'اسفند ۱۴۰۳', featured: 1 },
    { slug: 'proxmox-backup-server', catSlug: 'proxmox', titleEn: 'Proxmox Backup Server: Complete Configuration Guide', titleFa: 'Proxmox Backup Server: راهنمای پیکربندی کامل', excerptEn: 'Setting up and configuring Proxmox Backup Server for automated VM backups, deduplication, and efficient storage management.', excerptFa: 'راه‌اندازی و پیکربندی Proxmox Backup Server برای پشتیبان‌گیری خودکار VM، Deduplication و مدیریت کارآمد ذخیره‌سازی.', readTimeEn: '12 min read', readTimeFa: '۱۲ دقیقه مطالعه', publishedAtEn: 'Jun 2025', publishedAtFa: 'خرداد ۱۴۰۴', featured: 0 },
    // Monitoring
    { slug: 'zabbix-custom-dashboards', catSlug: 'monitoring', titleEn: 'Zabbix 7.0 Advanced Monitoring: Custom Dashboards', titleFa: 'پایش پیشرفته Zabbix 7.0: داشبوردهای اختصاصی', excerptEn: 'Creating enterprise-grade Zabbix dashboards with custom metrics, triggers, and Grafana integration for infrastructure visibility.', excerptFa: 'ساخت داشبوردهای سطح سازمانی در Zabbix با متریک‌های اختصاصی، ترایگرها و یکپارچه‌سازی Grafana برای دید زیرساختی.', readTimeEn: '10 min read', readTimeFa: '۱۰ دقیقه مطالعه', publishedAtEn: 'Apr 2025', publishedAtFa: 'فروردین ۱۴۰۴', featured: 0 },
    { slug: 'grafana-network-monitoring', catSlug: 'monitoring', titleEn: 'Building a Network Monitoring Stack with Grafana + Prometheus', titleFa: 'ساخت استک پایش شبکه با Grafana + Prometheus', excerptEn: 'Deploy a complete observability stack using Prometheus for metric collection and Grafana for visualization of network KPIs.', excerptFa: 'استقرار استک کامل مشاهده‌پذیری با Prometheus برای جمع‌آوری متریک و Grafana برای تجسم KPI‌های شبکه.', readTimeEn: '16 min read', readTimeFa: '۱۶ دقیقه مطالعه', publishedAtEn: 'May 2025', publishedAtFa: 'اردیبهشت ۱۴۰۴', featured: 0 },
    { slug: 'snmp-monitoring-deep-dive', catSlug: 'monitoring', titleEn: 'SNMP Monitoring Deep Dive: From OID to Dashboard', titleFa: 'آشنایی عمیق با پایش SNMP: از OID تا داشبورد', excerptEn: 'Understanding SNMP v2c/v3, walking OID trees, creating custom Zabbix templates for network devices and servers.', excerptFa: 'درک SNMP v2c/v3، پیمایش OID tree، ساخت قالب‌های اختصاصی Zabbix برای تجهیزات شبکه و سرورها.', readTimeEn: '14 min read', readTimeFa: '۱۴ دقیقه مطالعه', publishedAtEn: 'Jun 2025', publishedAtFa: 'خرداد ۱۴۰۴', featured: 0 },
    // Automation
    { slug: 'ansible-network-automation', catSlug: 'automation', titleEn: 'Ansible for Network Automation: MikroTik & Cisco', titleFa: 'Ansible برای خودکارسازی شبکه: MikroTik و Cisco', excerptEn: 'Automating network device configuration with Ansible: real playbooks for MikroTik RouterOS and Cisco IOS environments.', excerptFa: 'خودکارسازی پیکربندی تجهیزات شبکه با Ansible: Playbook‌های واقعی برای MikroTik RouterOS و Cisco IOS.', readTimeEn: '14 min read', readTimeFa: '۱۴ دقیقه مطالعه', publishedAtEn: 'May 2025', publishedAtFa: 'اردیبهشت ۱۴۰۴', featured: 0 },
    { slug: 'python-network-automation', catSlug: 'automation', titleEn: 'Python Network Automation with Netmiko and NAPALM', titleFa: 'خودکارسازی شبکه Python با Netmiko و NAPALM', excerptEn: 'Write Python scripts to automate configuration backups, bulk changes, and network audits using Netmiko and NAPALM libraries.', excerptFa: 'نوشتن اسکریپت‌های Python برای خودکارسازی پشتیبان‌گیری پیکربندی، تغییرات انبوه و Audit شبکه با Netmiko و NAPALM.', readTimeEn: '17 min read', readTimeFa: '۱۷ دقیقه مطالعه', publishedAtEn: 'Jun 2025', publishedAtFa: 'خرداد ۱۴۰۴', featured: 0 },
    // Linux
    { slug: 'linux-server-hardening', catSlug: 'linux', titleEn: 'Linux Server Hardening: Production Security Checklist', titleFa: 'سخت‌سازی سرور لینوکس: چک‌لیست امنیتی تولیدی', excerptEn: 'Comprehensive security hardening checklist for Linux production servers: SSH, firewall, audit, SELinux, and automated compliance.', excerptFa: 'چک‌لیست جامع سخت‌سازی امنیتی سرورهای لینوکس تولیدی: SSH، فایروال، Audit، SELinux و انطباق خودکار.', readTimeEn: '16 min read', readTimeFa: '۱۶ دقیقه مطالعه', publishedAtEn: 'Jun 2025', publishedAtFa: 'خرداد ۱۴۰۴', featured: 0 },
    { slug: 'nginx-reverse-proxy-setup', catSlug: 'linux', titleEn: 'Nginx as a Reverse Proxy: Load Balancing & SSL Termination', titleFa: 'Nginx به عنوان Reverse Proxy: توازن بار و SSL Termination', excerptEn: 'Configure Nginx for reverse proxying, load balancing multiple backends, and SSL termination with Let\'s Encrypt in production.', excerptFa: 'پیکربندی Nginx برای Reverse Proxy، توازن بار چند Backend و SSL Termination با Let\'s Encrypt در محیط تولیدی.', readTimeEn: '11 min read', readTimeFa: '۱۱ دقیقه مطالعه', publishedAtEn: 'Jul 2025', publishedAtFa: 'تیر ۱۴۰۴', featured: 0 },
    { slug: 'linux-performance-tuning', catSlug: 'linux', titleEn: 'Linux Kernel Performance Tuning for Network Servers', titleFa: 'تنظیم عملکرد هسته لینوکس برای سرورهای شبکه', excerptEn: 'Optimize Linux kernel parameters for high-throughput network servers: TCP buffers, IRQ affinity, NUMA, and I/O schedulers.', excerptFa: 'بهینه‌سازی پارامترهای هسته لینوکس برای سرورهای شبکه پرترافیک: بافرهای TCP، IRQ affinity، NUMA و زمان‌بند I/O.', readTimeEn: '15 min read', readTimeFa: '۱۵ دقیقه مطالعه', publishedAtEn: 'Jul 2025', publishedAtFa: 'تیر ۱۴۰۴', featured: 0 },
    // VMware
    { slug: 'vmware-vsphere-ha-configuration', catSlug: 'vmware', titleEn: 'VMware vSphere HA: Configuration and Best Practices', titleFa: 'VMware vSphere HA: پیکربندی و بهترین شیوه‌ها', excerptEn: 'Configure High Availability in VMware vSphere: admission control, restart priorities, and proactive HA for production clusters.', excerptFa: 'پیکربندی High Availability در VMware vSphere: کنترل پذیرش، اولویت‌های راه‌اندازی مجدد و HA فعال برای کلاسترهای تولیدی.', readTimeEn: '13 min read', readTimeFa: '۱۳ دقیقه مطالعه', publishedAtEn: 'Mar 2025', publishedAtFa: 'اسفند ۱۴۰۳', featured: 0 },
    { slug: 'vmware-network-design', catSlug: 'vmware', titleEn: 'VMware Distributed Switch Design for Enterprise Clusters', titleFa: 'طراحی VMware Distributed Switch برای کلاسترهای سازمانی', excerptEn: 'Design NSX-free enterprise networking in vSphere with Distributed Virtual Switches, port groups, LACP, and traffic shaping.', excerptFa: 'طراحی شبکه سازمانی بدون NSX در vSphere با Distributed Virtual Switch، Port Group، LACP و Traffic Shaping.', readTimeEn: '14 min read', readTimeFa: '۱۴ دقیقه مطالعه', publishedAtEn: 'Apr 2025', publishedAtFa: 'فروردین ۱۴۰۴', featured: 0 },
    // Windows Server
    { slug: 'active-directory-design-enterprise', catSlug: 'windows-server', titleEn: 'Active Directory Design for Multi-Site Enterprises', titleFa: 'طراحی Active Directory برای سازمان‌های چند سایته', excerptEn: 'Best practices for designing AD forests, sites, subnets, and replication topology for distributed enterprise environments.', excerptFa: 'بهترین شیوه‌های طراحی Forest، Site، Subnet و توپولوژی Replication AD برای محیط‌های سازمانی توزیع‌شده.', readTimeEn: '15 min read', readTimeFa: '۱۵ دقیقه مطالعه', publishedAtEn: 'May 2025', publishedAtFa: 'اردیبهشت ۱۴۰۴', featured: 0 },
    { slug: 'windows-server-core-hardening', catSlug: 'windows-server', titleEn: 'Windows Server Core Hardening with CIS Benchmarks', titleFa: 'سخت‌سازی Windows Server Core با معیارهای CIS', excerptEn: 'Apply CIS Benchmark controls to Windows Server: account policies, audit policies, registry hardening, and automated compliance.', excerptFa: 'اعمال کنترل‌های CIS Benchmark روی Windows Server: پالیسی‌های حساب، پالیسی‌های Audit، سخت‌سازی رجیستری و انطباق خودکار.', readTimeEn: '12 min read', readTimeFa: '۱۲ دقیقه مطالعه', publishedAtEn: 'Jun 2025', publishedAtFa: 'خرداد ۱۴۰۴', featured: 0 },
    // Cisco
    { slug: 'cisco-bgp-enterprise-isp', catSlug: 'cisco', titleEn: 'BGP Configuration for Enterprise Internet Redundancy', titleFa: 'پیکربندی BGP برای افزونگی اینترنت سازمانی', excerptEn: 'Configure eBGP dual-homed connectivity for enterprise networks: path selection, policy routing, and failover with Cisco IOS-XE.', excerptFa: 'پیکربندی اتصال eBGP Dual-Homed برای شبکه‌های سازمانی: انتخاب مسیر، مسیریابی سیاستی و Failover با Cisco IOS-XE.', readTimeEn: '16 min read', readTimeFa: '۱۶ دقیقه مطالعه', publishedAtEn: 'Apr 2025', publishedAtFa: 'فروردین ۱۴۰۴', featured: 0 },
    { slug: 'cisco-qos-voip-optimization', catSlug: 'cisco', titleEn: 'QoS Configuration for VoIP on Cisco Networks', titleFa: 'پیکربندی QoS برای VoIP روی شبکه‌های سیسکو', excerptEn: 'Implement end-to-end QoS policies on Cisco routers and switches to prioritize VoIP traffic and eliminate packet loss.', excerptFa: 'پیاده‌سازی پالیسی‌های QoS کامل روی روتر و سوئیچ سیسکو برای اولویت‌بندی ترافیک VoIP و حذف افت پکت.', readTimeEn: '13 min read', readTimeFa: '۱۳ دقیقه مطالعه', publishedAtEn: 'May 2025', publishedAtFa: 'اردیبهشت ۱۴۰۴', featured: 0 },
    // DevOps
    { slug: 'docker-enterprise-networking', catSlug: 'devops', titleEn: 'Docker Networking for Enterprise Applications', titleFa: 'شبکه‌بندی Docker برای برنامه‌های سازمانی', excerptEn: 'Deep dive into Docker bridge, overlay, and macvlan networks for production deployments with multi-host connectivity.', excerptFa: 'بررسی عمیق شبکه‌های Bridge، Overlay و Macvlan در Docker برای استقرارهای تولیدی با اتصال چند Host.', readTimeEn: '14 min read', readTimeFa: '۱۴ دقیقه مطالعه', publishedAtEn: 'Jun 2025', publishedAtFa: 'خرداد ۱۴۰۴', featured: 0 },
    { slug: 'kubernetes-network-policies', catSlug: 'devops', titleEn: 'Kubernetes Network Policies: Micro-segmentation in K8s', titleFa: 'پالیسی‌های شبکه Kubernetes: میکرو-تقسیم‌بندی در K8s', excerptEn: 'Implement Kubernetes NetworkPolicy resources for pod-to-pod traffic control, namespace isolation, and egress filtering.', excerptFa: 'پیاده‌سازی منابع NetworkPolicy در Kubernetes برای کنترل ترافیک Pod به Pod، ایزولاسیون Namespace و فیلترینگ Egress.', readTimeEn: '15 min read', readTimeFa: '۱۵ دقیقه مطالعه', publishedAtEn: 'Jul 2025', publishedAtFa: 'تیر ۱۴۰۴', featured: 0 },
    { slug: 'gitops-infrastructure-terraform', catSlug: 'devops', titleEn: 'GitOps for Infrastructure: Terraform & Git Workflow', titleFa: 'GitOps برای زیرساخت: Terraform و Git Workflow', excerptEn: 'Adopt GitOps practices for infrastructure management: Terraform modules, Git branching, pull request reviews, and automated apply pipelines.', excerptFa: 'پذیرش شیوه‌های GitOps برای مدیریت زیرساخت: ماژول‌های Terraform، branching Git، بازبینی Pull Request و پایپلاین‌های اعمال خودکار.', readTimeEn: '17 min read', readTimeFa: '۱۷ دقیقه مطالعه', publishedAtEn: 'Jul 2025', publishedAtFa: 'تیر ۱۴۰۴', featured: 0 },
    // General Networking
    { slug: 'sd-wan-enterprise-deployment', catSlug: 'mikrotik', titleEn: 'SD-WAN Deployment for Multi-Branch Enterprises', titleFa: 'استقرار SD-WAN برای سازمان‌های چند شعبه‌ای', excerptEn: 'Design and deploy SD-WAN solutions for distributed enterprise branches: policy-based routing, WAN optimization, and failover.', excerptFa: 'طراحی و استقرار راه‌حل‌های SD-WAN برای شعب سازمانی توزیع‌شده: مسیریابی مبتنی بر پالیسی، بهینه‌سازی WAN و Failover.', readTimeEn: '15 min read', readTimeFa: '۱۵ دقیقه مطالعه', publishedAtEn: 'Jul 2025', publishedAtFa: 'تیر ۱۴۰۴', featured: 0 },
    { slug: 'backup-disaster-recovery-strategy', catSlug: 'automation', titleEn: 'Designing a Backup & DR Strategy: RTO, RPO, and Testing', titleFa: 'طراحی استراتژی پشتیبان‌گیری و DR: RTO، RPO و آزمایش', excerptEn: 'Build a comprehensive backup and disaster recovery strategy with defined RTO/RPO targets, backup tiers, and regular testing procedures.', excerptFa: 'ساخت استراتژی جامع پشتیبان‌گیری و بازیابی فاجعه با اهداف مشخص RTO/RPO، لایه‌های پشتیبان و رویه‌های آزمایش منظم.', readTimeEn: '13 min read', readTimeFa: '۱۳ دقیقه مطالعه', publishedAtEn: 'Jul 2025', publishedAtFa: 'تیر ۱۴۰۴', featured: 0 },
    { slug: 'network-documentation-best-practices', catSlug: 'monitoring', titleEn: 'Network Documentation Best Practices for IT Teams', titleFa: 'بهترین شیوه‌های مستندسازی شبکه برای تیم‌های IT', excerptEn: 'Create and maintain accurate network documentation: topology diagrams, IP address management, change logs, and runbooks.', excerptFa: 'ایجاد و نگهداری مستندات دقیق شبکه: نمودارهای توپولوژی، مدیریت آدرس IP، لاگ تغییرات و Runbook‌ها.', readTimeEn: '9 min read', readTimeFa: '۹ دقیقه مطالعه', publishedAtEn: 'Jun 2025', publishedAtFa: 'خرداد ۱۴۰۴', featured: 0 },
    { slug: 'voip-asterisk-enterprise', catSlug: 'devops', titleEn: 'Enterprise VoIP with Asterisk FreePBX: Full Setup Guide', titleFa: 'VoIP سازمانی با Asterisk FreePBX: راهنمای کامل نصب', excerptEn: 'Deploy a production VoIP system with Asterisk FreePBX: SIP trunks, extensions, IVR, call queues, and recording.', excerptFa: 'استقرار سیستم VoIP تولیدی با Asterisk FreePBX: SIP Trunk، داخلی، IVR، صف تماس و ضبط.', readTimeEn: '20 min read', readTimeFa: '۲۰ دقیقه مطالعه', publishedAtEn: 'Aug 2025', publishedAtFa: 'مرداد ۱۴۰۴', featured: 0 },
    { slug: 'network-capacity-planning', catSlug: 'monitoring', titleEn: 'Network Capacity Planning: Methodology and Tools', titleFa: 'برنامه‌ریزی ظرفیت شبکه: روش‌شناسی و ابزارها', excerptEn: 'Plan network capacity proactively: traffic analysis, growth modeling, bottleneck identification, and upgrade planning cycles.', excerptFa: 'برنامه‌ریزی ظرفیت شبکه به صورت پیشگیرانه: تحلیل ترافیک، مدل‌سازی رشد، شناسایی تنگناها و چرخه‌های برنامه‌ریزی ارتقاء.', readTimeEn: '12 min read', readTimeFa: '۱۲ دقیقه مطالعه', publishedAtEn: 'Aug 2025', publishedAtFa: 'مرداد ۱۴۰۴', featured: 0 },
    { slug: 'full-blog-platform-search-rss', catSlug: 'devops', titleEn: 'Building a Complete Blog Platform: Search, Filtering, Code Highlighting & RSS Feed', titleFa: 'ساخت پلتفرم کامل وبلاگ: جستجو، فیلترینگ، هایلایت کد و فید RSS', excerptEn: 'A comprehensive guide to building a production-ready blog platform with full-text search, category filtering, syntax highlighting, and RSS feed generation using Next.js, Shiki, and Drizzle ORM.', excerptFa: 'راهنمای جامع ساخت پلتفرم وبلاگ آماده برای محیط تولیدی با جستجوی متن کامل، فیلترینگ دسته‌بندی، هایلایت سینتکس و تولید فید RSS با استفاده از Next.js، Shiki و Drizzle ORM.', readTimeEn: '22 min read', readTimeFa: '۲۲ دقیقه مطالعه', publishedAtEn: 'Aug 2025', publishedAtFa: 'مرداد ۱۴۰۴', featured: 1 },
    { slug: 'mikrotik-bandwidth-management', catSlug: 'mikrotik', titleEn: 'MikroTik Bandwidth Management: Queues & Traffic Shaping', titleFa: 'مدیریت پهنای باند MikroTik: صف و شکل‌دهی ترافیک', excerptEn: 'Master Simple Queues, Queue Trees, and PCQ in MikroTik RouterOS to control per-user and per-IP bandwidth allocation.', excerptFa: 'تسلط بر Simple Queue، Queue Tree و PCQ در MikroTik RouterOS برای کنترل تخصیص پهنای باند per-user و per-IP.', readTimeEn: '12 min read', readTimeFa: '۱۲ دقیقه مطالعه', publishedAtEn: 'Aug 2025', publishedAtFa: 'مرداد ۱۴۰۴', featured: 0 },
    { slug: 'mikrotik-wireguard-vpn', catSlug: 'mikrotik', titleEn: 'WireGuard VPN on MikroTik RouterOS 7', titleFa: 'VPN WireGuard روی MikroTik RouterOS 7', excerptEn: 'Configure WireGuard VPN peers on MikroTik RouterOS 7 for fast, secure remote access and site-to-site tunnels.', excerptFa: 'پیکربندی Peer های WireGuard VPN روی MikroTik RouterOS 7 برای دسترسی راه دور سریع و امن و تانل‌های سایت به سایت.', readTimeEn: '10 min read', readTimeFa: '۱۰ دقیقه مطالعه', publishedAtEn: 'Sep 2025', publishedAtFa: 'شهریور ۱۴۰۴', featured: 0 },
    { slug: 'mikrotik-hotspot-captive-portal', catSlug: 'mikrotik', titleEn: 'MikroTik HotSpot and Captive Portal for Guest Networks', titleFa: 'HotSpot و Captive Portal MikroTik برای شبکه‌های مهمان', excerptEn: 'Deploy a MikroTik HotSpot system with user management, bandwidth limits, voucher codes, and custom login pages.', excerptFa: 'استقرار سیستم HotSpot MikroTik با مدیریت کاربر، محدودیت پهنای باند، کد کوپن و صفحات ورود اختصاصی.', readTimeEn: '13 min read', readTimeFa: '۱۳ دقیقه مطالعه', publishedAtEn: 'Sep 2025', publishedAtFa: 'شهریور ۱۴۰۴', featured: 0 },
    { slug: 'mikrotik-bgp-routeros7', catSlug: 'mikrotik', titleEn: 'BGP Routing on MikroTik RouterOS 7: New Routing Engine', titleFa: 'مسیریابی BGP روی MikroTik RouterOS 7: موتور مسیریابی جدید', excerptEn: 'Leverage RouterOS 7 new routing engine for BGP sessions, route filters, communities, and redundant ISP connectivity.', excerptFa: 'استفاده از موتور مسیریابی جدید RouterOS 7 برای Session های BGP، فیلترهای مسیر، Community و اتصال افزونه ISP.', readTimeEn: '15 min read', readTimeFa: '۱۵ دقیقه مطالعه', publishedAtEn: 'Oct 2025', publishedAtFa: 'مهر ۱۴۰۴', featured: 0 },
    { slug: 'mikrotik-dual-wan-failover', catSlug: 'mikrotik', titleEn: 'MikroTik Dual WAN Failover with Load Balancing', titleFa: 'Failover دو WAN MikroTik با توازن بار', excerptEn: 'Configure MikroTik dual-WAN with ECMP load balancing, health checks, and automatic failover for high-availability internet.', excerptFa: 'پیکربندی دو WAN MikroTik با ECMP توازن بار، Health Check و Failover خودکار برای اینترنت با دسترس‌پذیری بالا.', readTimeEn: '11 min read', readTimeFa: '۱۱ دقیقه مطالعه', publishedAtEn: 'Oct 2025', publishedAtFa: 'مهر ۱۴۰۴', featured: 0 },
    { slug: 'mikrotik-crs-switch-management', catSlug: 'mikrotik', titleEn: 'MikroTik CRS Switch: Layer 2 and Layer 3 Management', titleFa: 'سوئیچ CRS MikroTik: مدیریت لایه ۲ و لایه ۳', excerptEn: 'Configure MikroTik CRS series switches with bridge, VLAN, STP, port isolation, and hardware offloading for line-rate performance.', excerptFa: 'پیکربندی سوئیچ‌های سری CRS MikroTik با Bridge، VLAN، STP، ایزولاسیون پورت و Hardware Offloading برای عملکرد Line-rate.', readTimeEn: '14 min read', readTimeFa: '۱۴ دقیقه مطالعه', publishedAtEn: 'Nov 2025', publishedAtFa: 'آبان ۱۴۰۴', featured: 0 },
    { slug: 'mikrotik-advanced-mangle', catSlug: 'mikrotik', titleEn: 'MikroTik Advanced Mangle Rules for Traffic Classification', titleFa: 'قوانین Mangle پیشرفته MikroTik برای طبقه‌بندی ترافیک', excerptEn: 'Use MikroTik mangle rules for packet marking, PBR, connection tracking, and QoS classification across complex network topologies.', excerptFa: 'استفاده از قوانین Mangle MikroTik برای علامت‌گذاری پکت، PBR، Connection Tracking و طبقه‌بندی QoS در توپولوژی‌های پیچیده.', readTimeEn: '16 min read', readTimeFa: '۱۶ دقیقه مطالعه', publishedAtEn: 'Nov 2025', publishedAtFa: 'آبان ۱۴۰۴', featured: 0 },
    { slug: 'ssl-tls-certificate-management', catSlug: 'security', titleEn: 'SSL/TLS Certificate Management at Scale', titleFa: 'مدیریت گواهی SSL/TLS در مقیاس بزرگ', excerptEn: 'Automate SSL/TLS certificate issuance, renewal, and deployment using Lets Encrypt, ACME protocol, and cert-manager in production.', excerptFa: 'خودکارسازی صدور، تمدید و استقرار گواهی SSL/TLS با Let Encrypt، پروتکل ACME و cert-manager در محیط تولیدی.', readTimeEn: '11 min read', readTimeFa: '۱۱ دقیقه مطالعه', publishedAtEn: 'Sep 2025', publishedAtFa: 'شهریور ۱۴۰۴', featured: 0 },
    { slug: 'ids-ips-snort-suricata', catSlug: 'security', titleEn: 'IDS/IPS with Snort and Suricata: Detection and Prevention', titleFa: 'IDS/IPS با Snort و Suricata: تشخیص و پیشگیری', excerptEn: 'Deploy Snort and Suricata for network intrusion detection: rule management, alert tuning, and integration with SIEM platforms.', excerptFa: 'استقرار Snort و Suricata برای تشخیص نفوذ شبکه: مدیریت قوانین، تنظیم هشدارها و یکپارچه‌سازی با پلتفرم‌های SIEM.', readTimeEn: '15 min read', readTimeFa: '۱۵ دقیقه مطالعه', publishedAtEn: 'Sep 2025', publishedAtFa: 'شهریور ۱۴۰۴', featured: 0 },
    { slug: 'dmz-architecture-design', catSlug: 'security', titleEn: 'DMZ Architecture: Designing a Secure Perimeter Network', titleFa: 'معماری DMZ: طراحی شبکه محیطی امن', excerptEn: 'Design multi-zone DMZ architectures with dual firewalls, service tiers, traffic flow policies, and internet-facing server hardening.', excerptFa: 'طراحی معماری DMZ چند ناحیه‌ای با فایروال دوگانه، لایه‌های سرویس، پالیسی‌های جریان ترافیک و سخت‌سازی سرورهای روبرو با اینترنت.', readTimeEn: '13 min read', readTimeFa: '۱۳ دقیقه مطالعه', publishedAtEn: 'Oct 2025', publishedAtFa: 'مهر ۱۴۰۴', featured: 0 },
    { slug: 'siem-log-management-elk', catSlug: 'security', titleEn: 'SIEM and Log Management with ELK Stack', titleFa: 'SIEM و مدیریت لاگ با ELK Stack', excerptEn: 'Build a SIEM platform using Elasticsearch, Logstash, and Kibana for centralized log collection, correlation, and threat detection.', excerptFa: 'ساخت پلتفرم SIEM با Elasticsearch، Logstash و Kibana برای جمع‌آوری مرکزی لاگ، همبستگی و تشخیص تهدید.', readTimeEn: '18 min read', readTimeFa: '۱۸ دقیقه مطالعه', publishedAtEn: 'Oct 2025', publishedAtFa: 'مهر ۱۴۰۴', featured: 0 },
    { slug: 'ssl-vpn-openvpn-wireguard', catSlug: 'security', titleEn: 'SSL VPN Compared: OpenVPN vs WireGuard', titleFa: 'مقایسه SSL VPN: OpenVPN در برابر WireGuard', excerptEn: 'Compare OpenVPN and WireGuard for remote access VPN: performance benchmarks, security model, configuration, and use cases.', excerptFa: 'مقایسه OpenVPN و WireGuard برای VPN دسترسی راه دور: بنچمارک عملکرد، مدل امنیتی، پیکربندی و موارد استفاده.', readTimeEn: '12 min read', readTimeFa: '۱۲ دقیقه مطالعه', publishedAtEn: 'Nov 2025', publishedAtFa: 'آبان ۱۴۰۴', featured: 0 },
    { slug: 'email-security-spf-dkim-dmarc', catSlug: 'security', titleEn: 'Email Security: SPF, DKIM, and DMARC Configuration', titleFa: 'امنیت ایمیل: پیکربندی SPF، DKIM و DMARC', excerptEn: 'Implement SPF, DKIM, and DMARC to protect your domain from email spoofing and phishing attacks with step-by-step DNS configuration.', excerptFa: 'پیاده‌سازی SPF، DKIM و DMARC برای حفاظت دامنه از Spoofing ایمیل و حملات فیشینگ با پیکربندی DNS گام به گام.', readTimeEn: '10 min read', readTimeFa: '۱۰ دقیقه مطالعه', publishedAtEn: 'Nov 2025', publishedAtFa: 'آبان ۱۴۰۴', featured: 0 },
    { slug: 'ransomware-defense-strategy', catSlug: 'security', titleEn: 'Ransomware Defense: Detection, Prevention and Recovery', titleFa: 'دفاع در برابر باج‌افزار: تشخیص، پیشگیری و بازیابی', excerptEn: 'Build a layered ransomware defense strategy: network segmentation, endpoint protection, immutable backups, and incident response playbooks.', excerptFa: 'ساخت استراتژی دفاعی لایه‌لایه در برابر باج‌افزار: تقسیم‌بندی شبکه، حفاظت endpoint، پشتیبان‌های تغییرناپذیر و Playbook پاسخ به حوادث.', readTimeEn: '14 min read', readTimeFa: '۱۴ دقیقه مطالعه', publishedAtEn: 'Dec 2025', publishedAtFa: 'آذر ۱۴۰۴', featured: 0 },
    { slug: 'vulnerability-scanning-openvas', catSlug: 'security', titleEn: 'Vulnerability Scanning with OpenVAS and Greenbone', titleFa: 'اسکن آسیب‌پذیری با OpenVAS و Greenbone', excerptEn: 'Set up OpenVAS/Greenbone for continuous vulnerability scanning: scan configs, credential scans, reporting, and remediation workflows.', excerptFa: 'راه‌اندازی OpenVAS/Greenbone برای اسکن مداوم آسیب‌پذیری: پیکربندی اسکن، اسکن با Credential، گزارش‌دهی و جریان‌های کاری رفع.', readTimeEn: '13 min read', readTimeFa: '۱۳ دقیقه مطالعه', publishedAtEn: 'Dec 2025', publishedAtFa: 'آذر ۱۴۰۴', featured: 0 },
    { slug: 'lxc-lxd-containers-linux', catSlug: 'linux', titleEn: 'LXC/LXD Containers on Linux: System Container Virtualization', titleFa: 'کانتینرهای LXC/LXD روی لینوکس: مجازی‌سازی کانتینر سیستمی', excerptEn: 'Deploy and manage LXC/LXD system containers for lightweight virtualization: networking, storage pools, profiles, and cluster setup.', excerptFa: 'استقرار و مدیریت کانتینرهای سیستمی LXC/LXD برای مجازی‌سازی سبک: شبکه‌بندی، Storage Pool، Profile و راه‌اندازی کلاستر.', readTimeEn: '14 min read', readTimeFa: '۱۴ دقیقه مطالعه', publishedAtEn: 'Sep 2025', publishedAtFa: 'شهریور ۱۴۰۴', featured: 0 },
    { slug: 'bash-scripting-sysadmin', catSlug: 'linux', titleEn: 'Bash Scripting for SysAdmins: Automation and Monitoring', titleFa: 'اسکریپت‌نویسی Bash برای SysAdmin: خودکارسازی و پایش', excerptEn: 'Write production-ready Bash scripts for log rotation, system health checks, automated alerting, and infrastructure maintenance tasks.', excerptFa: 'نوشتن اسکریپت‌های Bash آماده تولید برای Rotation لاگ، بررسی سلامت سیستم، هشدار خودکار و وظایف نگهداری زیرساخت.', readTimeEn: '16 min read', readTimeFa: '۱۶ دقیقه مطالعه', publishedAtEn: 'Sep 2025', publishedAtFa: 'شهریور ۱۴۰۴', featured: 0 },
    { slug: 'lvm-raid-zfs-storage', catSlug: 'linux', titleEn: 'LVM, RAID, and ZFS: Linux Storage Management Guide', titleFa: 'LVM، RAID و ZFS: راهنمای مدیریت ذخیره‌سازی لینوکس', excerptEn: 'Configure LVM volumes, software RAID arrays, and ZFS pools on Linux for redundant, flexible, and high-performance storage.', excerptFa: 'پیکربندی Volume های LVM، آرایه‌های RAID نرم‌افزاری و ZFS Pool روی لینوکس برای ذخیره‌سازی افزونه، انعطاف‌پذیر و پرعملکرد.', readTimeEn: '15 min read', readTimeFa: '۱۵ دقیقه مطالعه', publishedAtEn: 'Oct 2025', publishedAtFa: 'مهر ۱۴۰۴', featured: 0 },
    { slug: 'postfix-mail-server-linux', catSlug: 'linux', titleEn: 'Setting Up Postfix Mail Server on Linux', titleFa: 'راه‌اندازی سرور ایمیل Postfix روی لینوکس', excerptEn: 'Install and configure Postfix as a production mail server with Dovecot IMAP, SpamAssassin, DKIM signing, and TLS encryption.', excerptFa: 'نصب و پیکربندی Postfix به عنوان سرور ایمیل تولیدی با Dovecot IMAP، SpamAssassin، امضای DKIM و رمزگذاری TLS.', readTimeEn: '17 min read', readTimeFa: '۱۷ دقیقه مطالعه', publishedAtEn: 'Oct 2025', publishedAtFa: 'مهر ۱۴۰۴', featured: 0 },
    { slug: 'linux-bonding-vlan-bridges', catSlug: 'linux', titleEn: 'Linux Network Bonding, VLANs, and Bridges', titleFa: 'Bonding، VLAN و Bridge شبکه لینوکس', excerptEn: 'Configure Linux network bonding for redundancy, 802.1Q VLANs for segmentation, and bridges for VM networking with systemd-networkd.', excerptFa: 'پیکربندی Bonding شبکه لینوکس برای افزونگی، VLAN 802.1Q برای تقسیم‌بندی و Bridge برای شبکه‌بندی VM با systemd-networkd.', readTimeEn: '12 min read', readTimeFa: '۱۲ دقیقه مطالعه', publishedAtEn: 'Nov 2025', publishedAtFa: 'آبان ۱۴۰۴', featured: 0 },
    { slug: 'prometheus-node-exporter', catSlug: 'linux', titleEn: 'Linux Monitoring with Prometheus Node Exporter', titleFa: 'پایش لینوکس با Prometheus Node Exporter', excerptEn: 'Deploy Prometheus Node Exporter for deep Linux system metrics: CPU, memory, disk, network, and custom collectors with Grafana dashboards.', excerptFa: 'استقرار Prometheus Node Exporter برای متریک‌های عمیق سیستم لینوکس: CPU، حافظه، دیسک، شبکه و Collector های اختصاصی با داشبوردهای Grafana.', readTimeEn: '11 min read', readTimeFa: '۱۱ دقیقه مطالعه', publishedAtEn: 'Nov 2025', publishedAtFa: 'آبان ۱۴۰۴', featured: 0 },
    { slug: 'keepalived-haproxy-ha', catSlug: 'linux', titleEn: 'KeepAlived + HAProxy: High Availability Load Balancer', titleFa: 'KeepAlived + HAProxy: توازن بار با دسترس‌پذیری بالا', excerptEn: 'Build an active-passive HA load balancer cluster with Keepalived VRRP and HAProxy for zero-downtime failover in production.', excerptFa: 'ساخت کلاستر توازن بار HA Active-Passive با Keepalived VRRP و HAProxy برای Failover بدون Downtime در تولید.', readTimeEn: '13 min read', readTimeFa: '۱۳ دقیقه مطالعه', publishedAtEn: 'Dec 2025', publishedAtFa: 'آذر ۱۴۰۴', featured: 0 },
    { slug: 'elk-log-management-linux', catSlug: 'linux', titleEn: 'Centralized Log Management with ELK Stack on Linux', titleFa: 'مدیریت لاگ متمرکز با ELK Stack روی لینوکس', excerptEn: 'Deploy the ELK stack (Elasticsearch, Logstash, Kibana) with Filebeat agents for centralized Linux system log collection and analysis.', excerptFa: 'استقرار ELK Stack (Elasticsearch، Logstash، Kibana) با Agent های Filebeat برای جمع‌آوری و تحلیل مرکزی لاگ سیستم لینوکس.', readTimeEn: '15 min read', readTimeFa: '۱۵ دقیقه مطالعه', publishedAtEn: 'Dec 2025', publishedAtFa: 'آذر ۱۴۰۴', featured: 0 },
    { slug: 'cisco-stp-rstp-mstp', catSlug: 'cisco', titleEn: 'Spanning Tree Protocol: STP, RSTP, and MSTP on Cisco', titleFa: 'Spanning Tree Protocol: STP، RSTP و MSTP روی سیسکو', excerptEn: 'Master STP, RSTP, and MSTP on Cisco switches: root bridge election, port states, BPDU guard, PortFast, and loop prevention.', excerptFa: 'تسلط بر STP، RSTP و MSTP روی سوئیچ‌های سیسکو: انتخاب Root Bridge، وضعیت پورت، BPDU Guard، PortFast و پیشگیری از Loop.', readTimeEn: '13 min read', readTimeFa: '۱۳ دقیقه مطالعه', publishedAtEn: 'Sep 2025', publishedAtFa: 'شهریور ۱۴۰۴', featured: 0 },
    { slug: 'cisco-ospf-enterprise', catSlug: 'cisco', titleEn: 'OSPF Design for Enterprise Networks on Cisco IOS', titleFa: 'طراحی OSPF برای شبکه‌های سازمانی روی Cisco IOS', excerptEn: 'Design scalable OSPF topologies with areas, summarization, redistribution, and authentication for large enterprise Cisco networks.', excerptFa: 'طراحی توپولوژی‌های OSPF مقیاس‌پذیر با Area، Summarization، Redistribution و احراز هویت برای شبکه‌های بزرگ سازمانی سیسکو.', readTimeEn: '15 min read', readTimeFa: '۱۵ دقیقه مطالعه', publishedAtEn: 'Oct 2025', publishedAtFa: 'مهر ۱۴۰۴', featured: 0 },
    { slug: 'cisco-aci-fundamentals', catSlug: 'cisco', titleEn: 'Cisco ACI: Application Centric Infrastructure Fundamentals', titleFa: 'Cisco ACI: مبانی زیرساخت متمرکز بر برنامه', excerptEn: 'Introduction to Cisco ACI architecture: APIC controller, fabric policies, EPGs, contracts, and microsegmentation for data centers.', excerptFa: 'مقدمه‌ای بر معماری Cisco ACI: کنترلر APIC، پالیسی‌های Fabric، EPG، Contract و Microsegmentation برای مراکز داده.', readTimeEn: '16 min read', readTimeFa: '۱۶ دقیقه مطالعه', publishedAtEn: 'Oct 2025', publishedAtFa: 'مهر ۱۴۰۴', featured: 0 },
    { slug: 'cisco-multicast-pim', catSlug: 'cisco', titleEn: 'Multicast Routing with PIM on Cisco Networks', titleFa: 'مسیریابی Multicast با PIM روی شبکه‌های سیسکو', excerptEn: 'Configure IP multicast routing with PIM-SM and PIM-SSM on Cisco routers for efficient one-to-many traffic distribution.', excerptFa: 'پیکربندی مسیریابی IP Multicast با PIM-SM و PIM-SSM روی روترهای سیسکو برای توزیع کارآمد ترافیک یک به چند.', readTimeEn: '14 min read', readTimeFa: '۱۴ دقیقه مطالعه', publishedAtEn: 'Nov 2025', publishedAtFa: 'آبان ۱۴۰۴', featured: 0 },
    { slug: 'cisco-sdaccess', catSlug: 'cisco', titleEn: 'Cisco SD-Access: DNA Center and Campus Fabric', titleFa: 'Cisco SD-Access: DNA Center و Campus Fabric', excerptEn: 'Overview of Cisco SD-Access with DNA Center: fabric provisioning, policy segmentation, assurance, and automated network management.', excerptFa: 'مرور Cisco SD-Access با DNA Center: Provisioning Fabric، تقسیم‌بندی پالیسی، Assurance و مدیریت خودکار شبکه.', readTimeEn: '14 min read', readTimeFa: '۱۴ دقیقه مطالعه', publishedAtEn: 'Nov 2025', publishedAtFa: 'آبان ۱۴۰۴', featured: 0 },
    { slug: 'vmware-vsan-configuration', catSlug: 'vmware', titleEn: 'VMware vSAN: Hyper-Converged Storage Configuration', titleFa: 'VMware vSAN: پیکربندی ذخیره‌سازی Hyper-Converged', excerptEn: 'Configure VMware vSAN for hyper-converged storage: disk groups, policies, stretched clusters, and deduplication/compression.', excerptFa: 'پیکربندی VMware vSAN برای ذخیره‌سازی Hyper-Converged: Disk Group، پالیسی، Stretched Cluster و Deduplication/Compression.', readTimeEn: '16 min read', readTimeFa: '۱۶ دقیقه مطالعه', publishedAtEn: 'Sep 2025', publishedAtFa: 'شهریور ۱۴۰۴', featured: 0 },
    { slug: 'vcenter-upgrade-guide', catSlug: 'vmware', titleEn: 'vCenter Server Upgrade: Step-by-Step Migration Guide', titleFa: 'ارتقاء vCenter Server: راهنمای مهاجرت گام به گام', excerptEn: 'Upgrade vCenter Server from v6.x to v8: pre-upgrade checks, VCSA deployment, migration wizard, and post-upgrade validation.', excerptFa: 'ارتقاء vCenter Server از v6.x به v8: بررسی‌های پیش از ارتقاء، استقرار VCSA، Wizard مهاجرت و اعتبارسنجی پس از ارتقاء.', readTimeEn: '13 min read', readTimeFa: '۱۳ دقیقه مطالعه', publishedAtEn: 'Oct 2025', publishedAtFa: 'مهر ۱۴۰۴', featured: 0 },
    { slug: 'nsx-t-networking-basics', catSlug: 'vmware', titleEn: 'VMware NSX-T: Software-Defined Networking Fundamentals', titleFa: 'VMware NSX-T: مبانی شبکه نرم‌افزاری', excerptEn: 'Get started with VMware NSX-T: transport zones, segments, tier-0/tier-1 gateways, distributed firewall, and NAT configuration.', excerptFa: 'شروع با VMware NSX-T: Transport Zone، Segment، Gateway Tier-0/Tier-1، فایروال توزیع‌شده و پیکربندی NAT.', readTimeEn: '18 min read', readTimeFa: '۱۸ دقیقه مطالعه', publishedAtEn: 'Oct 2025', publishedAtFa: 'مهر ۱۴۰۴', featured: 0 },
    { slug: 'esxi-performance-tuning', catSlug: 'vmware', titleEn: 'ESXi Host Performance Tuning for Production Workloads', titleFa: 'تنظیم عملکرد Host ESXi برای بارکارهای تولیدی', excerptEn: 'Optimize ESXi hosts for maximum VM performance: NUMA topology, CPU scheduling, memory ballooning, storage I/O, and network tuning.', excerptFa: 'بهینه‌سازی Host های ESXi برای حداکثر عملکرد VM: توپولوژی NUMA، زمان‌بندی CPU، Ballooning حافظه، I/O ذخیره‌سازی و تنظیم شبکه.', readTimeEn: '15 min read', readTimeFa: '۱۵ دقیقه مطالعه', publishedAtEn: 'Nov 2025', publishedAtFa: 'آبان ۱۴۰۴', featured: 0 },
    { slug: 'proxmox-terraform-provider', catSlug: 'proxmox', titleEn: 'Automating Proxmox VE with Terraform', titleFa: 'خودکارسازی Proxmox VE با Terraform', excerptEn: 'Use the Terraform Proxmox provider to provision VMs, containers, and storage as code with declarative infrastructure management.', excerptFa: 'استفاده از Provider Terraform Proxmox برای Provision VM، کانتینر و ذخیره‌سازی به صورت کد با مدیریت زیرساخت اعلانی.', readTimeEn: '13 min read', readTimeFa: '۱۳ دقیقه مطالعه', publishedAtEn: 'Sep 2025', publishedAtFa: 'شهریور ۱۴۰۴', featured: 0 },
    { slug: 'proxmox-lxc-containers', catSlug: 'proxmox', titleEn: 'LXC Containers in Proxmox VE: Best Practices', titleFa: 'کانتینرهای LXC در Proxmox VE: بهترین شیوه‌ها', excerptEn: 'Manage LXC containers in Proxmox VE: templates, networking, resource limits, privilege settings, and production-grade configurations.', excerptFa: 'مدیریت کانتینرهای LXC در Proxmox VE: Template، شبکه‌بندی، محدودیت منابع، تنظیمات امتیاز و پیکربندی‌های سطح تولیدی.', readTimeEn: '11 min read', readTimeFa: '۱۱ دقیقه مطالعه', publishedAtEn: 'Oct 2025', publishedAtFa: 'مهر ۱۴۰۴', featured: 0 },
    { slug: 'proxmox-gpu-passthrough', catSlug: 'proxmox', titleEn: 'GPU Passthrough in Proxmox VE: IOMMU and VFIO Setup', titleFa: 'GPU Passthrough در Proxmox VE: راه‌اندازی IOMMU و VFIO', excerptEn: 'Configure GPU passthrough in Proxmox VE using IOMMU and VFIO for AI/ML workloads, gaming VMs, and CUDA-accelerated tasks.', excerptFa: 'پیکربندی GPU Passthrough در Proxmox VE با IOMMU و VFIO برای بارکارهای AI/ML، VM های بازی و وظایف CUDA-accelerated.', readTimeEn: '16 min read', readTimeFa: '۱۶ دقیقه مطالعه', publishedAtEn: 'Nov 2025', publishedAtFa: 'آبان ۱۴۰۴', featured: 0 },
    { slug: 'netflow-sflow-traffic-analysis', catSlug: 'monitoring', titleEn: 'NetFlow and sFlow Traffic Analysis for Network Visibility', titleFa: 'تحلیل ترافیک NetFlow و sFlow برای دید شبکه', excerptEn: 'Collect and analyze NetFlow/sFlow data using nfdump, ntopng, or Elastic Stack for bandwidth accounting and anomaly detection.', excerptFa: 'جمع‌آوری و تحلیل داده‌های NetFlow/sFlow با nfdump، ntopng یا Elastic Stack برای حسابداری پهنای باند و تشخیص ناهنجاری.', readTimeEn: '12 min read', readTimeFa: '۱۲ دقیقه مطالعه', publishedAtEn: 'Sep 2025', publishedAtFa: 'شهریور ۱۴۰۴', featured: 0 },
    { slug: 'alertmanager-routing-rules', catSlug: 'monitoring', titleEn: 'Prometheus Alertmanager: Advanced Routing and Silencing', titleFa: 'Prometheus Alertmanager: مسیریابی و Silencing پیشرفته', excerptEn: 'Configure Alertmanager routing trees, inhibition rules, silence schedules, and multi-channel notification for on-call teams.', excerptFa: 'پیکربندی درخت مسیریابی Alertmanager، قوانین Inhibition، برنامه‌های Silence و اطلاع‌رسانی چند کانالی برای تیم‌های On-call.', readTimeEn: '10 min read', readTimeFa: '۱۰ دقیقه مطالعه', publishedAtEn: 'Oct 2025', publishedAtFa: 'مهر ۱۴۰۴', featured: 0 },
    { slug: 'uptime-kuma-monitoring', catSlug: 'monitoring', titleEn: 'Uptime Kuma: Self-Hosted Status Page and Monitoring', titleFa: 'Uptime Kuma: صفحه Status و پایش Self-Hosted', excerptEn: 'Deploy Uptime Kuma for self-hosted uptime monitoring with HTTP, TCP, DNS, and certificate checks plus public status pages.', excerptFa: 'استقرار Uptime Kuma برای پایش Uptime Self-Hosted با بررسی HTTP، TCP، DNS و گواهی به علاوه صفحات Status عمومی.', readTimeEn: '8 min read', readTimeFa: '۸ دقیقه مطالعه', publishedAtEn: 'Oct 2025', publishedAtFa: 'مهر ۱۴۰۴', featured: 0 },
    { slug: 'grafana-loki-log-aggregation', catSlug: 'monitoring', titleEn: 'Grafana Loki: Log Aggregation for Infrastructure', titleFa: 'Grafana Loki: تجمیع لاگ برای زیرساخت', excerptEn: 'Deploy Grafana Loki with Promtail for log aggregation: label-based querying, LogQL, alerting, and integration with Grafana dashboards.', excerptFa: 'استقرار Grafana Loki با Promtail برای تجمیع لاگ: پرس‌وجوی مبتنی بر Label، LogQL، هشدار و یکپارچه‌سازی با داشبوردهای Grafana.', readTimeEn: '13 min read', readTimeFa: '۱۳ دقیقه مطالعه', publishedAtEn: 'Nov 2025', publishedAtFa: 'آبان ۱۴۰۴', featured: 0 },
    { slug: 'prtg-network-monitoring', catSlug: 'monitoring', titleEn: 'PRTG Network Monitor: Enterprise Monitoring Setup', titleFa: 'PRTG Network Monitor: راه‌اندازی پایش سازمانی', excerptEn: 'Configure PRTG for enterprise network monitoring: auto-discovery, SNMP sensors, custom scripts, maps, and alerting channels.', excerptFa: 'پیکربندی PRTG برای پایش شبکه سازمانی: Auto-Discovery، Sensor های SNMP، اسکریپت‌های اختصاصی، Map و کانال‌های هشدار.', readTimeEn: '11 min read', readTimeFa: '۱۱ دقیقه مطالعه', publishedAtEn: 'Nov 2025', publishedAtFa: 'آبان ۱۴۰۴', featured: 0 },
    { slug: 'terraform-reusable-modules', catSlug: 'automation', titleEn: 'Building Reusable Terraform Modules for Infrastructure', titleFa: 'ساخت ماژول‌های Terraform قابل استفاده مجدد برای زیرساخت', excerptEn: 'Design and publish reusable Terraform modules with input variables, output values, and version pinning for team-wide infrastructure sharing.', excerptFa: 'طراحی و انتشار ماژول‌های Terraform قابل استفاده مجدد با متغیرهای ورودی، مقادیر خروجی و Pin کردن نسخه برای اشتراک زیرساخت در تیم.', readTimeEn: '14 min read', readTimeFa: '۱۴ دقیقه مطالعه', publishedAtEn: 'Sep 2025', publishedAtFa: 'شهریور ۱۴۰۴', featured: 0 },
    { slug: 'saltstack-infrastructure-automation', catSlug: 'automation', titleEn: 'SaltStack for Infrastructure Automation and Configuration', titleFa: 'SaltStack برای خودکارسازی و پیکربندی زیرساخت', excerptEn: 'Deploy SaltStack for event-driven infrastructure automation: states, pillars, grains, reactors, and orchestration runners.', excerptFa: 'استقرار SaltStack برای خودکارسازی زیرساخت مبتنی بر رویداد: State، Pillar، Grain، Reactor و Runner های Orchestration.', readTimeEn: '15 min read', readTimeFa: '۱۵ دقیقه مطالعه', publishedAtEn: 'Oct 2025', publishedAtFa: 'مهر ۱۴۰۴', featured: 0 },
    { slug: 'puppet-configuration-management', catSlug: 'automation', titleEn: 'Puppet for Configuration Management at Scale', titleFa: 'Puppet برای مدیریت پیکربندی در مقیاس بزرگ', excerptEn: 'Implement Puppet for declarative configuration management: manifests, modules, Hiera, environments, and compliance enforcement.', excerptFa: 'پیاده‌سازی Puppet برای مدیریت پیکربندی اعلانی: Manifest، ماژول، Hiera، محیط‌ها و اجرای انطباق.', readTimeEn: '13 min read', readTimeFa: '۱۳ دقیقه مطالعه', publishedAtEn: 'Oct 2025', publishedAtFa: 'مهر ۱۴۰۴', featured: 0 },
    { slug: 'jenkins-cicd-infrastructure', catSlug: 'automation', titleEn: 'Jenkins CI/CD for Infrastructure Pipelines', titleFa: 'Jenkins CI/CD برای پایپلاین‌های زیرساخت', excerptEn: 'Build Jenkins pipelines for infrastructure automation: Terraform plan/apply, Ansible runs, testing stages, and approval gates.', excerptFa: 'ساخت پایپلاین‌های Jenkins برای خودکارسازی زیرساخت: Plan/Apply Terraform، اجرای Ansible، مراحل آزمایش و دروازه‌های تأیید.', readTimeEn: '15 min read', readTimeFa: '۱۵ دقیقه مطالعه', publishedAtEn: 'Nov 2025', publishedAtFa: 'آبان ۱۴۰۴', featured: 0 },
    { slug: 'automated-network-testing', catSlug: 'automation', titleEn: 'Automated Network Testing with pytest and Nornir', titleFa: 'آزمایش خودکار شبکه با pytest و Nornir', excerptEn: 'Write automated network tests using pytest and Nornir: connectivity checks, configuration validation, and regression testing pipelines.', excerptFa: 'نوشتن آزمایش‌های خودکار شبکه با pytest و Nornir: بررسی اتصال، اعتبارسنجی پیکربندی و پایپلاین‌های آزمایش رگرسیون.', readTimeEn: '12 min read', readTimeFa: '۱۲ دقیقه مطالعه', publishedAtEn: 'Nov 2025', publishedAtFa: 'آبان ۱۴۰۴', featured: 0 },
    { slug: 'nornir-network-automation', catSlug: 'automation', titleEn: 'Nornir: Python Framework for Network Automation', titleFa: 'Nornir: فریمورک Python برای خودکارسازی شبکه', excerptEn: 'Use Nornir with Netmiko and NAPALM plugins for parallel network automation: inventory management, task plugins, and result processing.', excerptFa: 'استفاده از Nornir با Plugin های Netmiko و NAPALM برای خودکارسازی موازی شبکه: مدیریت Inventory، Plugin های Task و پردازش نتایج.', readTimeEn: '13 min read', readTimeFa: '۱۳ دقیقه مطالعه', publishedAtEn: 'Nov 2025', publishedAtFa: 'آبان ۱۴۰۴', featured: 0 },
    { slug: 'zero-downtime-migration', catSlug: 'automation', titleEn: 'Zero-Downtime Infrastructure Migration Strategies', titleFa: 'استراتژی‌های مهاجرت زیرساخت بدون Downtime', excerptEn: 'Plan and execute zero-downtime migrations: blue-green deployments, traffic cutover strategies, rollback plans, and validation steps.', excerptFa: 'برنامه‌ریزی و اجرای مهاجرت بدون Downtime: استقرارهای Blue-Green، استراتژی‌های Cutover ترافیک، برنامه‌های Rollback و مراحل اعتبارسنجی.', readTimeEn: '14 min read', readTimeFa: '۱۴ دقیقه مطالعه', publishedAtEn: 'Dec 2025', publishedAtFa: 'آذر ۱۴۰۴', featured: 0 },
    { slug: 'helm-charts-kubernetes', catSlug: 'devops', titleEn: 'Helm Charts: Packaging Kubernetes Applications', titleFa: 'Helm Charts: بسته‌بندی برنامه‌های Kubernetes', excerptEn: 'Create, publish, and manage Helm charts for Kubernetes: templates, values files, hooks, chart dependencies, and private repositories.', excerptFa: 'ایجاد، انتشار و مدیریت Helm Chart برای Kubernetes: Template، فایل‌های Values، Hook، وابستگی‌های Chart و مخازن خصوصی.', readTimeEn: '14 min read', readTimeFa: '۱۴ دقیقه مطالعه', publishedAtEn: 'Sep 2025', publishedAtFa: 'شهریور ۱۴۰۴', featured: 0 },
    { slug: 'argocd-gitops-deployment', catSlug: 'devops', titleEn: 'ArgoCD: GitOps Continuous Delivery for Kubernetes', titleFa: 'ArgoCD: تحویل مستمر GitOps برای Kubernetes', excerptEn: 'Deploy and manage applications on Kubernetes using ArgoCD: App of Apps pattern, sync policies, RBAC, and multi-cluster management.', excerptFa: 'استقرار و مدیریت برنامه‌ها روی Kubernetes با ArgoCD: الگوی App of Apps، پالیسی‌های Sync، RBAC و مدیریت چند کلاستری.', readTimeEn: '16 min read', readTimeFa: '۱۶ دقیقه مطالعه', publishedAtEn: 'Oct 2025', publishedAtFa: 'مهر ۱۴۰۴', featured: 0 },
    { slug: 'docker-compose-production', catSlug: 'devops', titleEn: 'Docker Compose for Production: Best Practices', titleFa: 'Docker Compose برای محیط تولیدی: بهترین شیوه‌ها', excerptEn: 'Use Docker Compose in production with health checks, resource limits, secrets management, logging drivers, and rolling updates.', excerptFa: 'استفاده از Docker Compose در تولید با Health Check، محدودیت منابع، مدیریت Secret، Driver های لاگ‌گیری و به‌روزرسانی‌های Rolling.', readTimeEn: '12 min read', readTimeFa: '۱۲ دقیقه مطالعه', publishedAtEn: 'Oct 2025', publishedAtFa: 'مهر ۱۴۰۴', featured: 0 },
    { slug: 'custom-prometheus-exporters', catSlug: 'devops', titleEn: 'Writing Custom Prometheus Exporters in Python and Go', titleFa: 'نوشتن Prometheus Exporter اختصاصی با Python و Go', excerptEn: 'Build custom Prometheus exporters to expose business metrics, proprietary systems, and internal APIs for monitoring and alerting.', excerptFa: 'ساخت Prometheus Exporter اختصاصی برای نمایش متریک‌های کسب و کار، سیستم‌های اختصاصی و API های داخلی برای پایش و هشدار.', readTimeEn: '14 min read', readTimeFa: '۱۴ دقیقه مطالعه', publishedAtEn: 'Nov 2025', publishedAtFa: 'آبان ۱۴۰۴', featured: 0 },
    { slug: 'hashicorp-vault-secrets', catSlug: 'devops', titleEn: 'HashiCorp Vault: Secrets Management for Infrastructure', titleFa: 'HashiCorp Vault: مدیریت Secret برای زیرساخت', excerptEn: 'Deploy and use HashiCorp Vault for dynamic secrets, PKI, database credentials, and Kubernetes integration in production.', excerptFa: 'استقرار و استفاده از HashiCorp Vault برای Secret های Dynamic، PKI، Credential های پایگاه داده و یکپارچه‌سازی Kubernetes در تولید.', readTimeEn: '17 min read', readTimeFa: '۱۷ دقیقه مطالعه', publishedAtEn: 'Nov 2025', publishedAtFa: 'آبان ۱۴۰۴', featured: 0 },
    { slug: 'istio-service-mesh', catSlug: 'devops', titleEn: 'Istio Service Mesh: Traffic Management and mTLS', titleFa: 'Istio Service Mesh: مدیریت ترافیک و mTLS', excerptEn: 'Deploy Istio service mesh on Kubernetes: mutual TLS, traffic shifting, circuit breaking, observability, and access policies.', excerptFa: 'استقرار Istio Service Mesh روی Kubernetes: TLS متقابل، جابجایی ترافیک، Circuit Breaking، مشاهده‌پذیری و پالیسی‌های دسترسی.', readTimeEn: '18 min read', readTimeFa: '۱۸ دقیقه مطالعه', publishedAtEn: 'Dec 2025', publishedAtFa: 'آذر ۱۴۰۴', featured: 0 },
    { slug: 'github-actions-infrastructure', catSlug: 'devops', titleEn: 'GitHub Actions for Infrastructure Automation', titleFa: 'GitHub Actions برای خودکارسازی زیرساخت', excerptEn: 'Build GitHub Actions workflows for infrastructure: Terraform plans on PRs, automated testing, environment deployments, and rollback strategies.', excerptFa: 'ساخت Workflow های GitHub Actions برای زیرساخت: Plan های Terraform روی PR، آزمایش خودکار، استقرار محیط و استراتژی‌های Rollback.', readTimeEn: '13 min read', readTimeFa: '۱۳ دقیقه مطالعه', publishedAtEn: 'Dec 2025', publishedAtFa: 'آذر ۱۴۰۴', featured: 0 },
    { slug: 'windows-dhcp-dns-enterprise', catSlug: 'windows-server', titleEn: 'Windows Server DHCP and DNS: Enterprise Configuration', titleFa: 'DHCP و DNS Windows Server: پیکربندی سازمانی', excerptEn: 'Configure Windows Server DHCP with scopes, reservations, failover clustering, and DNS with zones, forwarders, and DNSSEC.', excerptFa: 'پیکربندی DHCP Windows Server با Scope، Reservation، کلاستر Failover و DNS با Zone، Forwarder و DNSSEC.', readTimeEn: '12 min read', readTimeFa: '۱۲ دقیقه مطالعه', publishedAtEn: 'Sep 2025', publishedAtFa: 'شهریور ۱۴۰۴', featured: 0 },
    { slug: 'windows-file-server-dfs', catSlug: 'windows-server', titleEn: 'Windows File Server with DFS: Distributed File System Setup', titleFa: 'File Server ویندوز با DFS: راه‌اندازی سیستم فایل توزیع‌شده', excerptEn: 'Configure Windows DFS Namespaces and DFS Replication for distributed file sharing, redundancy, and branch office file access.', excerptFa: 'پیکربندی DFS Namespace و DFS Replication ویندوز برای اشتراک‌گذاری فایل توزیع‌شده، افزونگی و دسترسی به فایل در شعبات.', readTimeEn: '11 min read', readTimeFa: '۱۱ دقیقه مطالعه', publishedAtEn: 'Oct 2025', publishedAtFa: 'مهر ۱۴۰۴', featured: 0 },
    { slug: 'hyper-v-cluster-setup', catSlug: 'windows-server', titleEn: 'Hyper-V Failover Cluster: High Availability VMs', titleFa: 'کلاستر Failover Hyper-V: VM های با دسترس‌پذیری بالا', excerptEn: 'Build a Hyper-V Failover Cluster with Cluster Shared Volumes, Live Migration, and HA virtual machines on Windows Server.', excerptFa: 'ساخت کلاستر Failover Hyper-V با Cluster Shared Volume، Live Migration و VM های HA روی Windows Server.', readTimeEn: '15 min read', readTimeFa: '۱۵ دقیقه مطالعه', publishedAtEn: 'Nov 2025', publishedAtFa: 'آبان ۱۴۰۴', featured: 0 },
    { slug: 'azure-ad-connect-hybrid', catSlug: 'windows-server', titleEn: 'Azure AD Connect: Hybrid Identity Configuration', titleFa: 'Azure AD Connect: پیکربندی هویت ترکیبی', excerptEn: 'Configure Azure AD Connect for hybrid identity: password hash sync, pass-through authentication, SSO, and conditional access policies.', excerptFa: 'پیکربندی Azure AD Connect برای هویت ترکیبی: همگام‌سازی Hash رمز، احراز هویت Pass-through، SSO و پالیسی‌های Conditional Access.', readTimeEn: '14 min read', readTimeFa: '۱۴ دقیقه مطالعه', publishedAtEn: 'Dec 2025', publishedAtFa: 'آذر ۱۴۰۴', featured: 0 },
    { slug: 'ipv6-enterprise-deployment', catSlug: 'cisco', titleEn: 'IPv6 Deployment for Enterprise Networks', titleFa: 'استقرار IPv6 برای شبکه‌های سازمانی', excerptEn: 'Plan and deploy IPv6 in enterprise environments: addressing plans, dual-stack, NDP, DHCPv6, and IPv6 security considerations.', excerptFa: 'برنامه‌ریزی و استقرار IPv6 در محیط‌های سازمانی: برنامه آدرس‌دهی، Dual-Stack، NDP، DHCPv6 و ملاحظات امنیتی IPv6.', readTimeEn: '13 min read', readTimeFa: '۱۳ دقیقه مطالعه', publishedAtEn: 'Sep 2025', publishedAtFa: 'شهریور ۱۴۰۴', featured: 0 },
    { slug: '8021x-nac-wired-wireless', catSlug: 'security', titleEn: '802.1X NAC for Wired and Wireless Authentication', titleFa: 'NAC 802.1X برای احراز هویت سیمی و بی‌سیم', excerptEn: 'Implement 802.1X Network Access Control with FreeRADIUS for wired switch ports and wireless SSIDs with EAP-TLS and PEAP.', excerptFa: 'پیاده‌سازی کنترل دسترسی شبکه 802.1X با FreeRADIUS برای پورت‌های سوئیچ سیمی و SSID های بی‌سیم با EAP-TLS و PEAP.', readTimeEn: '14 min read', readTimeFa: '۱۴ دقیقه مطالعه', publishedAtEn: 'Oct 2025', publishedAtFa: 'مهر ۱۴۰۴', featured: 0 },
    { slug: 'wifi6-enterprise-design', catSlug: 'monitoring', titleEn: 'Wi-Fi 6 Enterprise Design: SSID, Roaming, and RF Planning', titleFa: 'طراحی سازمانی Wi-Fi 6: SSID، Roaming و برنامه‌ریزی RF', excerptEn: 'Design a Wi-Fi 6 enterprise network: access point placement, channel planning, BSS coloring, WPA3, and fast BSS transition.', excerptFa: 'طراحی شبکه سازمانی Wi-Fi 6: قرارگیری Access Point، برنامه‌ریزی کانال، BSS Coloring، WPA3 و Fast BSS Transition.', readTimeEn: '12 min read', readTimeFa: '۱۲ دقیقه مطالعه', publishedAtEn: 'Oct 2025', publishedAtFa: 'مهر ۱۴۰۴', featured: 0 },
    { slug: 'mpls-l3vpn-service-provider', catSlug: 'cisco', titleEn: 'MPLS L3VPN: Service Provider VPN Architecture', titleFa: 'MPLS L3VPN: معماری VPN ارائه‌دهنده سرویس', excerptEn: 'Understand and configure MPLS L3VPN with PE-CE routing, VRFs, route distinguishers, and route targets on Cisco IOS-XR.', excerptFa: 'درک و پیکربندی MPLS L3VPN با مسیریابی PE-CE، VRF، Route Distinguisher و Route Target روی Cisco IOS-XR.', readTimeEn: '17 min read', readTimeFa: '۱۷ دقیقه مطالعه', publishedAtEn: 'Nov 2025', publishedAtFa: 'آبان ۱۴۰۴', featured: 0 },
    { slug: 'nat-pat-deep-dive', catSlug: 'mikrotik', titleEn: 'NAT and PAT: Deep Dive into Address Translation', titleFa: 'NAT و PAT: بررسی عمیق ترجمه آدرس', excerptEn: 'Understand NAT/PAT internals, configure source NAT, destination NAT, 1:1 NAT, and hairpin NAT on MikroTik and Linux.', excerptFa: 'درک داخلی NAT/PAT، پیکربندی Source NAT، Destination NAT، NAT 1:1 و Hairpin NAT روی MikroTik و لینوکس.', readTimeEn: '11 min read', readTimeFa: '۱۱ دقیقه مطالعه', publishedAtEn: 'Nov 2025', publishedAtFa: 'آبان ۱۴۰۴', featured: 0 },
    { slug: 'network-access-control-design', catSlug: 'security', titleEn: 'Network Access Control: Design and Implementation', titleFa: 'کنترل دسترسی شبکه: طراحی و پیاده‌سازی', excerptEn: 'Design and implement a comprehensive NAC solution: endpoint compliance, guest access, posture assessment, and quarantine VLANs.', excerptFa: 'طراحی و پیاده‌سازی راه‌حل جامع NAC: انطباق endpoint، دسترسی مهمان، ارزیابی وضعیت و VLAN های قرنطینه.', readTimeEn: '15 min read', readTimeFa: '۱۵ دقیقه مطالعه', publishedAtEn: 'Dec 2025', publishedAtFa: 'آذر ۱۴۰۴', featured: 0 },
    { slug: 'dns-security-dnssec', catSlug: 'security', titleEn: 'DNS Security: DNSSEC, DoH, and DNS Filtering', titleFa: 'امنیت DNS: DNSSEC، DoH و فیلترینگ DNS', excerptEn: 'Secure your DNS infrastructure with DNSSEC signing, DNS-over-HTTPS, DNS-over-TLS, and RPZ-based DNS filtering for threat blocking.', excerptFa: 'ایمن‌سازی زیرساخت DNS با امضای DNSSEC، DNS-over-HTTPS، DNS-over-TLS و فیلترینگ DNS مبتنی بر RPZ برای مسدود کردن تهدید.', readTimeEn: '12 min read', readTimeFa: '۱۲ دقیقه مطالعه', publishedAtEn: 'Dec 2025', publishedAtFa: 'آذر ۱۴۰۴', featured: 0 },
    { slug: 'container-security-best-practices', catSlug: 'devops', titleEn: 'Container Security Best Practices for Production', titleFa: 'بهترین شیوه‌های امنیت کانتینر برای محیط تولیدی', excerptEn: 'Secure Docker and Kubernetes deployments: image scanning, non-root containers, seccomp, AppArmor, network policies, and runtime security.', excerptFa: 'ایمن‌سازی استقرارهای Docker و Kubernetes: اسکن Image، کانتینرهای non-root، seccomp، AppArmor، پالیسی‌های شبکه و امنیت Runtime.', readTimeEn: '16 min read', readTimeFa: '۱۶ دقیقه مطالعه', publishedAtEn: 'Jan 2026', publishedAtFa: 'دی ۱۴۰۴', featured: 0 },
    { slug: 'network-troubleshooting-methodology', catSlug: 'monitoring', titleEn: 'Network Troubleshooting Methodology: OSI Layer Approach', titleFa: 'روش‌شناسی عیب‌یابی شبکه: رویکرد لایه OSI', excerptEn: 'Apply a systematic OSI-layer troubleshooting methodology using Wireshark, ping, traceroute, tcpdump, and protocol analyzers.', excerptFa: 'اعمال روش‌شناسی عیب‌یابی سیستماتیک لایه OSI با استفاده از Wireshark، ping، traceroute، tcpdump و آنالایزرهای پروتکل.', readTimeEn: '13 min read', readTimeFa: '۱۳ دقیقه مطالعه', publishedAtEn: 'Jan 2026', publishedAtFa: 'دی ۱۴۰۴', featured: 0 },
    { slug: 'cisco-catalyst-vlan-setup', catSlug: 'cisco', titleEn: 'Cisco Catalyst Switch: Complete VLAN and Trunking Setup', titleFa: 'سوئیچ Cisco Catalyst: راه‌اندازی کامل VLAN و Trunking', excerptEn: 'Configure VLANs, trunks, access ports, VTP, and inter-VLAN routing on Cisco Catalyst switches for enterprise LAN deployments.', excerptFa: 'پیکربندی VLAN، Trunk، پورت دسترسی، VTP و مسیریابی بین VLAN روی سوئیچ‌های Cisco Catalyst برای استقرار LAN سازمانی.', readTimeEn: '12 min read', readTimeFa: '۱۲ دقیقه مطالعه', publishedAtEn: 'Jan 2026', publishedAtFa: 'دی ۱۴۰۴', featured: 0 },
    { slug: 'infrastructure-as-code-principles', catSlug: 'devops', titleEn: 'Infrastructure as Code: Principles, Tools, and Workflows', titleFa: 'زیرساخت به عنوان کد: اصول، ابزارها و جریان‌های کاری', excerptEn: 'Master IaC principles with Terraform, Ansible, and Pulumi: idempotency, state management, versioning, and team collaboration workflows.', excerptFa: 'تسلط بر اصول IaC با Terraform، Ansible و Pulumi: Idempotency، مدیریت State، نسخه‌بندی و جریان‌های کاری همکاری تیمی.', readTimeEn: '15 min read', readTimeFa: '۱۵ دقیقه مطالعه', publishedAtEn: 'Jan 2026', publishedAtFa: 'دی ۱۴۰۴', featured: 0 },
  ]
  for (const p of blogPostsData) {
    const cat = getCatId.get(p.catSlug) as { id: number } | undefined
    const bc = BLOG_CONTENT[p.slug]
    insPost.run(p.slug, p.titleEn, p.titleFa, p.excerptEn, p.excerptFa, bc?.contentEn ?? null, bc?.contentFa ?? null, cat?.id ?? null, p.readTimeEn, p.readTimeFa, p.publishedAtEn, p.publishedAtFa, 'published', p.featured)
  }

  // ── Media files (seed all SVGs) ──────────────────────────────────────────
  const insMedia = db.prepare(`
    INSERT OR IGNORE INTO media_files (filename, original_name, mime_type, size, url, folder, alt)
    VALUES (?,?,?,?,?,?,?)
  `)

  // Tech logos (12)
  const techLogos: [string,string,string][] = [
    ['cisco.svg','Cisco','logos'],['mikrotik.svg','MikroTik','logos'],['vmware.svg','VMware','logos'],
    ['fortinet.svg','Fortinet','logos'],['proxmox.svg','Proxmox','logos'],['zabbix.svg','Zabbix','logos'],
    ['ansible.svg','Ansible','logos'],['linux.svg','Linux','logos'],['docker.svg','Docker','logos'],
    ['kubernetes.svg','Kubernetes','logos'],['windows-server.svg','Windows Server','logos'],['grafana.svg','Grafana','logos'],
  ]
  // General org images (20)
  const orgLogos: [string,string,string][] = [
    ['network-co.svg','Network Co','general'],['datacenter.svg','DataCenter','general'],
    ['enterprise.svg','Enterprise','general'],['security-firm.svg','SecureCo','general'],
    ['isp-provider.svg','ISP Provider','general'],['hospital.svg','Hospital','general'],
    ['restaurant-chain.svg','Restaurant Chain','general'],['industrial.svg','Industrial','general'],
    ['government.svg','Government','general'],['university.svg','University','general'],
    ['office-building.svg','Office Building','general'],['warehouse.svg','Warehouse','general'],
    ['telecom-tower.svg','Telecom Tower','general'],['data-room.svg','Data Room','general'],
    ['control-center.svg','Control Center','general'],['smart-city.svg','Smart City','general'],
    ['factory.svg','Factory','general'],['bank.svg','Bank','general'],
    ['airport.svg','Airport','general'],['stadium.svg','Stadium','general'],
  ]
  // Icons (20)
  const iconFiles: [string,string,string][] = [
    ['router.svg','Router Icon','icons'],['switch.svg','Switch Icon','icons'],
    ['firewall.svg','Firewall Icon','icons'],['server-rack.svg','Server Rack Icon','icons'],
    ['cloud.svg','Cloud Icon','icons'],['vpn-lock.svg','VPN Lock Icon','icons'],
    ['monitoring.svg','Monitoring Icon','icons'],['backup.svg','Backup Icon','icons'],
    ['network-map.svg','Network Map Icon','icons'],['wifi.svg','WiFi Icon','icons'],
    ['database.svg','Database Icon','icons'],['shield-check.svg','Shield Check Icon','icons'],
    ['terminal-cmd.svg','Terminal Icon','icons'],['automation.svg','Automation Icon','icons'],
    ['analytics.svg','Analytics Icon','icons'],['deploy.svg','Deploy Icon','icons'],
    ['cluster.svg','Cluster Icon','icons'],['api-nodes.svg','API Nodes Icon','icons'],
    ['voip.svg','VoIP Icon','icons'],['email-server.svg','Email Server Icon','icons'],
  ]
  // Avatars (20)
  const avatarFiles: [string,string,string][] = Array.from({ length: 20 }, (_, i) =>
    [`avatar-${i+1}.svg`, `Avatar ${i+1}`, 'avatars']
  )
  // Projects (20)
  const projectFiles: [string,string,string][] = Array.from({ length: 20 }, (_, i) =>
    [`project-${i+1}.svg`, `Project Mockup ${i+1}`, 'projects']
  )
  // Clients (20)
  const clientFiles: [string,string,string][] = Array.from({ length: 20 }, (_, i) =>
    [`client-${i+1}.svg`, `Client Logo ${i+1}`, 'clients']
  )

  const allMedia = [...techLogos, ...orgLogos, ...iconFiles, ...avatarFiles, ...projectFiles, ...clientFiles]
  for (const [file, name, folder] of allMedia) {
    insMedia.run(file, name, 'image/svg+xml', 1024, `/uploads/${folder}/${file}`, folder, `${name}`)
  }

  db.close()
  return { ok: true, message: 'Public content synced to database successfully' }
}
