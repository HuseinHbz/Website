import Database from 'better-sqlite3'
import path from 'path'

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
      (slug, title_en, title_fa, excerpt_en, excerpt_fa, category_id, read_time_en, read_time_fa, published_at_en, published_at_fa, status, featured)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
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
  ]
  for (const p of blogPostsData) {
    const cat = getCatId.get(p.catSlug) as { id: number } | undefined
    insPost.run(p.slug, p.titleEn, p.titleFa, p.excerptEn, p.excerptFa, cat?.id ?? null, p.readTimeEn, p.readTimeFa, p.publishedAtEn, p.publishedAtFa, 'published', p.featured)
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
