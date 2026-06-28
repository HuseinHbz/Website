import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'data', 'habibazar.db')

export function resyncPublicContent() {
  const db = new Database(DB_PATH)

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
  db.prepare('DELETE FROM skills').run()
  const insSkill = db.prepare(`
    INSERT INTO skills (name_en, name_fa, category_en, category_fa, level, color, sort_order)
    VALUES (?,?,?,?,?,?,?)
  `)
  const skills = [
    ['Network Architecture', 'معماری شبکه', 'Networking', 'شبکه', 95, '#6366f1', 1],
    ['MikroTik RouterOS', 'میکروتیک RouterOS', 'Networking', 'شبکه', 92, '#c03030', 2],
    ['Cisco IOS/IOS-XE', 'سیسکو IOS', 'Networking', 'شبکه', 88, '#1ba0d7', 3],
    ['Fortigate / Sophos', 'فورتیگیت / سوفوس', 'Security', 'امنیت', 90, '#ee3124', 4],
    ['Network Security', 'امنیت شبکه', 'Security', 'امنیت', 88, '#ef4444', 5],
    ['VMware vSphere', 'VMware vSphere', 'Virtualization', 'مجازی‌سازی', 85, '#60b6e0', 6],
    ['Proxmox VE', 'Proxmox VE', 'Virtualization', 'مجازی‌سازی', 82, '#e57000', 7],
    ['Linux Server Admin', 'مدیریت سرور لینوکس', 'Systems', 'سیستم', 90, '#f59e0b', 8],
    ['Zabbix / Grafana', 'زابیکس / گرافانا', 'Monitoring', 'پایش', 85, '#f59e0b', 9],
    ['Infrastructure Automation', 'خودکارسازی زیرساخت', 'Automation', 'خودکارسازی', 78, '#06b6d4', 10],
    ['Veeam Backup & DR', 'Veeam پشتیبان‌گیری', 'Operations', 'عملیات', 85, '#00b336', 11],
    ['VoIP Solutions', 'راه‌حل‌های VoIP', 'Communications', 'ارتباطات', 80, '#818cf8', 12],
  ]
  for (const r of skills) insSkill.run(...r)

  // ── Certifications ──────────────────────────────────────────────────────────
  db.prepare('DELETE FROM certifications').run()
  const insCert = db.prepare(`
    INSERT INTO certifications (name_en, name_fa, issuer, color, sort_order)
    VALUES (?,?,?,?,?)
  `)
  const certs = [
    ['MikroTik MTCNA', 'میکروتیک MTCNA', 'MikroTik', '#c03030', 1],
    ['MikroTik MTCRE', 'میکروتیک MTCRE', 'MikroTik', '#c03030', 2],
    ['Fortinet NSE', 'فورتینت NSE', 'Fortinet', '#ee3124', 3],
    ['VMware VCP', 'VMware VCP', 'VMware', '#60b6e0', 4],
    ['Linux LPIC', 'لینوکس LPIC', 'Linux Professional Institute', '#f59e0b', 5],
    ['Cisco CCNA', 'سیسکو CCNA', 'Cisco', '#1ba0d7', 6],
  ]
  for (const r of certs) insCert.run(...r)

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
    INSERT INTO clients (name_en, name_fa, type_en, type_fa, is_tech_partner, sort_order)
    VALUES (?,?,?,?,?,?)
  `)
  const clientsData = [
    ['Kenzo Restaurant', 'رستوران کنزو', 'Hospitality', 'هتلداری', 0, 1],
    ['Popcorn Holding', 'هلدینگ پاپ‌کورن', 'Holding', 'هلدینگ', 0, 2],
    ['Senso Group', 'گروه سنسو', 'Food & Beverage', 'غذا و نوشیدنی', 0, 3],
    ['Industrial Co.', 'شرکت صنعتی', 'Industrial', 'صنعتی', 0, 4],
    ['Retail Chain', 'زنجیره خرده‌فروشی', 'Retail', 'خرده‌فروشی', 0, 5],
    ['Tech Startup', 'استارت‌آپ فناوری', 'Technology', 'فناوری', 0, 6],
    ['Medical Center', 'مرکز پزشکی', 'Healthcare', 'بهداشت', 0, 7],
    ['Logistics Firm', 'شرکت لجستیک', 'Logistics', 'لجستیک', 0, 8],
    ['Finance Group', 'گروه مالی', 'Finance', 'مالی', 0, 9],
    ['Education Institute', 'موسسه آموزشی', 'Education', 'آموزش', 0, 10],
    ['MikroTik', 'میکروتیک', 'Technology Partner', 'شریک فناوری', 1, 11],
    ['Cisco', 'سیسکو', 'Technology Partner', 'شریک فناوری', 1, 12],
    ['Fortigate', 'فورتی‌گیت', 'Technology Partner', 'شریک فناوری', 1, 13],
    ['VMware', 'VMware', 'Technology Partner', 'شریک فناوری', 1, 14],
    ['Ubiquiti', 'Ubiquiti', 'Technology Partner', 'شریک فناوری', 1, 15],
    ['Zabbix', 'Zabbix', 'Technology Partner', 'شریک فناوری', 1, 16],
    ['Proxmox', 'Proxmox', 'Technology Partner', 'شریک فناوری', 1, 17],
    ['Sophos', 'Sophos', 'Technology Partner', 'شریک فناوری', 1, 18],
    ['Veeam', 'Veeam', 'Technology Partner', 'شریک فناوری', 1, 19],
    ['Grafana', 'Grafana', 'Technology Partner', 'شریک فناوری', 1, 20],
    ['Linux', 'لینوکس', 'Technology Partner', 'شریک فناوری', 1, 21],
    ['Ansible', 'Ansible', 'Technology Partner', 'شریک فناوری', 1, 22],
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
    INSERT OR IGNORE INTO blog_posts
      (slug, title_en, title_fa, excerpt_en, excerpt_fa, category_id, read_time_en, read_time_fa, published_at_en, published_at_fa, status, featured)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `)
  const blogPostsData = [
    { slug: 'mikrotik-ospf-multi-site', catSlug: 'mikrotik', titleEn: 'Building a Multi-Site MikroTik Network with OSPF', titleFa: 'ساخت شبکه چند سایته MikroTik با OSPF', excerptEn: 'A complete guide to designing and deploying multi-site OSPF routing with MikroTik RouterOS for enterprise branch offices.', excerptFa: 'راهنمای کامل طراحی و استقرار مسیریابی OSPF چند سایته با MikroTik RouterOS برای دفاتر شعبه سازمانی.', readTimeEn: '12 min read', readTimeFa: '۱۲ دقیقه مطالعه', publishedAtEn: 'Jan 2025', publishedAtFa: 'دی ۱۴۰۳', featured: 1 },
    { slug: 'zero-trust-fortigate', catSlug: 'security', titleEn: 'Zero-Trust Network Architecture with Fortigate', titleFa: 'معماری شبکه Zero-Trust با Fortigate', excerptEn: 'Implementing a zero-trust security model using Fortigate NGFW, SSL inspection, and micro-segmentation for enterprise environments.', excerptFa: 'پیاده‌سازی مدل امنیتی Zero-Trust با استفاده از Fortigate NGFW، بازرسی SSL و میکرو-تقسیم‌بندی برای محیط‌های سازمانی.', readTimeEn: '15 min read', readTimeFa: '۱۵ دقیقه مطالعه', publishedAtEn: 'Feb 2025', publishedAtFa: 'بهمن ۱۴۰۳', featured: 1 },
    { slug: 'proxmox-cluster-production', catSlug: 'proxmox', titleEn: 'Proxmox VE Cluster Setup for Production Workloads', titleFa: 'راه‌اندازی کلاستر Proxmox VE برای بارکارهای تولیدی', excerptEn: 'Step-by-step guide to building a 3-node Proxmox cluster with Ceph storage, HA failover, and live migration for production VMs.', excerptFa: 'راهنمای گام به گام ساخت کلاستر ۳ نودی Proxmox با ذخیره‌سازی Ceph، Failover HA و Live Migration برای VM‌های تولیدی.', readTimeEn: '18 min read', readTimeFa: '۱۸ دقیقه مطالعه', publishedAtEn: 'Mar 2025', publishedAtFa: 'اسفند ۱۴۰۳', featured: 1 },
    { slug: 'zabbix-custom-dashboards', catSlug: 'monitoring', titleEn: 'Zabbix 7.0 Advanced Monitoring: Custom Dashboards', titleFa: 'پایش پیشرفته Zabbix 7.0: داشبوردهای اختصاصی', excerptEn: 'Creating enterprise-grade Zabbix dashboards with custom metrics, triggers, and Grafana integration for infrastructure visibility.', excerptFa: 'ساخت داشبوردهای سطح سازمانی در Zabbix با متریک‌های اختصاصی، ترایگرها و یکپارچه‌سازی Grafana برای دید زیرساختی.', readTimeEn: '10 min read', readTimeFa: '۱۰ دقیقه مطالعه', publishedAtEn: 'Apr 2025', publishedAtFa: 'فروردین ۱۴۰۴', featured: 0 },
    { slug: 'ansible-network-automation', catSlug: 'automation', titleEn: 'Ansible for Network Automation: MikroTik & Cisco', titleFa: 'Ansible برای خودکارسازی شبکه: MikroTik و Cisco', excerptEn: 'Automating network device configuration with Ansible: real playbooks for MikroTik RouterOS and Cisco IOS environments.', excerptFa: 'خودکارسازی پیکربندی تجهیزات شبکه با Ansible: Playbook‌های واقعی برای MikroTik RouterOS و Cisco IOS.', readTimeEn: '14 min read', readTimeFa: '۱۴ دقیقه مطالعه', publishedAtEn: 'May 2025', publishedAtFa: 'اردیبهشت ۱۴۰۴', featured: 0 },
    { slug: 'linux-server-hardening', catSlug: 'linux', titleEn: 'Linux Server Hardening: Production Security Checklist', titleFa: 'سخت‌سازی سرور لینوکس: چک‌لیست امنیتی تولیدی', excerptEn: 'Comprehensive security hardening checklist for Linux production servers: SSH, firewall, audit, SELinux, and automated compliance.', excerptFa: 'چک‌لیست جامع سخت‌سازی امنیتی سرورهای لینوکس تولیدی: SSH، فایروال، Audit، SELinux و انطباق خودکار.', readTimeEn: '16 min read', readTimeFa: '۱۶ دقیقه مطالعه', publishedAtEn: 'Jun 2025', publishedAtFa: 'خرداد ۱۴۰۴', featured: 0 },
  ]
  for (const p of blogPostsData) {
    const cat = getCatId.get(p.catSlug) as { id: number } | undefined
    insPost.run(p.slug, p.titleEn, p.titleFa, p.excerptEn, p.excerptFa, cat?.id ?? null, p.readTimeEn, p.readTimeFa, p.publishedAtEn, p.publishedAtFa, 'published', p.featured)
  }

  db.close()
  return { ok: true, message: 'Public content synced to database successfully' }
}
