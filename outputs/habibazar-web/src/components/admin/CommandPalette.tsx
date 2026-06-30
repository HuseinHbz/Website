'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Command {
  id: string
  label: string
  labelFa: string
  description?: string
  descriptionFa?: string
  icon: string
  href?: string
  action?: () => void
  group: string
  groupFa: string
  keywords?: string
}

const COMMANDS: Command[] = [
  // Navigation
  { id: 'dashboard', label: 'Dashboard', labelFa: 'داشبورد', icon: '◈', href: '/admin', group: 'Navigation', groupFa: 'ناوبری' },
  { id: 'analytics', label: 'Analytics', labelFa: 'آنالیتیکس', icon: '◉', href: '/admin/dashboard', group: 'Navigation', groupFa: 'ناوبری' },
  // Content
  { id: 'hero', label: 'Hero Section', labelFa: 'بخش هیرو', icon: '⬡', href: '/admin/hero', group: 'Content', groupFa: 'محتوا', keywords: 'hero banner' },
  { id: 'about', label: 'Executive Profile', labelFa: 'پروفایل اجرایی', icon: '◍', href: '/admin/about', group: 'Content', groupFa: 'محتوا', keywords: 'about bio profile' },
  { id: 'timeline', label: 'Leadership Journey', labelFa: 'مسیر رهبری', icon: '◎', href: '/admin/timeline', group: 'Content', groupFa: 'محتوا', keywords: 'career timeline' },
  { id: 'skills', label: 'Core Expertise', labelFa: 'تخصص‌های اصلی', icon: '◈', href: '/admin/skills', group: 'Content', groupFa: 'محتوا', keywords: 'skills expertise' },
  { id: 'certs', label: 'Professional Credentials', labelFa: 'گواهینامه‌های حرفه‌ای', icon: '🏅', href: '/admin/credentials', group: 'Content', groupFa: 'محتوا', keywords: 'certifications credentials awards badges' },
  { id: 'services', label: 'Technology Solutions', labelFa: 'راهکارهای فناوری', icon: '◉', href: '/admin/services', group: 'Content', groupFa: 'محتوا', keywords: 'services solutions' },
  { id: 'projects', label: 'Enterprise Case Studies', labelFa: 'مطالعات موردی', icon: '◆', href: '/admin/projects', group: 'Content', groupFa: 'محتوا', keywords: 'projects case studies' },
  { id: 'organizations', label: 'Organization Hub', labelFa: 'هاب سازمان‌ها', icon: '◇', href: '/admin/organizations', group: 'Content', groupFa: 'محتوا', keywords: 'clients partners companies organizations employers' },
  { id: 'content-hub', label: 'Content Hub', labelFa: 'هاب محتوا', icon: '▣', href: '/admin/content', group: 'Content', groupFa: 'محتوا', keywords: 'blog posts articles docs tutorials knowledge content' },
  // Solutions
  { id: 'solutions', label: 'Technology Solutions', labelFa: 'راهکارهای فناوری', icon: '💡', href: '/admin/solutions', group: 'Solutions', groupFa: 'راهکارها', keywords: 'solutions enterprise technology' },
  { id: 'industries', label: 'Industries', labelFa: 'صنایع', icon: '🏭', href: '/admin/industries', group: 'Solutions', groupFa: 'راهکارها', keywords: 'industries verticals sectors' },
  { id: 'technologies', label: 'Technology Ecosystem', labelFa: 'اکوسیستم فناوری', icon: '⚙️', href: '/admin/technologies', group: 'Solutions', groupFa: 'راهکارها', keywords: 'technologies ecosystem cisco vmware azure' },
  { id: 'testimonials', label: 'Client Testimonials', labelFa: 'نظرات مشتریان', icon: '⭐', href: '/admin/testimonials', group: 'Solutions', groupFa: 'راهکارها', keywords: 'testimonials reviews clients success' },
  { id: 'templates', label: 'Page Templates', labelFa: 'قالب‌های صفحه', icon: '🗂️', href: '/admin/templates', group: 'Solutions', groupFa: 'راهکارها', keywords: 'templates pages layouts builder' },
  // Enterprise
  { id: 'organization', label: 'Organization', labelFa: 'سازمان', icon: '🏢', href: '/admin/organization', group: 'Enterprise', groupFa: 'سازمانی', keywords: 'organization company brand legal' },
  { id: 'sites', label: 'Sites', labelFa: 'سایت‌ها', icon: '🌐', href: '/admin/sites', group: 'Enterprise', groupFa: 'سازمانی', keywords: 'sites domains workspaces multi-site' },
  { id: 'workspaces', label: 'Workspaces', labelFa: 'فضاهای کاری', icon: '🗂️', href: '/admin/workspaces', group: 'Enterprise', groupFa: 'سازمانی', keywords: 'workspaces teams departments' },
  { id: 'partners', label: 'Partners', labelFa: 'شرکا', icon: '🤝', href: '/admin/partners', group: 'Enterprise', groupFa: 'سازمانی', keywords: 'partners reseller distributor tier gold silver' },
  { id: 'integrations', label: 'Integrations', labelFa: 'یکپارچه‌سازی‌ها', icon: '🔌', href: '/admin/integrations', group: 'Enterprise', groupFa: 'سازمانی', keywords: 'integrations microsoft azure slack github jira' },
  // Products
  { id: 'products', label: 'Products & Platform', labelFa: 'محصولات و پلتفرم', icon: '📦', href: '/admin/products', group: 'Products', groupFa: 'محصولات', keywords: 'products software hardware saas subscriptions' },
  // Academy
  { id: 'academy', label: 'Courses & Learning', labelFa: 'دوره‌ها و یادگیری', icon: '🎓', href: '/admin/academy', group: 'Academy', groupFa: 'آکادمی', keywords: 'courses academy learning paths certifications bootcamp' },
  // Documentation
  { id: 'docs', label: 'Documentation Center', labelFa: 'مرکز مستندات', icon: '📄', href: '/admin/docs', group: 'Documentation', groupFa: 'مستندات', keywords: 'docs documentation api runbook tutorial guide' },
  // Community
  { id: 'events-mgr', label: 'Events & Webinars', labelFa: 'رویدادها و وبینارها', icon: '🗓️', href: '/admin/events-mgr', group: 'Community', groupFa: 'جامعه', keywords: 'events webinars conferences meetups community' },
  // Operations
  { id: 'operations', label: 'Operations Center', labelFa: 'مرکز عملیات', icon: '🖥️', href: '/admin/operations', group: 'Operations', groupFa: 'عملیات', keywords: 'operations monitoring performance errors security uptime' },
  // Builder
  { id: 'sections', label: 'Section Builder', labelFa: 'سازنده بخش‌ها', icon: '🧩', href: '/admin/sections', group: 'Builder', groupFa: 'سازنده', keywords: 'sections builder' },
  { id: 'pages', label: 'Page Builder', labelFa: 'سازنده صفحات', icon: '📄', href: '/admin/pages', group: 'Builder', groupFa: 'سازنده', keywords: 'pages builder' },
  { id: 'forms', label: 'Form Builder', labelFa: 'سازنده فرم', icon: '📋', href: '/admin/forms', group: 'Builder', groupFa: 'سازنده', keywords: 'forms contact newsletter custom fields' },
  { id: 'menus', label: 'Menu Builder', labelFa: 'سازنده منو', icon: '☰', href: '/admin/menus', group: 'Builder', groupFa: 'سازنده', keywords: 'menus navigation header footer' },
  // Requests
  { id: 'contacts', label: 'Contact Requests', labelFa: 'درخواست‌های تماس', icon: '✉', href: '/admin/contacts', group: 'Requests', groupFa: 'درخواست‌ها', keywords: 'contacts leads' },
  { id: 'consultations', label: 'Consultations', labelFa: 'مشاوره‌ها', icon: '◎', href: '/admin/consultations', group: 'Requests', groupFa: 'درخواست‌ها', keywords: 'consultations bookings' },
  // Media & AI
  { id: 'media', label: 'Media Center', labelFa: 'مرکز رسانه', icon: '▤', href: '/admin/media', group: 'Media & AI', groupFa: 'رسانه و هوش مصنوعی', keywords: 'media images files upload' },
  { id: 'ai-control', label: 'AI Control Center', labelFa: 'مرکز کنترل هوش مصنوعی', icon: '🤖', href: '/admin/ai-control', group: 'Media & AI', groupFa: 'رسانه و هوش مصنوعی', keywords: 'ai modules knowledge analytics settings provider' },
  { id: 'ai-kb', label: 'AI Knowledge Base', labelFa: 'پایگاه دانش هوش مصنوعی', icon: '📚', href: '/admin/ai-kb', group: 'Media & AI', groupFa: 'رسانه و هوش مصنوعی', keywords: 'ai knowledge rag vector documents' },
  { id: 'ai-platform', label: 'Open AI Platform', labelFa: 'باز کردن پلتفرم هوش مصنوعی', icon: '✦', href: '/en/ai', group: 'Quick Actions', groupFa: 'اقدامات سریع', keywords: 'ai platform chat advisor' },
  // System
  { id: 'seo', label: 'SEO Control Center', labelFa: 'مرکز کنترل سئو', icon: '◎', href: '/admin/seo', group: 'System', groupFa: 'سیستم', keywords: 'seo meta tags sitemap' },
  { id: 'settings', label: 'System Settings', labelFa: 'تنظیمات سیستم', icon: '⚙', href: '/admin/settings', group: 'System', groupFa: 'سیستم', keywords: 'settings config brand' },
  { id: 'users', label: 'User Management', labelFa: 'مدیریت کاربران', icon: '◉', href: '/admin/users', group: 'System', groupFa: 'سیستم', keywords: 'users roles rbac permissions' },
  { id: 'security', label: 'Security & 2FA', labelFa: 'امنیت و ۲FA', icon: '🔐', href: '/admin/security', group: 'System', groupFa: 'سیستم', keywords: 'security 2fa mfa auth' },
  { id: 'audit', label: 'Audit Center', labelFa: 'مرکز حسابرسی', icon: '▦', href: '/admin/audit', group: 'System', groupFa: 'سیستم', keywords: 'audit logs activity trail' },
  { id: 'backup', label: 'Backup & Recovery', labelFa: 'پشتیبان‌گیری و بازیابی', icon: '💾', href: '/admin/backup', group: 'System', groupFa: 'سیستم', keywords: 'backup restore recovery' },
  // Quick actions
  { id: 'new-post', label: 'New Content', labelFa: 'محتوای جدید', icon: '✏', href: '/admin/content', group: 'Quick Actions', groupFa: 'اقدامات سریع', keywords: 'new create post write content blog docs' },
  { id: 'new-project', label: 'New Case Study', labelFa: 'مطالعه موردی جدید', icon: '+', href: '/admin/projects', group: 'Quick Actions', groupFa: 'اقدامات سریع', keywords: 'new create case study project' },
  { id: 'view-site', label: 'View Public Site', labelFa: 'مشاهده سایت عمومی', icon: '↗', href: '/', group: 'Quick Actions', groupFa: 'اقدامات سریع', keywords: 'site preview public' },
]

