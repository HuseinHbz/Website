/**
 * Enterprise Workspace registry (Phase 22).
 *
 * The single source of truth for the admin's workspace-based navigation. The
 * ~60 admin modules are grouped into a small set of top-level *workspaces*
 * (Executive, Brand, Content, CRM, ERP, AI, Security, Operations, Backup,
 * Analytics, Documentation, System). Each workspace owns its own sidebar
 * (groups → items). The sidebar, workspace switcher, workspace home grid and the
 * command palette all derive from this one structure — add a module here and it
 * appears everywhere, so navigation scales to hundreds of modules without a
 * single unmanageable sidebar.
 *
 * Every `href` below points at a real admin page (kept in sync with the App
 * Router — the `audit:links` gate fails on any broken internal link). A module
 * may appear in more than one workspace; `workspaceForPath` resolves the active
 * one by longest-matching href.
 */

export interface WsItem { labelEn: string; labelFa: string; href: string; icon: string }
export interface WsGroup { en: string; fa: string; items: WsItem[] }
export interface Workspace {
  id: string
  nameEn: string; nameFa: string
  icon: string
  descEn: string; descFa: string
  /** RBAC hint — the minimum action required; undefined = any admin. */
  requires?: 'edit' | 'manage_settings' | 'manage_users'
  groups: WsGroup[]
}

