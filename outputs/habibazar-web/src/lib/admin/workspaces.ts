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

export interface WsItem { labelEn: string; labelFa: string; href: string; icon: string; requires?: WorkspaceRequire }
export interface WsGroup { en: string; fa: string; items: WsItem[] }
export type WorkspaceRequire = 'edit' | 'manage_settings' | 'manage_users'
export type AdminRole = 'super_admin' | 'administrator' | 'editor' | 'auditor' | 'viewer'
export interface Workspace {
  id: string
  nameEn: string; nameFa: string
  icon: string
  descEn: string; descFa: string
  /** RBAC hint — the minimum action required; undefined = any admin. */
  requires?: WorkspaceRequire
  groups: WsGroup[]
}

export const WORKSPACES: Workspace[] = [
  {
    id: 'executive', nameEn: 'Executive', nameFa: 'اجرایی', icon: '◈',
    descEn: 'Business KPIs, alerts and global search', descFa: 'شاخص‌های کلیدی، هشدارها و جستجوی سراسری',
    groups: [{ en: 'Overview', fa: 'خلاصه', items: [
      { labelEn: 'Executive Dashboard', labelFa: 'داشبورد اجرایی', href: '/admin', icon: '◈' },
      { labelEn: 'Global Search', labelFa: 'جستجوی سراسری', href: '/admin/search?focus=1', icon: '🔍' },
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
      { labelEn: 'CRM Dashboard', labelFa: 'داشبورد CRM', href: '/admin/crm/dashboard', icon: '📊' },
      { labelEn: 'CRM — Leads', labelFa: 'مدیریت سرنخ‌ها', href: '/admin/crm', icon: '📇' },
      { labelEn: 'Clients', labelFa: 'مشتریان', href: '/admin/clients', icon: '🧑‍💼' },
      { labelEn: 'Organizations', labelFa: 'سازمان‌ها', href: '/admin/organizations', icon: '🏢' },
      { labelEn: 'Contact Requests', labelFa: 'درخواست‌های تماس', href: '/admin/contacts', icon: '✉' },
      { labelEn: 'Consultations', labelFa: 'مشاوره‌ها', href: '/admin/consultations', icon: '◎' },
      { labelEn: 'Support Tickets', labelFa: 'تیکت‌های پشتیبانی', href: '/admin/crm/tickets', icon: '🎫' },
    ] }],
  },
  {
    id: 'erp', nameEn: 'ERP Platform', nameFa: 'پلتفرم ERP', icon: '🏭', requires: 'edit',
    descEn: 'Finance, inventory, assets, sales, projects and automation', descFa: 'مالی، انبار، دارایی، فروش، پروژه و اتوماسیون',
    groups: [
      { en: 'Operations', fa: 'عملیات', items: [
        { labelEn: 'Financial Center', labelFa: 'مرکز مالی', href: '/admin/finance', icon: '💰' },
        { labelEn: 'Financial Intelligence', labelFa: 'هوش مالی', href: '/admin/financial-intelligence', icon: '🧠' },
        { labelEn: 'Sales Center', labelFa: 'مرکز فروش', href: '/admin/sales', icon: '🛒' },
        { labelEn: 'Purchasing Center', labelFa: 'مرکز خرید', href: '/admin/purchasing', icon: '🧾' },
        { labelEn: 'Inventory Center', labelFa: 'مرکز انبار', href: '/admin/inventory', icon: '📦' },
        { labelEn: 'Asset Center', labelFa: 'مرکز دارایی‌ها', href: '/admin/assets', icon: '🖧' },
        { labelEn: 'Project Center', labelFa: 'مرکز پروژه', href: '/admin/project-management', icon: '📋' },
      ] },
      { en: 'Treasury', fa: 'خزانه‌داری', items: [
        { labelEn: 'Treasury Overview', labelFa: 'نمای خزانه', href: '/admin/treasury?tab=overview', icon: '🏦' },
        { labelEn: 'Banks', labelFa: 'بانک‌ها', href: '/admin/treasury?tab=banks', icon: '🏛️' },
        { labelEn: 'Statements', labelFa: 'صورت‌حساب‌ها', href: '/admin/treasury?tab=statements', icon: '📥' },
        { labelEn: 'Reconciliation', labelFa: 'مغایرت‌گیری', href: '/admin/treasury?tab=reconcile', icon: '🔗' },
        { labelEn: 'Payments', labelFa: 'پرداخت‌ها', href: '/admin/treasury?tab=payments', icon: '💸' },
        { labelEn: 'Receipts', labelFa: 'دریافت‌ها', href: '/admin/treasury?tab=receipts', icon: '🧾' },
        { labelEn: 'Cheques', labelFa: 'چک‌ها', href: '/admin/treasury?tab=cheques', icon: '📆' },
        { labelEn: 'Cash Forecast', labelFa: 'پیش‌بینی نقدینگی', href: '/admin/treasury?tab=cash', icon: '📈' },
        { labelEn: 'Risk Analysis', labelFa: 'تحلیل ریسک', href: '/admin/treasury?tab=risk', icon: '⚠️' },
        { labelEn: 'AI Treasury Assistant', labelFa: 'دستیار خزانه', href: '/admin/treasury?tab=ai', icon: '🤖' },
      ] },
      { en: 'Business Intelligence', fa: 'هوش تجاری', items: [
        { labelEn: 'Executive Cockpit', labelFa: 'کاکپیت اجرایی', href: '/admin/business-intelligence?tab=cockpit', icon: '🛰️' },
        { labelEn: 'KPI Center', labelFa: 'مرکز KPI', href: '/admin/business-intelligence?tab=kpi', icon: '🎯' },
        { labelEn: 'OKR Management', labelFa: 'مدیریت OKR', href: '/admin/business-intelligence?tab=okr', icon: '🧭' },
        { labelEn: 'Process Intelligence', labelFa: 'هوش فرایند', href: '/admin/business-intelligence?tab=process', icon: '🔬' },
        { labelEn: 'SLA Center', labelFa: 'مرکز SLA', href: '/admin/business-intelligence?tab=sla', icon: '⏳' },
        { labelEn: 'Alert Center', labelFa: 'مرکز هشدار', href: '/admin/business-intelligence?tab=alerts', icon: '🚨' },
        { labelEn: 'AI Business Advisor', labelFa: 'مشاور هوشمند', href: '/admin/business-intelligence?tab=advisor', icon: '🧠' },
      ] },
      { en: 'Documents & Reports', fa: 'اسناد و گزارش‌ها', items: [
        { labelEn: 'Document Center', labelFa: 'مرکز اسناد', href: '/admin/documents', icon: '📄' },
        { labelEn: 'Company Profile', labelFa: 'پروفایل شرکت', href: '/admin/company', icon: '🏢' },
        { labelEn: 'Reporting Center', labelFa: 'مرکز گزارش‌ها', href: '/admin/reports', icon: '📈' },
        { labelEn: 'Master Data Governance', labelFa: 'حاکمیت داده پایه', href: '/admin/master-data', icon: '🗂' },
        { labelEn: 'Import & Migration', labelFa: 'ورود و مهاجرت داده', href: '/admin/import-center', icon: '📥' },
        { labelEn: 'Numbering Engine', labelFa: 'موتور شماره‌گذاری', href: '/admin/numbering', icon: '🔢' },
      ] },
      { en: 'Automation', fa: 'اتوماسیون', items: [
        { labelEn: 'Approval Center', labelFa: 'مرکز تأیید', href: '/admin/approvals', icon: '✅' },
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
      { labelEn: 'Operational Health', labelFa: 'سلامت عملیاتی', href: '/admin/health', icon: '🩺' },
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
        { labelEn: 'Go-Live Checklist', labelFa: 'چک‌لیست راه‌اندازی', href: '/admin/settings/onboarding', icon: '🚀' },
        { labelEn: 'System Settings', labelFa: 'تنظیمات سیستم', href: '/admin/settings', icon: '⚙' },
        { labelEn: 'Company Profile', labelFa: 'پروفایل شرکت (اسناد)', href: '/admin/company', icon: '🏢' },
        { labelEn: 'Currency Settings', labelFa: 'تنظیمات ارز', href: '/admin/finance?tab=currency', icon: '💱' },
        { labelEn: 'Document Settings', labelFa: 'تنظیمات اسناد', href: '/admin/documents?view=designer', icon: '📑' },
        { labelEn: 'Security Settings', labelFa: 'تنظیمات امنیت', href: '/admin/security', icon: '🔐' },
        { labelEn: 'Audit & Logs', labelFa: 'ممیزی و لاگ‌ها', href: '/admin/logs-monitoring', icon: '📋' },
        { labelEn: 'Feature Flags', labelFa: 'پرچم‌های ویژگی', href: '/admin/flags', icon: '🚩' },
        { labelEn: 'Numbering Engine', labelFa: 'موتور شماره‌گذاری', href: '/admin/numbering', icon: '🔢' },
        { labelEn: 'Design System', labelFa: 'سیستم طراحی', href: '/admin/design-system', icon: '🎨' },
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


// ── Navigation Resolver Engine (Phase 26.7) ──────────────────────────────────
/** Strip the query/hash so hrefs with a `?new=` action never match a pathname. */
export function hrefPath(href: string): string {
  const q = href.search(/[?#]/)
  return q === -1 ? href : href.slice(0, q)
}
/** True when `pathname` equals `href` or is nested under it at a path boundary. */
export function hrefMatches(pathname: string, href: string): boolean {
  const h = hrefPath(href)
  if (h.includes('?') || href !== h) return pathname === href // action links: exact only (never true for a pathname)
  return pathname === h || (h !== '/admin' && pathname.startsWith(h + '/'))
}
/**
 * Resolve the ONE active href among candidates: exact match wins, else the
 * longest nested (boundary) match. Guarantees a unique active nav item even
 * when several candidates share a prefix or an href is duplicated.
 */
export function resolveActiveHref(pathname: string, hrefs: string[], activeTab?: string | null): string | null {
  // Tabbed nav (`?tab=`): the item whose tab matches the current URL wins, so
  // sibling tabs of the same page don't all light up (or collapse to the first).
  if (activeTab) {
    for (const href of hrefs) {
      const qi = href.indexOf('?')
      if (qi >= 0 && href.slice(0, qi) === pathname && href.slice(qi + 1) === `tab=${activeTab}`) return href
    }
  }
  let best: string | null = null
  for (const href of hrefs) {
    if (hrefPath(href) === pathname) return href // exact pathname match (first tab = default when no ?tab=)
    if (hrefMatches(pathname, href) && (best === null || hrefPath(href).length > hrefPath(best).length)) best = href
  }
  return best
}

/** True when a workspace contains a nav item whose path matches `pathname`. */
function workspaceOwnsPath(ws: Workspace, pathname: string): boolean {
  return ws.groups.some(g => g.items.some(it => {
    const p = hrefPath(it.href)
    return pathname === p || (p !== '/admin' && pathname.startsWith(p + '/'))
  }))
}

/**
 * The workspace that owns a path (longest-matching href; first workspace wins ties).
 *
 * BUG-010 second root (26.26b بند ۲.۱): many pages are **cross-listed** in several
 * workspaces (e.g. `/admin/dashboard` in both Executive and Analytics, `/admin/
 * reports` in Analytics + ERP). Context-free resolution always returns the
 * first-listed owner, so a user IN Analytics who clicks a cross-listed item was
 * yanked to Executive — exactly the reported jump. When `currentWorkspaceId` is
 * supplied and that workspace also owns the path, we KEEP the user there; only
 * when the current workspace does not own it do we fall back to longest-match.
 */
export function workspaceForPath(pathname: string, currentWorkspaceId?: string | null): Workspace {
  // A workspace dashboard (/admin/dashboards/<id>) belongs to that workspace.
  const dash = pathname.match(/^\/admin\/dashboards\/([a-z]+)/)
  if (dash) { const w = workspaceById(dash[1]); if (w) return w }
  // Context-aware: stay in the current workspace if it owns this path (cross-listing).
  if (currentWorkspaceId) {
    const cur = workspaceById(currentWorkspaceId)
    if (cur && workspaceOwnsPath(cur, pathname)) return cur
  }
  let best: Workspace | null = null
  let bestLen = -1
  for (const ws of WORKSPACES) {
    for (const g of ws.groups) {
      for (const it of g.items) {
        // Compare the PATH part only — an href with `?tab=` never equals a pathname,
        // so the old raw compare returned null → executive jump. Boundary-safe
        // startsWith so /admin/sales-returns ≠ /admin/sales.
        const p = hrefPath(it.href)
        const match = pathname === p || (p !== '/admin' && pathname.startsWith(p + '/'))
        if (match && p.length > bestLen) { best = ws; bestLen = p.length }
      }
    }
  }
  // No registered item owns this path → keep the caller on a stable default rather
  // than silently jumping workspaces. (Only truly-unknown admin paths reach here.)
  return best ?? WORKSPACES[0]
}

export function workspaceById(id: string): Workspace | undefined {
  return WORKSPACES.find(w => w.id === id)
}

/** The landing route of a workspace (its first item). */
export function workspaceHome(ws: Workspace): string {
  return ws.groups[0]?.items[0]?.href ?? '/admin'
}

// ── RBAC (client-safe mirror of lib/admin/auth.canDo) ────────────────────────
const ROLE_PERMS: Record<AdminRole, WorkspaceRequire[]> = {
  super_admin: ['edit', 'manage_settings', 'manage_users'],
  administrator: ['edit', 'manage_settings'],
  editor: ['edit'],
  auditor: [],
  viewer: [],
}

// Read-only roles see a curated workspace subset (26.22). The whitelist also
// grants the auditor the Security workspace (audit trail) despite its
// manage_users gate — the server still blocks every write for these roles.
const ROLE_WORKSPACE_WHITELIST: Record<string, string[]> = {
  viewer: ['executive', 'analytics', 'documentation'],
  auditor: ['executive', 'analytics', 'operations', 'security', 'documentation'],
}
/** Pure permission check usable on the client (server routes still enforce RBAC). */
export function roleCan(role: string, action: WorkspaceRequire): boolean {
  return (ROLE_PERMS[role as AdminRole] ?? []).includes(action)
}
export function canSeeWorkspace(role: string, ws: Workspace): boolean {
  const whitelist = ROLE_WORKSPACE_WHITELIST[role]
  if (whitelist) return whitelist.includes(ws.id)
  return !ws.requires || roleCan(role, ws.requires)
}
export function canSeeItem(role: string, ws: Workspace, item: WsItem): boolean {
  if (!canSeeWorkspace(role, ws)) return false
  return !item.requires || roleCan(role, item.requires)
}
/** Workspaces a role may see. */
export function visibleWorkspaces(role: string): Workspace[] {
  return WORKSPACES.filter(w => canSeeWorkspace(role, w))
}
/** A workspace's groups with items filtered by role (empty groups dropped). */
export function visibleGroups(role: string, ws: Workspace): WsGroup[] {
  return ws.groups
    .map(g => ({ ...g, items: g.items.filter(it => canSeeItem(role, ws, it)) }))
    .filter(g => g.items.length > 0)
}

// ── Quick actions (contextual, permission-aware; real navigations) ───────────
export interface QuickAction { labelEn: string; labelFa: string; href: string; icon: string; requires?: WorkspaceRequire }
export const QUICK_ACTIONS: Record<string, QuickAction[]> = {
  executive: [{ labelEn: 'Global Search', labelFa: 'جستجوی سراسری', href: '/admin/search?focus=1', icon: '🔍' }],
  brand: [
    { labelEn: 'New Case Study', labelFa: 'مطالعهٔ موردی جدید', href: '/admin/projects?new=1', icon: '＋' },
    { labelEn: 'New Content', labelFa: 'محتوای جدید', href: '/admin/content?new=1', icon: '✍️' },
  ],
  content: [{ labelEn: 'New Article', labelFa: 'مقالهٔ جدید', href: '/admin/blog?new=1', icon: '＋' }],
  crm: [{ labelEn: 'New Lead', labelFa: 'سرنخ جدید', href: '/admin/crm?new=1', icon: '＋' }],
  erp: [
    { labelEn: 'New Invoice', labelFa: 'فاکتور جدید', href: '/admin/sales?new=invoice', icon: '🧾', requires: 'edit' },
    { labelEn: 'New Product', labelFa: 'کالای جدید', href: '/admin/inventory?new=product', icon: '📦', requires: 'edit' },
    { labelEn: 'New Journal Entry', labelFa: 'سند حسابداری جدید', href: '/admin/finance?new=journal', icon: '💰', requires: 'edit' },
  ],
  ai: [
    { labelEn: 'New Prompt', labelFa: 'پرامپت جدید', href: '/admin/ai-prompts?new=1', icon: '＋' },
    { labelEn: 'New Agent', labelFa: 'دستیار جدید', href: '/admin/ai-agents?new=1', icon: '✨' },
  ],
  operations: [{ labelEn: 'Open Ops Center', labelFa: 'مرکز عملیات', href: '/admin/operations?focus=1', icon: '🖥️' }],
  security: [{ labelEn: 'New User', labelFa: 'کاربر جدید', href: '/admin/users?new=1', icon: '＋', requires: 'manage_users' }],
  system: [{ labelEn: 'Numbering Format', labelFa: 'قالب شماره‌گذاری', href: '/admin/numbering?tab=formats', icon: '🔢', requires: 'manage_settings' }],
}
export function quickActionsFor(role: string, workspaceId: string): QuickAction[] {
  return (QUICK_ACTIONS[workspaceId] ?? []).filter(a => !a.requires || roleCan(role, a.requires))
}

// ── Role default favorites (seeded for a new user with no pins) ───────────────
const ROLE_DEFAULT_FAVORITES: Record<string, string[]> = {
  super_admin: ['/admin', '/admin/finance', '/admin/crm', '/admin/operations', '/admin/users'],
  administrator: ['/admin', '/admin/finance', '/admin/crm', '/admin/reports'],
  editor: ['/admin', '/admin/content', '/admin/projects', '/admin/media'],
  auditor: ['/admin', '/admin/audit', '/admin/logs-monitoring', '/admin/reports'],
  viewer: ['/admin', '/admin/dashboard'],
}
/** Suggested starter favorites for a role — only hrefs the role may actually see. */
export function roleDefaultFavorites(role: string): string[] {
  const found = findItem
  return (ROLE_DEFAULT_FAVORITES[role] ?? ROLE_DEFAULT_FAVORITES.editor)
    .filter(href => { const f = found(href); return f ? canSeeItem(role, f.ws, f.item) : href === '/admin' })
}

// ── Breadcrumb engine ────────────────────────────────────────────────────────
export interface Crumb { labelEn: string; labelFa: string; href: string }
/** Find the nav item whose href best matches a path, with its workspace. */
export function findItem(pathname: string): { ws: Workspace; item: WsItem } | null {
  let best: { ws: Workspace; item: WsItem } | null = null
  let bestLen = -1
  for (const ws of WORKSPACES) for (const g of ws.groups) for (const it of g.items) {
    const h = it.href
    const match = pathname === h || (h !== '/admin' && pathname.startsWith(h))
    if (match && h.length > bestLen) { best = { ws, item: it }; bestLen = h.length }
  }
  return best
}
/** Build the breadcrumb trail for a path: Workspaces › Workspace › Module. */
export function breadcrumbFor(pathname: string): Crumb[] {
  const home: Crumb = { labelEn: 'Workspaces', labelFa: 'فضاهای کاری', href: '/admin/home' }
  const dash = pathname.match(/^\/admin\/dashboards\/([a-z]+)/)
  if (dash) {
    const ws = workspaceById(dash[1])
    if (ws) return [home, { labelEn: ws.nameEn, labelFa: ws.nameFa, href: workspaceHome(ws) }, { labelEn: 'Dashboard', labelFa: 'داشبورد', href: pathname }]
  }
  const found = findItem(pathname)
  if (!found) { const ws = workspaceForPath(pathname); return [home, { labelEn: ws.nameEn, labelFa: ws.nameFa, href: workspaceHome(ws) }] }
  const { ws, item } = found
  const crumbs: Crumb[] = [home, { labelEn: ws.nameEn, labelFa: ws.nameFa, href: workspaceHome(ws) }]
  if (item.href !== workspaceHome(ws)) crumbs.push({ labelEn: item.labelEn, labelFa: item.labelFa, href: item.href })
  return crumbs
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
