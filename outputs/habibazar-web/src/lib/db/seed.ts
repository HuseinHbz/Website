import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'
import path from 'path'

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'habibazar.db')

export async function seedDatabase() {
  const sqlite = new Database(DB_PATH)

  // Super admin user
  const existingUser = sqlite.prepare('SELECT id FROM users WHERE email = ?').get('admin@habibazar.com')
  if (!existingUser) {
    const hash = await bcrypt.hash('HBZ@Admin2025!', 12)
    sqlite.prepare(`INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`)
      .run(nanoid(), 'Husein Habibazar', 'admin@habibazar.com', hash, 'super_admin')
  }

  // Site settings
  const settings = [
    ['site_name', 'Husein Habibazar', 'general'],
    ['site_tagline', 'Infrastructure Architect & Network Security Consultant', 'general'],
    ['site_url', 'https://habibazar.com', 'general'],
    ['logo_text', 'HBZ', 'branding'],
    ['logo_url', '', 'branding'],
    ['primary_color', '#6366f1', 'branding'],
    ['accent_color', '#818cf8', 'branding'],
    ['contact_email', 'husein@habibazar.com', 'contact'],
    ['contact_phone', '', 'contact'],
    ['contact_location_en', 'Tehran, Iran', 'contact'],
    ['contact_location_fa', 'تهران، ایران', 'contact'],
    ['social_linkedin', 'https://linkedin.com/in/huseinhabibazar', 'social'],
    ['social_github', '', 'social'],
    ['social_twitter', '', 'social'],
    ['smtp_host', '', 'email'],
    ['smtp_port', '587', 'email'],
    ['smtp_user', '', 'email'],
    ['smtp_pass', '', 'email'],
    ['smtp_from', 'noreply@habibazar.com', 'email'],
  ]
  const insertSetting = sqlite.prepare(`INSERT OR IGNORE INTO site_settings (key, value, "group") VALUES (?, ?, ?)`)
  for (const [k, v, g] of settings) insertSetting.run(k, v, g)

  // Hero content EN
  const heroEn = sqlite.prepare('SELECT id FROM hero_content WHERE locale = ?').get('en')
  if (!heroEn) {
    sqlite.prepare(`INSERT INTO hero_content (locale, badge, headline, headline_highlight, subheadline, cta_primary, cta_primary_href, cta_secondary, cta_secondary_href, cta_tertiary, cta_tertiary_href, stat1_label, stat1_value, stat2_label, stat2_value, stat3_label, stat3_value, stat4_label, stat4_value) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run('en', 'Available for Enterprise Projects', 'Infrastructure', 'Architect', 'Designing, Securing and Automating Modern Enterprise Infrastructure — from MikroTik to Cisco, VMware to Proxmox, Zabbix to Ansible.', 'View Projects', '/projects', 'Book Consultation', '/consultation', 'Download Resume', '/resume.pdf', 'Years Experience', '10+', 'Enterprise Projects', '50+', 'Managed Endpoints', '1000+', 'Production Deployments', '20+')
  }

  // Hero content FA
  const heroFa = sqlite.prepare('SELECT id FROM hero_content WHERE locale = ?').get('fa')
  if (!heroFa) {
    sqlite.prepare(`INSERT INTO hero_content (locale, badge, headline, headline_highlight, subheadline, cta_primary, cta_primary_href, cta_secondary, cta_secondary_href, cta_tertiary, cta_tertiary_href, stat1_label, stat1_value, stat2_label, stat2_value, stat3_label, stat3_value, stat4_label, stat4_value) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run('fa', 'آماده همکاری با سازمان‌ها', 'معمار', 'زیرساخت', 'طراحی، ایمن‌سازی و خودکارسازی زیرساخت سازمانی مدرن — از میکروتیک تا سیسکو، VMware تا Proxmox، Zabbix تا Ansible.', 'مشاهده پروژه‌ها', '/projects', 'رزرو مشاوره', '/consultation', 'دانلود رزومه', '/resume.pdf', 'سال تجربه', '+۱۰', 'پروژه سازمانی', '+۵۰', 'تجهیز مدیریت‌شده', '+۱۰۰۰', 'استقرار تولیدی', '+۲۰')
  }

  // About EN
  const aboutEn = sqlite.prepare('SELECT id FROM about_content WHERE locale = ?').get('en')
  if (!aboutEn) {
    sqlite.prepare(`INSERT INTO about_content (locale, headline, subheadline, bio, years_exp, projects_count, endpoints_count, deployments_count) VALUES (?,?,?,?,?,?,?,?)`)
      .run('en', 'Infrastructure Architect', '& Network Security Consultant', 'With over a decade of hands-on experience in enterprise infrastructure, I specialize in designing resilient, secure, and automated network environments. My expertise spans from MikroTik and Cisco routing & switching to VMware and Proxmox virtualization, Zabbix monitoring, Fortigate security, and Ansible automation. I have successfully delivered infrastructure projects for restaurants, hospitality groups, holding companies, and industrial enterprises across Iran.', '10+', '50+', '1000+', '20+')
  }

  // About FA
  const aboutFa = sqlite.prepare('SELECT id FROM about_content WHERE locale = ?').get('fa')
  if (!aboutFa) {
    sqlite.prepare(`INSERT INTO about_content (locale, headline, subheadline, bio, years_exp, projects_count, endpoints_count, deployments_count) VALUES (?,?,?,?,?,?,?,?)`)
      .run('fa', 'معمار زیرساخت', 'و مشاور امنیت شبکه', 'با بیش از یک دهه تجربه عملی در زیرساخت سازمانی، در طراحی محیط‌های شبکه مقاوم، امن و خودکار تخصص دارم. تخصص من از مسیریابی و سوئیچینگ میکروتیک و سیسکو تا مجازی‌سازی VMware و Proxmox، پایش Zabbix، امنیت Fortigate و خودکارسازی Ansible گسترش می‌یابد.', '+۱۰', '+۵۰', '+۱۰۰۰', '+۲۰')
  }

  // Timeline items
  const timelineCount = (sqlite.prepare('SELECT COUNT(*) as c FROM timeline_items').get() as { c: number }).c
  if (timelineCount === 0) {
    const items = [
      { year: '2013', title_en: 'Started in IT Support', title_fa: 'شروع در پشتیبانی IT', company_en: 'Local ISP', company_fa: 'ISP محلی', desc_en: 'Began career maintaining network infrastructure and providing technical support for small businesses.', desc_fa: 'آغاز مسیر با نگهداری زیرساخت شبکه و پشتیبانی فنی از کسب‌وکارهای کوچک.', color: '#6366f1', sort_order: 1 },
      { year: '2017', title_en: 'Network Engineer', title_fa: 'مهندس شبکه', company_en: 'Enterprise Clients', company_fa: 'مشتریان سازمانی', desc_en: 'Advanced to designing and implementing enterprise-grade networks with MikroTik and Cisco equipment.', desc_fa: 'ارتقا به طراحی و پیاده‌سازی شبکه‌های سطح سازمانی با تجهیزات میکروتیک و سیسکو.', color: '#06b6d4', sort_order: 2 },
      { year: '2019', title_en: 'Security Specialization', title_fa: 'تخصص امنیت', company_en: 'Multi-client', company_fa: 'چند مشتری', desc_en: 'Obtained Fortinet NSE certification and began implementing NGFW, VPN, and zero-trust architectures.', desc_fa: 'دریافت گواهینامه Fortinet NSE و شروع پیاده‌سازی NGFW، VPN و معماری‌های zero-trust.', color: '#ef4444', sort_order: 3 },
      { year: '2021', title_en: 'Virtualization & Cloud', title_fa: 'مجازی‌سازی و ابر', company_en: 'Enterprise Deployments', company_fa: 'استقرار سازمانی', desc_en: 'Mastered VMware vSphere and Proxmox VE for enterprise virtualization, HA clustering, and Ceph storage.', desc_fa: 'تسلط بر VMware vSphere و Proxmox VE برای مجازی‌سازی سازمانی، خوشه‌بندی HA و ذخیره‌سازی Ceph.', color: '#f59e0b', sort_order: 4 },
      { year: '2025', title_en: 'Independent Consultant', title_fa: 'مشاور مستقل', company_en: 'HBZ Consulting', company_fa: 'مشاوره HBZ', desc_en: 'Launched independent consulting practice serving restaurants, hospitality, and industrial enterprise clients.', desc_fa: 'راه‌اندازی مشاوره مستقل برای رستوران‌ها، مهمانداری و مشتریان صنعتی سازمانی.', color: '#818cf8', sort_order: 5 },
    ]
    const ins = sqlite.prepare(`INSERT INTO timeline_items (year, title_en, title_fa, company_en, company_fa, desc_en, desc_fa, color, sort_order) VALUES (?,?,?,?,?,?,?,?,?)`)
    for (const i of items) ins.run(i.year, i.title_en, i.title_fa, i.company_en, i.company_fa, i.desc_en, i.desc_fa, i.color, i.sort_order)
  }

  // Skills
  const skillsCount = (sqlite.prepare('SELECT COUNT(*) as c FROM skills').get() as { c: number }).c
  if (skillsCount === 0) {
    const sk = [
      ['MikroTik RouterOS', 'میکروتیک RouterOS', 'Networking', 'شبکه', 95, '#c03030'],
      ['Cisco IOS/IOS-XE', 'سیسکو IOS/IOS-XE', 'Networking', 'شبکه', 85, '#1ba0d7'],
      ['Fortigate NGFW', 'فورتی‌گیت NGFW', 'Security', 'امنیت', 90, '#ef4444'],
      ['VMware vSphere', 'VMware vSphere', 'Virtualization', 'مجازی‌سازی', 88, '#60b6e0'],
      ['Proxmox VE', 'Proxmox VE', 'Virtualization', 'مجازی‌سازی', 85, '#e57000'],
      ['Zabbix', 'Zabbix', 'Monitoring', 'پایش', 92, '#f59e0b'],
      ['Ansible', 'Ansible', 'Automation', 'خودکارسازی', 80, '#06b6d4'],
      ['Linux (RHEL/Debian)', 'لینوکس (RHEL/Debian)', 'Systems', 'سیستم‌ها', 90, '#f59e0b'],
      ['Windows Server', 'ویندوز سرور', 'Systems', 'سیستم‌ها', 80, '#00adef'],
      ['Ceph Storage', 'ذخیره‌سازی Ceph', 'Storage', 'ذخیره‌سازی', 78, '#f05050'],
      ['pfSense/OPNsense', 'pfSense/OPNsense', 'Security', 'امنیت', 82, '#1e90ff'],
      ['Docker/Podman', 'Docker/Podman', 'Automation', 'خودکارسازی', 75, '#2496ed'],
    ]
    const ins = sqlite.prepare(`INSERT INTO skills (name_en, name_fa, category_en, category_fa, level, color, sort_order) VALUES (?,?,?,?,?,?,?)`)
    sk.forEach(([ne, nf, ce, cf, lv, cl], i) => ins.run(ne, nf, ce, cf, lv, cl, i))
  }

  // Certifications
  const certsCount = (sqlite.prepare('SELECT COUNT(*) as c FROM certifications').get() as { c: number }).c
  if (certsCount === 0) {
    const certs = [
      ['MikroTik MTCNA', 'میکروتیک MTCNA', 'MikroTik', '#c03030', 1],
      ['MikroTik MTCRE', 'میکروتیک MTCRE', 'MikroTik', '#c03030', 2],
      ['Fortinet NSE 4', 'فورتینت NSE 4', 'Fortinet', '#ef4444', 3],
      ['VMware VCP-DCV', 'VMware VCP-DCV', 'VMware', '#60b6e0', 4],
      ['Linux LPIC-1', 'لینوکس LPIC-1', 'Linux Professional Institute', '#f59e0b', 5],
      ['Cisco CCNA', 'سیسکو CCNA', 'Cisco', '#1ba0d7', 6],
    ]
    const ins = sqlite.prepare(`INSERT INTO certifications (name_en, name_fa, issuer, color, sort_order) VALUES (?,?,?,?,?)`)
    for (const [ne, nf, is, cl, so] of certs) ins.run(ne, nf, is, cl, so)
  }

  // Services
  const servicesCount = (sqlite.prepare('SELECT COUNT(*) as c FROM services').get() as { c: number }).c
  if (servicesCount === 0) {
    const svcs = [
      { slug: 'network-design', title_en: 'Network Design & Architecture', title_fa: 'طراحی و معماری شبکه', category_en: 'Networking', category_fa: 'شبکه', short_desc_en: 'Enterprise network design with MikroTik, Cisco, VLANs, OSPF, BGP.', short_desc_fa: 'طراحی شبکه سازمانی با میکروتیک، سیسکو، VLAN، OSPF، BGP.', features_en: '["MikroTik RouterOS","Cisco IOS","VLAN Design","OSPF/BGP Routing","QoS Configuration","Network Documentation"]', features_fa: '["میکروتیک RouterOS","سیسکو IOS","طراحی VLAN","مسیریابی OSPF/BGP","پیکربندی QoS","مستندسازی شبکه"]', color: '#6366f1', sort_order: 1 },
      { slug: 'network-security', title_en: 'Network Security', title_fa: 'امنیت شبکه', category_en: 'Security', category_fa: 'امنیت', short_desc_en: 'Fortigate NGFW, firewall policies, SSL inspection, zero-trust.', short_desc_fa: 'فایروال Fortigate NGFW، سیاست‌های فایروال، بازرسی SSL، zero-trust.', features_en: '["Fortigate NGFW","pfSense/OPNsense","SSL/TLS Inspection","IDS/IPS","VPN Design","Security Auditing"]', features_fa: '["Fortigate NGFW","pfSense/OPNsense","بازرسی SSL/TLS","IDS/IPS","طراحی VPN","ممیزی امنیتی"]', color: '#ef4444', sort_order: 2 },
      { slug: 'virtualization', title_en: 'Virtualization & Cloud', title_fa: 'مجازی‌سازی و ابر', category_en: 'Infrastructure', category_fa: 'زیرساخت', short_desc_en: 'VMware vSphere, Proxmox VE clusters, Ceph storage, HA.', short_desc_fa: 'VMware vSphere، خوشه‌های Proxmox VE، ذخیره‌سازی Ceph، HA.', features_en: '["VMware vSphere","Proxmox VE","Ceph Storage","HA Clustering","Live Migration","Backup Strategies"]', features_fa: '["VMware vSphere","Proxmox VE","ذخیره‌سازی Ceph","خوشه‌بندی HA","انتقال زنده","راهبردهای پشتیبان"]', color: '#60b6e0', sort_order: 3 },
      { slug: 'monitoring', title_en: 'Monitoring & Observability', title_fa: 'پایش و دیده‌بانی', category_en: 'Operations', category_fa: 'عملیات', short_desc_en: 'Zabbix, Grafana, SNMP, custom dashboards, alerting.', short_desc_fa: 'Zabbix، Grafana، SNMP، داشبوردهای اختصاصی، هشداردهی.', features_en: '["Zabbix 7.0","Grafana","SNMP Monitoring","Custom Dashboards","Alert Management","SLA Reporting"]', features_fa: '["Zabbix 7.0","Grafana","پایش SNMP","داشبوردهای اختصاصی","مدیریت هشدار","گزارش SLA"]', color: '#f59e0b', sort_order: 4 },
      { slug: 'backup-dr', title_en: 'Backup & Disaster Recovery', title_fa: 'پشتیبان‌گیری و بازیابی فاجعه', category_en: 'Infrastructure', category_fa: 'زیرساخت', short_desc_en: 'Veeam, Duplicati, offsite backup, RTO/RPO planning.', short_desc_fa: 'Veeam، Duplicati، پشتیبان خارجی، برنامه‌ریزی RTO/RPO.', features_en: '["Veeam Backup","Duplicati","Offsite Storage","DR Planning","RTO/RPO Targets","Recovery Testing"]', features_fa: '["Veeam Backup","Duplicati","ذخیره‌سازی خارجی","برنامه‌ریزی DR","اهداف RTO/RPO","تست بازیابی"]', color: '#8b5cf6', sort_order: 5 },
      { slug: 'linux', title_en: 'Linux Administration', title_fa: 'مدیریت لینوکس', category_en: 'Systems', category_fa: 'سیستم‌ها', short_desc_en: 'RHEL, Debian, Ubuntu server hardening, automation.', short_desc_fa: 'RHEL، Debian، Ubuntu، سخت‌سازی سرور، خودکارسازی.', features_en: '["RHEL/Rocky Linux","Debian/Ubuntu","Server Hardening","Shell Scripting","Service Management","Performance Tuning"]', features_fa: '["RHEL/Rocky Linux","Debian/Ubuntu","سخت‌سازی سرور","اسکریپت‌نویسی","مدیریت سرویس","تنظیم کارایی"]', color: '#f59e0b', sort_order: 6 },
      { slug: 'microsoft', title_en: 'Microsoft Infrastructure', title_fa: 'زیرساخت مایکروسافت', category_en: 'Systems', category_fa: 'سیستم‌ها', short_desc_en: 'Windows Server, Active Directory, Group Policy, Hyper-V.', short_desc_fa: 'ویندوز سرور، Active Directory، Group Policy، Hyper-V.', features_en: '["Windows Server 2019/2022","Active Directory","Group Policy","Hyper-V","Exchange","WSUS"]', features_fa: '["ویندوز سرور ۲۰۱۹/۲۰۲۲","Active Directory","Group Policy","Hyper-V","Exchange","WSUS"]', color: '#00adef', sort_order: 7 },
      { slug: 'voip', title_en: 'VoIP & Telephony', title_fa: 'VoIP و تلفن', category_en: 'Communications', category_fa: 'ارتباطات', short_desc_en: 'Asterisk, FreePBX, SIP trunks, call center solutions.', short_desc_fa: 'Asterisk، FreePBX، SIP trunk، راه‌حل‌های مرکز تماس.', features_en: '["Asterisk PBX","FreePBX","SIP Trunking","IVR Design","Call Recording","QoS for VoIP"]', features_fa: '["Asterisk PBX","FreePBX","SIP Trunk","طراحی IVR","ضبط مکالمه","QoS برای VoIP"]', color: '#10b981', sort_order: 8 },
      { slug: 'automation', title_en: 'Network Automation', title_fa: 'خودکارسازی شبکه', category_en: 'Operations', category_fa: 'عملیات', short_desc_en: 'Ansible playbooks, Python scripts, CI/CD for infrastructure.', short_desc_fa: 'Ansible playbook، اسکریپت Python، CI/CD برای زیرساخت.', features_en: '["Ansible Automation","Python Scripting","NETCONF/YANG","Infrastructure as Code","CI/CD Pipelines","Config Management"]', features_fa: '["خودکارسازی Ansible","اسکریپت Python","NETCONF/YANG","زیرساخت به عنوان کد","CI/CD","مدیریت پیکربندی"]', color: '#06b6d4', sort_order: 9 },
    ]
    const ins = sqlite.prepare(`INSERT INTO services (slug, title_en, title_fa, category_en, category_fa, short_desc_en, short_desc_fa, features_en, features_fa, color, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    for (const s of svcs) ins.run(s.slug, s.title_en, s.title_fa, s.category_en, s.category_fa, s.short_desc_en, s.short_desc_fa, s.features_en, s.features_fa, s.color, s.sort_order)
  }

  // Projects
  const projectsCount = (sqlite.prepare('SELECT COUNT(*) as c FROM projects').get() as { c: number }).c
  if (projectsCount === 0) {
    const projs = [
      { slug: 'kenzo-restaurant', name_en: 'Kenzo Restaurant', name_fa: 'رستوران کنزو', industry_en: 'Hospitality', industry_fa: 'مهمانداری', challenge_en: 'Unreliable network causing POS downtime and poor guest WiFi experience.', challenge_fa: 'شبکه ناپایدار که باعث خرابی POS و تجربه بد WiFi مهمانان می‌شد.', solution_en: 'Deployed MikroTik CHR with redundant ISP links, guest VLAN isolation, and QoS for POS priority.', solution_fa: 'استقرار MikroTik CHR با لینک‌های ISP افزونه، جداسازی VLAN مهمانان و QoS برای اولویت POS.', results_en: '["99.9% uptime achieved","POS latency reduced by 80%","Guest WiFi satisfaction increased","Secure VLAN isolation implemented"]', results_fa: '["دسترس‌پذیری ۹۹.۹٪ محقق شد","تأخیر POS ۸۰٪ کاهش یافت","رضایت WiFi مهمانان افزایش یافت","جداسازی VLAN امن پیاده‌سازی شد"]', tags_en: '["MikroTik","VLAN","QoS","WiFi","POS"]', tags_fa: '["میکروتیک","VLAN","QoS","وایفای","POS"]', color: '#c03030', year: '2023', featured: 1, sort_order: 1 },
      { slug: 'popcorn-holding', name_en: 'Popcorn Holding', name_fa: 'هلدینگ پاپ‌کورن', industry_en: 'Corporate', industry_fa: 'شرکتی', challenge_en: 'Multi-branch connectivity issues, no centralized security policy, data scattered across locations.', challenge_fa: 'مشکلات اتصال چند شعبه، بدون سیاست امنیتی متمرکز، داده‌های پراکنده.', solution_en: 'Implemented SD-WAN with Fortigate hub-and-spoke, centralized AD, and Veeam backup across all branches.', solution_fa: 'پیاده‌سازی SD-WAN با Fortigate hub-and-spoke، AD متمرکز و Veeam backup در تمام شعب.', results_en: '["Unified security policy across 5 branches","Centralized backup with 4-hour RTO","30% reduction in IT operational costs","Full network visibility via Zabbix"]', results_fa: '["سیاست امنیتی یکپارچه در ۵ شعبه","پشتیبان متمرکز با RTO ۴ ساعته","کاهش ۳۰٪ هزینه‌های IT","دید کامل شبکه از طریق Zabbix"]', tags_en: '["Fortigate","SD-WAN","Active Directory","Veeam","Zabbix"]', tags_fa: '["فورتی‌گیت","SD-WAN","Active Directory","Veeam","Zabbix"]', color: '#ef4444', year: '2024', featured: 1, sort_order: 2 },
      { slug: 'senso-restaurant-group', name_en: 'Senso Restaurant Group', name_fa: 'گروه رستوران سنسو', industry_en: 'Hospitality', industry_fa: 'مهمانداری', challenge_en: 'Rapidly expanding restaurant chain needing scalable, manageable network across new locations.', challenge_fa: 'زنجیره رستوران در حال گسترش سریع نیاز به شبکه مقیاس‌پذیر و قابل مدیریت دارد.', solution_en: 'Designed template-based network for rapid deployment: Cisco switches, MikroTik routers, Zabbix monitoring, automated config via Ansible.', solution_fa: 'طراحی شبکه مبتنی بر قالب برای استقرار سریع: سوئیچ‌های سیسکو، روترهای میکروتیک، پایش Zabbix، پیکربندی خودکار با Ansible.', results_en: '["New location deployment in under 4 hours","Automated config eliminates human error","Centralized monitoring for all branches","Consistent security posture"]', results_fa: '["استقرار موقعیت جدید در کمتر از ۴ ساعت","پیکربندی خودکار خطای انسانی را حذف می‌کند","پایش متمرکز برای همه شعب","وضعیت امنیتی یکسان"]', tags_en: '["Cisco","MikroTik","Ansible","Zabbix","Multi-site"]', tags_fa: '["سیسکو","میکروتیک","Ansible","Zabbix","چند سایته"]', color: '#1ba0d7', year: '2024', featured: 1, sort_order: 3 },
      { slug: 'industrial-enterprise', name_en: 'Industrial Enterprise', name_fa: 'سازمان صنعتی', industry_en: 'Industrial', industry_fa: 'صنعتی', challenge_en: 'Legacy OT network with no segmentation between IT and OT, critical machinery exposed to internet.', challenge_fa: 'شبکه OT قدیمی بدون تفکیک بین IT و OT، ماشین‌آلات حیاتی در معرض اینترنت.', solution_en: 'Implemented IT/OT network segregation with DMZ, Fortigate NGFW, industrial-grade switches, and SCADA monitoring.', solution_fa: 'پیاده‌سازی تفکیک شبکه IT/OT با DMZ، Fortigate NGFW، سوئیچ‌های صنعتی و پایش SCADA.', results_en: '["IT/OT fully isolated with controlled DMZ","Zero security incidents post-implementation","OT visibility via SCADA monitoring","Compliance with IEC 62443 standards"]', results_fa: '["IT/OT کاملاً جدا با DMZ کنترل‌شده","صفر حادثه امنیتی پس از پیاده‌سازی","دید OT از طریق پایش SCADA","انطباق با استانداردهای IEC 62443"]', tags_en: '["ICS/OT Security","Fortigate","DMZ","SCADA","Network Segmentation"]', tags_fa: '["امنیت ICS/OT","فورتی‌گیت","DMZ","SCADA","تفکیک شبکه"]', color: '#f59e0b', year: '2025', featured: 1, sort_order: 4 },
    ]
    const ins = sqlite.prepare(`INSERT INTO projects (slug, name_en, name_fa, industry_en, industry_fa, challenge_en, challenge_fa, solution_en, solution_fa, results_en, results_fa, tags_en, tags_fa, color, year, featured, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    for (const p of projs) ins.run(p.slug, p.name_en, p.name_fa, p.industry_en, p.industry_fa, p.challenge_en, p.challenge_fa, p.solution_en, p.solution_fa, p.results_en, p.results_fa, p.tags_en, p.tags_fa, p.color, p.year, p.featured, p.sort_order)
  }

  // Clients
  const clientsCount = (sqlite.prepare('SELECT COUNT(*) as c FROM clients').get() as { c: number }).c
  if (clientsCount === 0) {
    const cl = [
      ['Kenzo Restaurant', 'رستوران کنزو', 'Hospitality', 'مهمانداری', 0],
      ['Popcorn Holding', 'هلدینگ پاپ‌کورن', 'Corporate', 'شرکتی', 0],
      ['Senso Restaurant Group', 'گروه رستوران سنسو', 'Hospitality', 'مهمانداری', 0],
      ['Industrial Enterprise', 'سازمان صنعتی', 'Industrial', 'صنعتی', 0],
      ['MikroTik', 'میکروتیک', 'Technology Partner', 'شریک فناوری', 1],
      ['Cisco', 'سیسکو', 'Technology Partner', 'شریک فناوری', 1],
      ['Fortinet', 'فورتینت', 'Technology Partner', 'شریک فناوری', 1],
      ['VMware', 'VMware', 'Technology Partner', 'شریک فناوری', 1],
      ['Proxmox', 'Proxmox', 'Technology Partner', 'شریک فناوری', 1],
      ['Zabbix', 'Zabbix', 'Technology Partner', 'شریک فناوری', 1],
    ]
    const ins = sqlite.prepare(`INSERT INTO clients (name_en, name_fa, type_en, type_fa, is_tech_partner, sort_order) VALUES (?,?,?,?,?,?)`)
    cl.forEach(([ne, nf, te, tf, itp], i) => ins.run(ne, nf, te, tf, itp, i))
  }

  // Blog categories
  const catCount = (sqlite.prepare('SELECT COUNT(*) as c FROM blog_categories').get() as { c: number }).c
  if (catCount === 0) {
    const cats = [
      ['mikrotik', 'MikroTik', 'میکروتیک', '🌐', '#c03030'],
      ['cisco', 'Cisco', 'سیسکو', '🔷', '#1ba0d7'],
      ['linux', 'Linux', 'لینوکس', '🐧', '#f59e0b'],
      ['windows-server', 'Windows Server', 'ویندوز سرور', '🪟', '#00adef'],
      ['vmware', 'VMware', 'VMware', '☁️', '#60b6e0'],
      ['proxmox', 'Proxmox', 'Proxmox', '🖥️', '#e57000'],
      ['security', 'Security', 'امنیت', '🛡️', '#ef4444'],
      ['monitoring', 'Monitoring', 'پایش', '📊', '#f59e0b'],
      ['automation', 'Automation', 'خودکارسازی', '⚙️', '#06b6d4'],
      ['devops', 'DevOps', 'دواپس', '🚀', '#818cf8'],
    ]
    const ins = sqlite.prepare(`INSERT INTO blog_categories (slug, name_en, name_fa, icon, color, sort_order) VALUES (?,?,?,?,?,?)`)
    cats.forEach(([sl, ne, nf, ic, co], i) => ins.run(sl, ne, nf, ic, co, i))
  }

  // Blog posts
  const postsCount = (sqlite.prepare('SELECT COUNT(*) as c FROM blog_posts').get() as { c: number }).c
  if (postsCount === 0) {
    const catId = (sqlite.prepare('SELECT id FROM blog_categories WHERE slug = ?').get('mikrotik') as { id: number })?.id || 1
    const secId = (sqlite.prepare('SELECT id FROM blog_categories WHERE slug = ?').get('security') as { id: number })?.id || 7
    const posts = [
      { slug: 'mikrotik-ospf-multi-site', title_en: 'Building a Multi-Site MikroTik Network with OSPF', title_fa: 'ساخت شبکه چند سایته MikroTik با OSPF', excerpt_en: 'A complete guide to designing and deploying multi-site OSPF routing with MikroTik RouterOS for enterprise branch offices.', excerpt_fa: 'راهنمای کامل طراحی و استقرار مسیریابی OSPF چند سایته با MikroTik RouterOS برای دفاتر شعبه سازمانی.', category_id: catId, read_time_en: '12 min read', read_time_fa: '۱۲ دقیقه مطالعه', published_at_en: 'Jan 2025', published_at_fa: 'دی ۱۴۰۳', status: 'published', featured: 1 },
      { slug: 'zero-trust-fortigate', title_en: 'Zero-Trust Network Architecture with Fortigate', title_fa: 'معماری شبکه Zero-Trust با Fortigate', excerpt_en: 'Implementing a zero-trust security model using Fortigate NGFW, SSL inspection, and micro-segmentation.', excerpt_fa: 'پیاده‌سازی مدل امنیتی Zero-Trust با استفاده از Fortigate NGFW، بازرسی SSL و میکرو-تقسیم‌بندی.', category_id: secId, read_time_en: '15 min read', read_time_fa: '۱۵ دقیقه مطالعه', published_at_en: 'Feb 2025', published_at_fa: 'بهمن ۱۴۰۳', status: 'published', featured: 1 },
    ]
    const ins = sqlite.prepare(`INSERT INTO blog_posts (slug, title_en, title_fa, excerpt_en, excerpt_fa, category_id, read_time_en, read_time_fa, published_at_en, published_at_fa, status, featured) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    for (const p of posts) ins.run(p.slug, p.title_en, p.title_fa, p.excerpt_en, p.excerpt_fa, p.category_id, p.read_time_en, p.read_time_fa, p.published_at_en, p.published_at_fa, p.status, p.featured)
  }

  // Navigation items
  const navCount = (sqlite.prepare('SELECT COUNT(*) as c FROM navigation_items').get() as { c: number }).c
  if (navCount === 0) {
    const navItems = [
      ['Home', 'خانه', '/', 'header', 1],
      ['About', 'درباره', '/about', 'header', 2],
      ['Services', 'خدمات', '/services', 'header', 3],
      ['Projects', 'پروژه‌ها', '/projects', 'header', 4],
      ['Blog', 'وبلاگ', '/blog', 'header', 5],
      ['Consultation', 'مشاوره', '/consultation', 'header', 6],
    ]
    const ins = sqlite.prepare(`INSERT INTO navigation_items (label_en, label_fa, href, location, sort_order) VALUES (?,?,?,?,?)`)
    for (const [le, lf, hr, lo, so] of navItems) ins.run(le, lf, hr, lo, so)
  }

  // AI knowledge base defaults
  const aiCount = (sqlite.prepare('SELECT COUNT(*) as c FROM ai_knowledge_base').get() as { c: number }).c
  if (aiCount === 0) {
    sqlite.prepare(`INSERT INTO ai_knowledge_base (title, type, content, tags, locale) VALUES (?,?,?,?,?)`)
      .run('HBZ Professional Profile', 'snippet', 'Husein Habibazar (HBZ) is an Infrastructure Architect and Network Security Consultant with 10+ years of experience. Specializes in MikroTik, Cisco, Fortigate, VMware, Proxmox, Zabbix, Ansible, and Linux administration. Serves enterprise clients in hospitality, corporate, and industrial sectors.', 'profile,about,background', 'both')
  }

  sqlite.close()
}