interface Props {
  open: boolean
  onClose: () => void
  locale: 'fa' | 'en'
}

export function CommandPalette({ open, onClose, locale }: Props) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const isRTL = locale === 'fa'

  const filtered = COMMANDS.filter(cmd => {
    if (!query) return true
    const q = query.toLowerCase()
    return (
      cmd.label.toLowerCase().includes(q) ||
      cmd.labelFa.includes(q) ||
      cmd.group.toLowerCase().includes(q) ||
      (cmd.keywords || '').toLowerCase().includes(q)
    )
  })

  // Group filtered results
  const grouped = filtered.reduce<Record<string, Command[]>>((acc, cmd) => {
    const key = isRTL ? cmd.groupFa : cmd.group
    if (!acc[key]) acc[key] = []
    acc[key].push(cmd)
    return acc
  }, {})

  // Flat list for keyboard nav
  const flat = filtered

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const execute = useCallback((cmd: Command) => {
    onClose()
    if (cmd.action) { cmd.action() }
    else if (cmd.href) {
      if (cmd.href.startsWith('/') && !cmd.href.startsWith('/admin')) {
        window.open(cmd.href, '_blank')
      } else {
        router.push(cmd.href)
      }
    }
  }, [onClose, router])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, flat.length - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
      if (e.key === 'Enter' && flat[selected]) { execute(flat[selected]) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, flat, selected, execute, onClose])

  if (!open) return null

  let globalIdx = 0

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Palette */}
      <div className="relative w-full max-w-2xl mx-4 rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: '#0e0e1a', border: '1px solid rgba(99,102,241,0.3)' }}>

        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'rgba(99,102,241,0.15)' }}>
          <span className="text-slate-500 text-sm shrink-0">🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0) }}
            placeholder={isRTL ? 'جستجو در دستورات، صفحات، محتوا...' : 'Search commands, pages, content...'}
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder-slate-600"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded text-slate-600" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {Object.entries(grouped).length === 0 && (
            <div className="text-center py-12 text-slate-600 text-sm">
              {isRTL ? 'نتیجه‌ای یافت نشد' : 'No results found'}
            </div>
          )}

          {Object.entries(grouped).map(([group, cmds]) => (
            <div key={group}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 px-4 pt-3 pb-1">{group}</p>
              {cmds.map(cmd => {
                const idx = flat.indexOf(cmd)
                const isSelected = idx === selected
                return (
                  <button
                    key={cmd.id}
                    onClick={() => execute(cmd)}
                    onMouseEnter={() => setSelected(idx)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all text-left"
                    style={{
                      background: isSelected ? 'rgba(99,102,241,0.15)' : 'transparent',
                      color: isSelected ? '#c7d2fe' : '#94a3b8',
                    }}
                  >
                    <span className="text-base w-5 text-center shrink-0" style={{ color: isSelected ? '#6366f1' : '#4b5563' }}>
                      {cmd.icon}
                    </span>
                    <span className="flex-1 text-start">{isRTL ? cmd.labelFa : cmd.label}</span>
                    {isSelected && (
                      <kbd className="text-[10px] px-1.5 py-0.5 rounded text-slate-600 shrink-0"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>↵</kbd>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2 border-t text-[10px] text-slate-600" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <span><kbd className="text-slate-500">↑↓</kbd> {isRTL ? 'ناوبری' : 'navigate'}</span>
          <span><kbd className="text-slate-500">↵</kbd> {isRTL ? 'انتخاب' : 'select'}</span>
          <span><kbd className="text-slate-500">ESC</kbd> {isRTL ? 'بستن' : 'close'}</span>
          <span className="ml-auto">{isRTL ? `${flat.length} نتیجه` : `${flat.length} results`}</span>
        </div>
      </div>
    </div>
  )
}