export const WORKSPACES: Workspace[] = [
  {
    id: 'executive', nameEn: 'Executive', nameFa: 'اجرایی', icon: '◈',
    descEn: 'Business KPIs, alerts and global search', descFa: 'شاخص‌های کلیدی، هشدارها و جستجوی سراسری',
    groups: [{ en: 'Overview', fa: 'خلاصه', items: [
      { labelEn: 'Executive Dashboard', labelFa: 'داشبورد اجرایی', href: '/admin', icon: '◈' },
      { labelEn: 'Global Search', labelFa: 'جستجوی سراسری', href: '/admin/search', icon: '🔍' },
      { labelEn: 'Website Analytics', labelFa: 'آنالیتیکس سایت', href: '/admin/dashboard', icon: '◉' },
    ] }],
  },
  {
    id: 'brand', nameEn: 'Brand Platform', nameFa: 'پلتفرم برند', icon: '⬡',
    descEn: 'Public site content, portfolio and page builders', descFa: 'محتوای سایت عمومی، پورتفولیو و سازنده‌ها',
    groups: [
      { en: 'Personal Brand', fa: 'برند شخصی', items: [
        { labelEn: 'Executive Profile', labelFa: 'پروفایل اجرایی', href: '/admin/about', icon: '◍' },
        { labelEn: 'Leadership Journey', labelFa: 'مسیر رهبری', href: '/admin/timeline', icon: '◎' },
        { labelEn: 'Core Expertise', labelFa: 'تخصص‌های اصلی', href: '/admin/skills', icon: '◈' },
        { labelEn: 'Credentials', labelFa: 'گواهینامه‌ها', href: '/admin/credentials', icon: '🏅' },
      ] },
      { en: 'Content Hub', fa: 'مرکز محتوا', items: [
        { labelEn: 'All Content', labelFa: 'همه محتوا', href: '/admin/content', icon: '📝' },
        { labelEn: 'Blog', labelFa: 'بلاگ', href: '/admin/blog', icon: '✍️' },
        { labelEn: 'Hero & Landing', labelFa: 'هیرو و صفحه اصلی', href: '/admin/hero', icon: '⬡' },
      ] },
      { en: 'Technology', fa: 'فناوری', items: [
        { labelEn: 'Technology Catalog', labelFa: 'کاتالوگ فناوری', href: '/admin/technologies', icon: '⚙️' },
        { labelEn: 'Solutions', labelFa: 'راهکارها', href: '/admin/solutions', icon: '💡' },
        { labelEn: 'Services', labelFa: 'خدمات', href: '/admin/services', icon: '🛠️' },
        { labelEn: 'Industries', labelFa: 'صنایع', href: '/admin/industries', icon: '🏭' },
      ] },
      { en: 'Portfolio', fa: 'پورتفولیو', items: [
        { labelEn: 'Case Studies', labelFa: 'مطالعات موردی', href: '/admin/projects', icon: '◆' },
        { labelEn: 'Testimonials', labelFa: 'نظرات مشتریان', href: '/admin/testimonials', icon: '⭐' },
        { labelEn: 'Certifications', labelFa: 'گواهینامه‌ها', href: '/admin/certifications', icon: '📜' },
        { labelEn: 'Products & Platform', labelFa: 'محصولات و پلتفرم', href: '/admin/products', icon: '📦' },
        { labelEn: 'Academy', labelFa: 'آکادمی', href: '/admin/academy', icon: '🎓' },
        { labelEn: 'Events & Webinars', labelFa: 'رویدادها', href: '/admin/events-mgr', icon: '🗓️' },
      ] },
      { en: 'Builder & Media', fa: 'سازنده و رسانه', items: [
        { labelEn: 'Section Builder', labelFa: 'سازنده بخش‌ها', href: '/admin/sections', icon: '🧩' },
        { labelEn: 'Page Builder', labelFa: 'سازنده صفحات', href: '/admin/pages', icon: '📄' },
        { labelEn: 'Form Builder', labelFa: 'سازنده فرم', href: '/admin/forms', icon: '📋' },
        { labelEn: 'Menu Builder', labelFa: 'سازنده منو', href: '/admin/menus', icon: '☰' },
        { labelEn: 'Media Center', labelFa: 'مرکز رسانه', href: '/admin/media', icon: '▤' },
        { labelEn: 'Page Templates', labelFa: 'قالب‌های صفحه', href: '/admin/templates', icon: '🗂️' },
      ] },
    ],
  },
  {
    id: 'content', nameEn: 'Content Center', nameFa: 'مرکز محتوا', icon: '📚',
    descEn: 'Knowledge, articles, documentation and media', descFa: 'دانش، مقالات، مستندات و رسانه',
    groups: [{ en: 'Knowledge & Docs', fa: 'دانش و مستندات', items: [
      { labelEn: 'All Content', labelFa: 'همه محتوا', href: '/admin/content', icon: '📝' },
      { labelEn: 'Blog', labelFa: 'بلاگ', href: '/admin/blog', icon: '✍️' },
      { labelEn: 'Documentation', labelFa: 'مستندات', href: '/admin/docs', icon: '📄' },
      { labelEn: 'AI Knowledge Base', labelFa: 'پایگاه دانش هوش مصنوعی', href: '/admin/ai-kb', icon: '📚' },
      { labelEn: 'Prompt Library', labelFa: 'کتابخانه پرامپت', href: '/admin/ai-prompts', icon: '📝' },
      { labelEn: 'Media Center', labelFa: 'مرکز رسانه', href: '/admin/media', icon: '▤' },
    ] }],
  },
  {
    id: 'crm', nameEn: 'CRM Platform', nameFa: 'پلتفرم CRM', icon: '📇',
    descEn: 'Leads, clients, contacts and consultations', descFa: 'سرنخ‌ها، مشتریان، تماس‌ها و مشاوره‌ها',
    groups: [{ en: 'Customers', fa: 'مشتریان', items: [
      { labelEn: 'CRM — Leads', labelFa: 'مدیریت سرنخ‌ها', href: '/admin/crm', icon: '📇' },
      { labelEn: 'Clients', labelFa: 'مشتریان', href: '/admin/clients', icon: '🧑‍💼' },
      { labelEn: 'Organizations', labelFa: 'سازمان‌ها', href: '/admin/organizations', icon: '🏢' },
      { labelEn: 'Contact Requests', labelFa: 'درخواست‌های تماس', href: '/admin/contacts', icon: '✉' },
      { labelEn: 'Consultations', labelFa: 'مشاوره‌ها', href: '/admin/consultations', icon: '◎' },
    ] }],
  },
  {
    id: 'erp', nameEn: 'ERP Platform', nameFa: 'پلتفرم ERP', icon: '🏭', requires: 'edit',
    descEn: 'Finance, inventory, assets, sales, projects and automation', descFa: 'مالی، انبار، دارایی، فروش، پروژه و اتوماسیون',
    groups: [
      { en: 'Operations', fa: 'عملیات', items: [
        { labelEn: 'Financial Center', labelFa: 'مرکز مالی', href: '/admin/finance', icon: '💰' },
        { labelEn: 'Sales Center', labelFa: 'مرکز فروش', href: '/admin/sales', icon: '🛒' },
        { labelEn: 'Inventory Center', labelFa: 'مرکز انبار', href: '/admin/inventory', icon: '📦' },
        { labelEn: 'Asset Center', labelFa: 'مرکز دارایی‌ها', href: '/admin/assets', icon: '🖧' },
        { labelEn: 'Project Center', labelFa: 'مرکز پروژه', href: '/admin/project-management', icon: '📋' },
      ] },
      { en: 'Documents & Reports', fa: 'اسناد و گزارش‌ها', items: [
        { labelEn: 'Document Center', labelFa: 'مرکز اسناد', href: '/admin/documents', icon: '📄' },
        { labelEn: 'Reporting Center', labelFa: 'مرکز گزارش‌ها', href: '/admin/reports', icon: '📈' },
        { labelEn: 'Numbering Engine', labelFa: 'موتور شماره‌گذاری', href: '/admin/numbering', icon: '🔢' },
      ] },
      { en: 'Automation', fa: 'اتوماسیون', items: [
        { labelEn: 'Workflow Designer', labelFa: 'طراح گردش‌کار', href: '/admin/workflows', icon: '🔀' },
        { labelEn: 'Rules Center', labelFa: 'مرکز قوانین', href: '/admin/rules', icon: '⚖️' },
        { labelEn: 'Integration Hub', labelFa: 'مرکز یکپارچه‌سازی', href: '/admin/integration-hub', icon: '🔌' },
      ] },
    ],
  },
  {
    id: 'ai', nameEn: 'AI Platform', nameFa: 'پلتفرم هوش مصنوعی', icon: '🤖',
    descEn: 'Providers, agents, prompts, knowledge and analytics', descFa: 'ارائه‌دهنده‌ها، دستیارها، پرامپت‌ها، دانش و تحلیل',
    groups: [{ en: 'AI', fa: 'هوش مصنوعی', items: [
      { labelEn: 'AI Control Center', labelFa: 'مرکز کنترل هوش مصنوعی', href: '/admin/ai-control', icon: '🤖' },
      { labelEn: 'AI Agents', labelFa: 'دستیارهای هوش مصنوعی', href: '/admin/ai-agents', icon: '✨' },
      { labelEn: 'Prompt Center', labelFa: 'مرکز پرامپت', href: '/admin/ai-prompts', icon: '📝' },
      { labelEn: 'AI Knowledge Base', labelFa: 'پایگاه دانش', href: '/admin/ai-kb', icon: '📚' },
      { labelEn: 'AI Analytics', labelFa: 'تحلیل هوش مصنوعی', href: '/admin/ai-analytics', icon: '📊' },
    ] }],
  },
  {
    id: 'security', nameEn: 'Security Center', nameFa: 'مرکز امنیت', icon: '🛡️', requires: 'manage_users',
    descEn: 'Users, RBAC, 2FA, audit and security events', descFa: 'کاربران، دسترسی، ۲FA، حسابرسی و رویدادهای امنیتی',
    groups: [{ en: 'Security', fa: 'امنیت', items: [
      { labelEn: 'User Management', labelFa: 'مدیریت کاربران', href: '/admin/users', icon: '◉' },
      { labelEn: 'Security & 2FA', labelFa: 'امنیت و ۲FA', href: '/admin/security', icon: '🔐' },
      { labelEn: 'Security Operations (SOC)', labelFa: 'مرکز عملیات امنیت', href: '/admin/soc', icon: '🛡️' },
      { labelEn: 'Audit Center', labelFa: 'مرکز حسابرسی', href: '/admin/audit', icon: '▦' },
      { labelEn: 'Feature Flags', labelFa: 'پرچم‌های ویژگی', href: '/admin/flags', icon: '🚩' },
    ] }],
  },
  {
    id: 'operations', nameEn: 'Operations Center', nameFa: 'مرکز عملیات', icon: '🖥️',
    descEn: 'System health, database, logs and monitoring', descFa: 'سلامت سیستم، دیتابیس، لاگ و پایش',
    groups: [{ en: 'Operations', fa: 'عملیات', items: [
      { labelEn: 'Operations Center', labelFa: 'مرکز عملیات', href: '/admin/operations', icon: '🖥️' },
      { labelEn: 'Logs & Monitoring', labelFa: 'لاگ‌ها و پایش', href: '/admin/logs-monitoring', icon: '📡' },
      { labelEn: 'Database Center', labelFa: 'مرکز دیتابیس', href: '/admin/database', icon: '🗄️' },
    ] }],
  },
  {
    id: 'backup', nameEn: 'Backup Center', nameFa: 'مرکز پشتیبان', icon: '💾',
    descEn: 'Snapshots, restore, verification and disaster recovery', descFa: 'اسنپ‌شات، بازیابی، راستی‌آزمایی و بازیابی فاجعه',
    groups: [{ en: 'Backup & Recovery', fa: 'پشتیبان‌گیری و بازیابی', items: [
      { labelEn: 'Backup & Recovery', labelFa: 'پشتیبان‌گیری و بازیابی', href: '/admin/backup', icon: '💾' },
    ] }],
  },
  {
    id: 'analytics', nameEn: 'Analytics Center', nameFa: 'مرکز تحلیل', icon: '📊',
    descEn: 'Business, AI, reporting and SEO analytics', descFa: 'تحلیل کسب‌وکار، هوش مصنوعی، گزارش و سئو',
    groups: [{ en: 'Analytics', fa: 'تحلیل', items: [
      { labelEn: 'Website Analytics', labelFa: 'آنالیتیکس سایت', href: '/admin/dashboard', icon: '◉' },
      { labelEn: 'AI Analytics', labelFa: 'تحلیل هوش مصنوعی', href: '/admin/ai-analytics', icon: '📊' },
      { labelEn: 'Reporting Center', labelFa: 'مرکز گزارش‌ها', href: '/admin/reports', icon: '📈' },
      { labelEn: 'SEO Control Center', labelFa: 'مرکز کنترل سئو', href: '/admin/seo', icon: '🔎' },
    ] }],
  },
  {
    id: 'documentation', nameEn: 'Documentation', nameFa: 'مستندات', icon: '📖',
    descEn: 'Product, API and developer documentation', descFa: 'مستندات محصول، API و توسعه‌دهنده',
    groups: [{ en: 'Docs', fa: 'مستندات', items: [
      { labelEn: 'Documentation Center', labelFa: 'مرکز مستندات', href: '/admin/docs', icon: '📖' },
    ] }],
  },
  {
    id: 'system', nameEn: 'System Administration', nameFa: 'مدیریت سیستم', icon: '⚙️', requires: 'manage_settings',
    descEn: 'Settings, organization, integrations and platform config', descFa: 'تنظیمات، سازمان، یکپارچه‌سازی و پیکربندی پلتفرم',
    groups: [
      { en: 'Platform', fa: 'پلتفرم', items: [
        { labelEn: 'System Settings', labelFa: 'تنظیمات سیستم', href: '/admin/settings', icon: '⚙' },
        { labelEn: 'Feature Flags', labelFa: 'پرچم‌های ویژگی', href: '/admin/flags', icon: '🚩' },
        { labelEn: 'Numbering Engine', labelFa: 'موتور شماره‌گذاری', href: '/admin/numbering', icon: '🔢' },
        { labelEn: 'SEO Control Center', labelFa: 'مرکز کنترل سئو', href: '/admin/seo', icon: '🔎' },
      ] },
      { en: 'Organization', fa: 'سازمان', items: [
        { labelEn: 'HBZ Organization', labelFa: 'پروفایل شرکت', href: '/admin/organization', icon: '🏛️' },
        { labelEn: 'Sites', labelFa: 'سایت‌ها', href: '/admin/sites', icon: '🌐' },
        { labelEn: 'Workspaces', labelFa: 'فضاهای کاری', href: '/admin/workspaces', icon: '🗃️' },
        { labelEn: 'Partners', labelFa: 'شرکا', href: '/admin/partners', icon: '🤝' },
        { labelEn: 'Integrations', labelFa: 'یکپارچه‌سازی‌ها', href: '/admin/integrations', icon: '🔌' },
      ] },
    ],
  },
]

