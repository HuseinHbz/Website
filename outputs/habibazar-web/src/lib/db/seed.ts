import { hashPassword } from '@/lib/admin/password'
import { nanoid } from 'nanoid'
import { eq, sql } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'
import { db, schema } from './index'

async function count(tbl: PgTable): Promise<number> {
  const [row] = await db.select({ c: sql<number>`count(*)` }).from(tbl)
  return Number(row?.c ?? 0)
}

export async function seedDatabase() {
  const s = schema

  // Super admin user (idempotent)
  const existingUser = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, 'admin@habibazar.com')).limit(1)
  if (existingUser.length === 0) {
    const hash = await hashPassword('HBZ@Admin2025!') // async scrypt (26.25b بند ۰.۲)
    await db.insert(s.users).values({ id: nanoid(), name: 'Husein Habibazar', email: 'admin@habibazar.com', passwordHash: hash, role: 'super_admin' }).onConflictDoNothing()
  }

  // Site settings
  const settings: [string, string, string][] = [
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
    ['social_instagram', '', 'social'],
    ['social_whatsapp', '', 'social'],
    ['smtp_host', '', 'email'],
    ['smtp_port', '587', 'email'],
    ['smtp_user', '', 'email'],
    ['smtp_pass', '', 'email'],
    ['smtp_from', 'noreply@habibazar.com', 'email'],
    ['ai_api_url', 'https://api.habibazar.ir', 'ai'],
    ['ai_api_key', '', 'ai'],
    ['ai_model', 'gpt-4o-mini', 'ai'],
    ['ai_max_turns', '10', 'ai'],
    ['profile_photo_url', '', 'profile'],
    ['resume_url', '/resume.pdf', 'profile'],
  ]
  for (const [key, value, group] of settings) {
    await db.insert(s.siteSettings).values({ key, value, group }).onConflictDoNothing({ target: s.siteSettings.key })
  }

  // Hero content EN / FA
  const heroEn = await db.select({ id: s.heroContent.id }).from(s.heroContent).where(eq(s.heroContent.locale, 'en')).limit(1)
  if (heroEn.length === 0) {
    await db.insert(s.heroContent).values({ locale: 'en', badge: 'Available for Enterprise Projects', headline: 'Infrastructure', headlineHighlight: 'Architect', subheadline: 'Designing, Securing and Automating Modern Enterprise Infrastructure — from MikroTik to Cisco, VMware to Proxmox, Zabbix to Ansible.', ctaPrimary: 'View Projects', ctaPrimaryHref: '/projects', ctaSecondary: 'Book Consultation', ctaSecondaryHref: '/consultation', ctaTertiary: 'Download Resume', ctaTertiaryHref: '/resume.pdf', stat1Label: 'Years Experience', stat1Value: '10+', stat2Label: 'Enterprise Projects', stat2Value: '50+', stat3Label: 'Managed Endpoints', stat3Value: '1000+', stat4Label: 'Production Deployments', stat4Value: '20+' })
  }
  const heroFa = await db.select({ id: s.heroContent.id }).from(s.heroContent).where(eq(s.heroContent.locale, 'fa')).limit(1)
  if (heroFa.length === 0) {
    await db.insert(s.heroContent).values({ locale: 'fa', badge: 'آماده همکاری با سازمان‌ها', headline: 'معمار', headlineHighlight: 'زیرساخت', subheadline: 'طراحی، ایمن‌سازی و خودکارسازی زیرساخت سازمانی مدرن — از میکروتیک تا سیسکو، VMware تا Proxmox، Zabbix تا Ansible.', ctaPrimary: 'مشاهده پروژه‌ها', ctaPrimaryHref: '/projects', ctaSecondary: 'رزرو مشاوره', ctaSecondaryHref: '/consultation', ctaTertiary: 'دانلود رزومه', ctaTertiaryHref: '/resume.pdf', stat1Label: 'سال تجربه', stat1Value: '+۱۰', stat2Label: 'پروژه سازمانی', stat2Value: '+۵۰', stat3Label: 'تجهیز مدیریت‌شده', stat3Value: '+۱۰۰۰', stat4Label: 'استقرار تولیدی', stat4Value: '+۲۰' })
  }

  // About EN / FA
  const aboutEn = await db.select({ id: s.aboutContent.id }).from(s.aboutContent).where(eq(s.aboutContent.locale, 'en')).limit(1)
  if (aboutEn.length === 0) {
    await db.insert(s.aboutContent).values({ locale: 'en', headline: 'Infrastructure Architect', subheadline: '& Network Security Consultant', bio: 'With over a decade of hands-on experience in enterprise infrastructure, I specialize in designing resilient, secure, and automated network environments. My expertise spans from MikroTik and Cisco routing & switching to VMware and Proxmox virtualization, Zabbix monitoring, Fortigate security, and Ansible automation. I have successfully delivered infrastructure projects for restaurants, hospitality groups, holding companies, and industrial enterprises across Iran.', yearsExp: '10+', projectsCount: '50+', endpointsCount: '1000+', deploymentsCount: '20+' })
  }
  const aboutFa = await db.select({ id: s.aboutContent.id }).from(s.aboutContent).where(eq(s.aboutContent.locale, 'fa')).limit(1)
  if (aboutFa.length === 0) {
    await db.insert(s.aboutContent).values({ locale: 'fa', headline: 'معمار زیرساخت', subheadline: 'و مشاور امنیت شبکه', bio: 'با بیش از یک دهه تجربه عملی در زیرساخت سازمانی، در طراحی محیط‌های شبکه مقاوم، امن و خودکار تخصص دارم. تخصص من از مسیریابی و سوئیچینگ میکروتیک و سیسکو تا مجازی‌سازی VMware و Proxmox، پایش Zabbix، امنیت Fortigate و خودکارسازی Ansible گسترش می‌یابد.', yearsExp: '+۱۰', projectsCount: '+۵۰', endpointsCount: '+۱۰۰۰', deploymentsCount: '+۲۰' })
  }

  // Timeline
  if (await count(s.timelineItems) === 0) {
    await db.insert(s.timelineItems).values([
      { year: '2013', titleEn: 'Started in IT Support', titleFa: 'شروع در پشتیبانی IT', companyEn: 'Local ISP', companyFa: 'ISP محلی', descEn: 'Began career maintaining network infrastructure and providing technical support for small businesses.', descFa: 'آغاز مسیر با نگهداری زیرساخت شبکه و پشتیبانی فنی از کسب‌وکارهای کوچک.', color: '#6366f1', sortOrder: 1 },
      { year: '2017', titleEn: 'Network Engineer', titleFa: 'مهندس شبکه', companyEn: 'Enterprise Clients', companyFa: 'مشتریان سازمانی', descEn: 'Advanced to designing and implementing enterprise-grade networks with MikroTik and Cisco equipment.', descFa: 'ارتقا به طراحی و پیاده‌سازی شبکه‌های سطح سازمانی با تجهیزات میکروتیک و سیسکو.', color: '#06b6d4', sortOrder: 2 },
      { year: '2019', titleEn: 'Security Specialization', titleFa: 'تخصص امنیت', companyEn: 'Multi-client', companyFa: 'چند مشتری', descEn: 'Obtained Fortinet NSE certification and began implementing NGFW, VPN, and zero-trust architectures.', descFa: 'دریافت گواهینامه Fortinet NSE و شروع پیاده‌سازی NGFW، VPN و معماری‌های zero-trust.', color: '#ef4444', sortOrder: 3 },
      { year: '2021', titleEn: 'Virtualization & Cloud', titleFa: 'مجازی‌سازی و ابر', companyEn: 'Enterprise Deployments', companyFa: 'استقرار سازمانی', descEn: 'Mastered VMware vSphere and Proxmox VE for enterprise virtualization, HA clustering, and Ceph storage.', descFa: 'تسلط بر VMware vSphere و Proxmox VE برای مجازی‌سازی سازمانی، خوشه‌بندی HA و ذخیره‌سازی Ceph.', color: '#f59e0b', sortOrder: 4 },
      { year: '2025', titleEn: 'Independent Consultant', titleFa: 'مشاور مستقل', companyEn: 'HBZ Consulting', companyFa: 'مشاوره HBZ', descEn: 'Launched independent consulting practice serving restaurants, hospitality, and industrial enterprise clients.', descFa: 'راه‌اندازی مشاوره مستقل برای رستوران‌ها، مهمانداری و مشتریان صنعتی سازمانی.', color: '#818cf8', sortOrder: 5 },
    ])
  }

  // Skills
  if (await count(s.skills) === 0) {
    const sk: [string, string, string, string, number, string][] = [
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
    await db.insert(s.skills).values(sk.map(([nameEn, nameFa, categoryEn, categoryFa, level, color], i) => ({ nameEn, nameFa, categoryEn, categoryFa, level, color, sortOrder: i })))
  }

  // Certifications
  if (await count(s.certifications) === 0) {
    const certs: [string, string, string, string, number][] = [
      ['MikroTik MTCNA', 'میکروتیک MTCNA', 'MikroTik', '#c03030', 1],
      ['MikroTik MTCRE', 'میکروتیک MTCRE', 'MikroTik', '#c03030', 2],
      ['Fortinet NSE 4', 'فورتینت NSE 4', 'Fortinet', '#ef4444', 3],
      ['VMware VCP-DCV', 'VMware VCP-DCV', 'VMware', '#60b6e0', 4],
      ['Linux LPIC-1', 'لینوکس LPIC-1', 'Linux Professional Institute', '#f59e0b', 5],
      ['Cisco CCNA', 'سیسکو CCNA', 'Cisco', '#1ba0d7', 6],
    ]
    await db.insert(s.certifications).values(certs.map(([nameEn, nameFa, issuer, color, sortOrder]) => ({ nameEn, nameFa, issuer, color, sortOrder })))
  }

  // Services
  if (await count(s.services) === 0) {
    await db.insert(s.services).values([
      { slug: 'network-design', titleEn: 'Network Design & Architecture', titleFa: 'طراحی و معماری شبکه', categoryEn: 'Networking', categoryFa: 'شبکه', shortDescEn: 'Enterprise network design with MikroTik, Cisco, VLANs, OSPF, BGP.', shortDescFa: 'طراحی شبکه سازمانی با میکروتیک، سیسکو، VLAN، OSPF، BGP.', featuresEn: '["MikroTik RouterOS","Cisco IOS","VLAN Design","OSPF/BGP Routing","QoS Configuration","Network Documentation"]', featuresFa: '["میکروتیک RouterOS","سیسکو IOS","طراحی VLAN","مسیریابی OSPF/BGP","پیکربندی QoS","مستندسازی شبکه"]', color: '#6366f1', sortOrder: 1 },
      { slug: 'network-security', titleEn: 'Network Security', titleFa: 'امنیت شبکه', categoryEn: 'Security', categoryFa: 'امنیت', shortDescEn: 'Fortigate NGFW, firewall policies, SSL inspection, zero-trust.', shortDescFa: 'فایروال Fortigate NGFW، سیاست‌های فایروال، بازرسی SSL، zero-trust.', featuresEn: '["Fortigate NGFW","pfSense/OPNsense","SSL/TLS Inspection","IDS/IPS","VPN Design","Security Auditing"]', featuresFa: '["Fortigate NGFW","pfSense/OPNsense","بازرسی SSL/TLS","IDS/IPS","طراحی VPN","ممیزی امنیتی"]', color: '#ef4444', sortOrder: 2 },
      { slug: 'virtualization', titleEn: 'Virtualization & Cloud', titleFa: 'مجازی‌سازی و ابر', categoryEn: 'Infrastructure', categoryFa: 'زیرساخت', shortDescEn: 'VMware vSphere, Proxmox VE clusters, Ceph storage, HA.', shortDescFa: 'VMware vSphere، خوشه‌های Proxmox VE، ذخیره‌سازی Ceph، HA.', featuresEn: '["VMware vSphere","Proxmox VE","Ceph Storage","HA Clustering","Live Migration","Backup Strategies"]', featuresFa: '["VMware vSphere","Proxmox VE","ذخیره‌سازی Ceph","خوشه‌بندی HA","انتقال زنده","راهبردهای پشتیبان"]', color: '#60b6e0', sortOrder: 3 },
      { slug: 'monitoring', titleEn: 'Monitoring & Observability', titleFa: 'پایش و دیده‌بانی', categoryEn: 'Operations', categoryFa: 'عملیات', shortDescEn: 'Zabbix, Grafana, SNMP, custom dashboards, alerting.', shortDescFa: 'Zabbix، Grafana، SNMP، داشبوردهای اختصاصی، هشداردهی.', featuresEn: '["Zabbix 7.0","Grafana","SNMP Monitoring","Custom Dashboards","Alert Management","SLA Reporting"]', featuresFa: '["Zabbix 7.0","Grafana","پایش SNMP","داشبوردهای اختصاصی","مدیریت هشدار","گزارش SLA"]', color: '#f59e0b', sortOrder: 4 },
      { slug: 'backup-dr', titleEn: 'Backup & Disaster Recovery', titleFa: 'پشتیبان‌گیری و بازیابی فاجعه', categoryEn: 'Infrastructure', categoryFa: 'زیرساخت', shortDescEn: 'Veeam, Duplicati, offsite backup, RTO/RPO planning.', shortDescFa: 'Veeam، Duplicati، پشتیبان خارجی، برنامه‌ریزی RTO/RPO.', featuresEn: '["Veeam Backup","Duplicati","Offsite Storage","DR Planning","RTO/RPO Targets","Recovery Testing"]', featuresFa: '["Veeam Backup","Duplicati","ذخیره‌سازی خارجی","برنامه‌ریزی DR","اهداف RTO/RPO","تست بازیابی"]', color: '#8b5cf6', sortOrder: 5 },
      { slug: 'linux', titleEn: 'Linux Administration', titleFa: 'مدیریت لینوکس', categoryEn: 'Systems', categoryFa: 'سیستم‌ها', shortDescEn: 'RHEL, Debian, Ubuntu server hardening, automation.', shortDescFa: 'RHEL، Debian، Ubuntu، سخت‌سازی سرور، خودکارسازی.', featuresEn: '["RHEL/Rocky Linux","Debian/Ubuntu","Server Hardening","Shell Scripting","Service Management","Performance Tuning"]', featuresFa: '["RHEL/Rocky Linux","Debian/Ubuntu","سخت‌سازی سرور","اسکریپت‌نویسی","مدیریت سرویس","تنظیم کارایی"]', color: '#f59e0b', sortOrder: 6 },
      { slug: 'microsoft', titleEn: 'Microsoft Infrastructure', titleFa: 'زیرساخت مایکروسافت', categoryEn: 'Systems', categoryFa: 'سیستم‌ها', shortDescEn: 'Windows Server, Active Directory, Group Policy, Hyper-V.', shortDescFa: 'ویندوز سرور، Active Directory، Group Policy، Hyper-V.', featuresEn: '["Windows Server 2019/2022","Active Directory","Group Policy","Hyper-V","Exchange","WSUS"]', featuresFa: '["ویندوز سرور ۲۰۱۹/۲۰۲۲","Active Directory","Group Policy","Hyper-V","Exchange","WSUS"]', color: '#00adef', sortOrder: 7 },
      { slug: 'voip', titleEn: 'VoIP & Telephony', titleFa: 'VoIP و تلفن', categoryEn: 'Communications', categoryFa: 'ارتباطات', shortDescEn: 'Asterisk, FreePBX, SIP trunks, call center solutions.', shortDescFa: 'Asterisk، FreePBX، SIP trunk، راه‌حل‌های مرکز تماس.', featuresEn: '["Asterisk PBX","FreePBX","SIP Trunking","IVR Design","Call Recording","QoS for VoIP"]', featuresFa: '["Asterisk PBX","FreePBX","SIP Trunk","طراحی IVR","ضبط مکالمه","QoS برای VoIP"]', color: '#10b981', sortOrder: 8 },
      { slug: 'automation', titleEn: 'Network Automation', titleFa: 'خودکارسازی شبکه', categoryEn: 'Operations', categoryFa: 'عملیات', shortDescEn: 'Ansible playbooks, Python scripts, CI/CD for infrastructure.', shortDescFa: 'Ansible playbook، اسکریپت Python، CI/CD برای زیرساخت.', featuresEn: '["Ansible Automation","Python Scripting","NETCONF/YANG","Infrastructure as Code","CI/CD Pipelines","Config Management"]', featuresFa: '["خودکارسازی Ansible","اسکریپت Python","NETCONF/YANG","زیرساخت به عنوان کد","CI/CD","مدیریت پیکربندی"]', color: '#06b6d4', sortOrder: 9 },
    ])
  }

  // Projects
  if (await count(s.projects) === 0) {
    await db.insert(s.projects).values([
      { slug: 'kenzo-restaurant', nameEn: 'Kenzo Restaurant', nameFa: 'رستوران کنزو', industryEn: 'Hospitality', industryFa: 'مهمانداری', challengeEn: 'Unreliable network causing POS downtime and poor guest WiFi experience.', challengeFa: 'شبکه ناپایدار که باعث خرابی POS و تجربه بد WiFi مهمانان می‌شد.', solutionEn: 'Deployed MikroTik CHR with redundant ISP links, guest VLAN isolation, and QoS for POS priority.', solutionFa: 'استقرار MikroTik CHR با لینک‌های ISP افزونه، جداسازی VLAN مهمانان و QoS برای اولویت POS.', resultsEn: '["99.9% uptime achieved","POS latency reduced by 80%","Guest WiFi satisfaction increased","Secure VLAN isolation implemented"]', resultsFa: '["دسترس‌پذیری ۹۹.۹٪ محقق شد","تأخیر POS ۸۰٪ کاهش یافت","رضایت WiFi مهمانان افزایش یافت","جداسازی VLAN امن پیاده‌سازی شد"]', tagsEn: '["MikroTik","VLAN","QoS","WiFi","POS"]', tagsFa: '["میکروتیک","VLAN","QoS","وایفای","POS"]', color: '#c03030', year: '2023', featured: true, sortOrder: 1 },
      { slug: 'popcorn-holding', nameEn: 'Popcorn Holding', nameFa: 'هلدینگ پاپ‌کورن', industryEn: 'Corporate', industryFa: 'شرکتی', challengeEn: 'Multi-branch connectivity issues, no centralized security policy, data scattered across locations.', challengeFa: 'مشکلات اتصال چند شعبه، بدون سیاست امنیتی متمرکز، داده‌های پراکنده.', solutionEn: 'Implemented SD-WAN with Fortigate hub-and-spoke, centralized AD, and Veeam backup across all branches.', solutionFa: 'پیاده‌سازی SD-WAN با Fortigate hub-and-spoke، AD متمرکز و Veeam backup در تمام شعب.', resultsEn: '["Unified security policy across 5 branches","Centralized backup with 4-hour RTO","30% reduction in IT operational costs","Full network visibility via Zabbix"]', resultsFa: '["سیاست امنیتی یکپارچه در ۵ شعبه","پشتیبان متمرکز با RTO ۴ ساعته","کاهش ۳۰٪ هزینه‌های IT","دید کامل شبکه از طریق Zabbix"]', tagsEn: '["Fortigate","SD-WAN","Active Directory","Veeam","Zabbix"]', tagsFa: '["فورتی‌گیت","SD-WAN","Active Directory","Veeam","Zabbix"]', color: '#ef4444', year: '2024', featured: true, sortOrder: 2 },
      { slug: 'senso-restaurant-group', nameEn: 'Senso Restaurant Group', nameFa: 'گروه رستوران سنسو', industryEn: 'Hospitality', industryFa: 'مهمانداری', challengeEn: 'Rapidly expanding restaurant chain needing scalable, manageable network across new locations.', challengeFa: 'زنجیره رستوران در حال گسترش سریع نیاز به شبکه مقیاس‌پذیر و قابل مدیریت دارد.', solutionEn: 'Designed template-based network for rapid deployment: Cisco switches, MikroTik routers, Zabbix monitoring, automated config via Ansible.', solutionFa: 'طراحی شبکه مبتنی بر قالب برای استقرار سریع: سوئیچ‌های سیسکو، روترهای میکروتیک، پایش Zabbix، پیکربندی خودکار با Ansible.', resultsEn: '["New location deployment in under 4 hours","Automated config eliminates human error","Centralized monitoring for all branches","Consistent security posture"]', resultsFa: '["استقرار موقعیت جدید در کمتر از ۴ ساعت","پیکربندی خودکار خطای انسانی را حذف می‌کند","پایش متمرکز برای همه شعب","وضعیت امنیتی یکسان"]', tagsEn: '["Cisco","MikroTik","Ansible","Zabbix","Multi-site"]', tagsFa: '["سیسکو","میکروتیک","Ansible","Zabbix","چند سایته"]', color: '#1ba0d7', year: '2024', featured: true, sortOrder: 3 },
      { slug: 'industrial-enterprise', nameEn: 'Industrial Enterprise', nameFa: 'سازمان صنعتی', industryEn: 'Industrial', industryFa: 'صنعتی', challengeEn: 'Legacy OT network with no segmentation between IT and OT, critical machinery exposed to internet.', challengeFa: 'شبکه OT قدیمی بدون تفکیک بین IT و OT، ماشین‌آلات حیاتی در معرض اینترنت.', solutionEn: 'Implemented IT/OT network segregation with DMZ, Fortigate NGFW, industrial-grade switches, and SCADA monitoring.', solutionFa: 'پیاده‌سازی تفکیک شبکه IT/OT با DMZ، Fortigate NGFW، سوئیچ‌های صنعتی و پایش SCADA.', resultsEn: '["IT/OT fully isolated with controlled DMZ","Zero security incidents post-implementation","OT visibility via SCADA monitoring","Compliance with IEC 62443 standards"]', resultsFa: '["IT/OT کاملاً جدا با DMZ کنترل‌شده","صفر حادثه امنیتی پس از پیاده‌سازی","دید OT از طریق پایش SCADA","انطباق با استانداردهای IEC 62443"]', tagsEn: '["ICS/OT Security","Fortigate","DMZ","SCADA","Network Segmentation"]', tagsFa: '["امنیت ICS/OT","فورتی‌گیت","DMZ","SCADA","تفکیک شبکه"]', color: '#f59e0b', year: '2025', featured: true, sortOrder: 4 },
    ])
  }

  // Clients
  if (await count(s.clients) === 0) {
    const cl: [string, string, string, string, boolean][] = [
      ['Kenzo Restaurant', 'رستوران کنزو', 'Hospitality', 'مهمانداری', false],
      ['Popcorn Holding', 'هلدینگ پاپ‌کورن', 'Corporate', 'شرکتی', false],
      ['Senso Restaurant Group', 'گروه رستوران سنسو', 'Hospitality', 'مهمانداری', false],
      ['Industrial Enterprise', 'سازمان صنعتی', 'Industrial', 'صنعتی', false],
      ['MikroTik', 'میکروتیک', 'Technology Partner', 'شریک فناوری', true],
      ['Cisco', 'سیسکو', 'Technology Partner', 'شریک فناوری', true],
      ['Fortinet', 'فورتینت', 'Technology Partner', 'شریک فناوری', true],
      ['VMware', 'VMware', 'Technology Partner', 'شریک فناوری', true],
      ['Proxmox', 'Proxmox', 'Technology Partner', 'شریک فناوری', true],
      ['Zabbix', 'Zabbix', 'Technology Partner', 'شریک فناوری', true],
    ]
    await db.insert(s.clients).values(cl.map(([nameEn, nameFa, typeEn, typeFa, isTechPartner], i) => ({ nameEn, nameFa, typeEn, typeFa, isTechPartner, sortOrder: i })))
  }

  // Blog categories
  if (await count(s.blogCategories) === 0) {
    const cats: [string, string, string, string, string][] = [
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
    await db.insert(s.blogCategories).values(cats.map(([slug, nameEn, nameFa, icon, color], i) => ({ slug, nameEn, nameFa, icon, color, sortOrder: i })))
  }

  // Blog posts
  if (await count(s.blogPosts) === 0) {
    const mk = await db.select({ id: s.blogCategories.id }).from(s.blogCategories).where(eq(s.blogCategories.slug, 'mikrotik')).limit(1)
    const sec = await db.select({ id: s.blogCategories.id }).from(s.blogCategories).where(eq(s.blogCategories.slug, 'security')).limit(1)
    if (mk[0] && sec[0]) {
      await db.insert(s.blogPosts).values([
        { slug: 'mikrotik-ospf-multi-site', titleEn: 'Building a Multi-Site MikroTik Network with OSPF', titleFa: 'ساخت شبکه چند سایته MikroTik با OSPF', excerptEn: 'A complete guide to designing and deploying multi-site OSPF routing with MikroTik RouterOS for enterprise branch offices.', excerptFa: 'راهنمای کامل طراحی و استقرار مسیریابی OSPF چند سایته با MikroTik RouterOS برای دفاتر شعبه سازمانی.', categoryId: mk[0].id, readTimeEn: '12 min read', readTimeFa: '۱۲ دقیقه مطالعه', publishedAtEn: 'Jan 2025', publishedAtFa: 'دی ۱۴۰۳', status: 'published', featured: true },
        { slug: 'zero-trust-fortigate', titleEn: 'Zero-Trust Network Architecture with Fortigate', titleFa: 'معماری شبکه Zero-Trust با Fortigate', excerptEn: 'Implementing a zero-trust security model using Fortigate NGFW, SSL inspection, and micro-segmentation.', excerptFa: 'پیاده‌سازی مدل امنیتی Zero-Trust با استفاده از Fortigate NGFW، بازرسی SSL و میکرو-تقسیم‌بندی.', categoryId: sec[0].id, readTimeEn: '15 min read', readTimeFa: '۱۵ دقیقه مطالعه', publishedAtEn: 'Feb 2025', publishedAtFa: 'بهمن ۱۴۰۳', status: 'published', featured: true },
      ])
    }
  }

  // Navigation
  if (await count(s.navigationItems) === 0) {
    const navItems: [string, string, string, 'header' | 'footer', number][] = [
      ['Home', 'خانه', '/', 'header', 1],
      ['About', 'درباره', '/about', 'header', 2],
      ['Services', 'خدمات', '/services', 'header', 3],
      ['Projects', 'پروژه‌ها', '/projects', 'header', 4],
      ['Blog', 'وبلاگ', '/blog', 'header', 5],
      ['Consultation', 'مشاوره', '/consultation', 'header', 6],
    ]
    await db.insert(s.navigationItems).values(navItems.map(([labelEn, labelFa, href, location, sortOrder]) => ({ labelEn, labelFa, href, location, sortOrder })))
  }

  // AI knowledge base default
  if (await count(s.aiKnowledgeBase) === 0) {
    await db.insert(s.aiKnowledgeBase).values({ title: 'HBZ Professional Profile', type: 'snippet', content: 'Husein Habibazar (HBZ) is an Infrastructure Architect and Network Security Consultant with 10+ years of experience. Specializes in MikroTik, Cisco, Fortigate, VMware, Proxmox, Zabbix, Ansible, and Linux administration. Serves enterprise clients in hospitality, corporate, and industrial sectors.', tags: 'profile,about,background', locale: 'both' })
  }
}