/** The workspace that owns a path (longest-matching href; first workspace wins ties). */
export function workspaceForPath(pathname: string): Workspace {
  // A workspace dashboard (/admin/dashboards/<id>) belongs to that workspace.
  const dash = pathname.match(/^\/admin\/dashboards\/([a-z]+)/)
  if (dash) { const w = workspaceById(dash[1]); if (w) return w }
  let best: Workspace | null = null
  let bestLen = -1
  for (const ws of WORKSPACES) {
    for (const g of ws.groups) {
      for (const it of g.items) {
        const h = it.href
        const match = pathname === h || (h !== '/admin' && pathname.startsWith(h))
        if (match && h.length > bestLen) { best = ws; bestLen = h.length }
      }
    }
  }
  return best ?? WORKSPACES[0]
}

export function workspaceById(id: string): Workspace | undefined {
  return WORKSPACES.find(w => w.id === id)
}

/** The landing route of a workspace (its first item). */
export function workspaceHome(ws: Workspace): string {
  return ws.groups[0]?.items[0]?.href ?? '/admin'
}

/** Every nav item across all workspaces, de-duplicated by href (for the palette). */
export function allNavItems(): (WsItem & { workspaceId: string })[] {
  const seen = new Set<string>()
  const out: (WsItem & { workspaceId: string })[] = []
  for (const ws of WORKSPACES) {
    for (const g of ws.groups) {
      for (const it of g.items) {
        if (seen.has(it.href)) continue
        seen.add(it.href)
        out.push({ ...it, workspaceId: ws.id })
      }
    }
  }
  return out
}
