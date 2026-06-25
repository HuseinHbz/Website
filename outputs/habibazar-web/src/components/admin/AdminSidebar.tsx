'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const NAV = [
  {
    group: 'Overview',
    items: [
      { label: 'Dashboard', href: '/admin', icon: '◈' },
      { label: 'Analytics', href: '/admin/dashboard', icon: '◉' },
    ],
  },
  {
    group: 'Content',
    items: [
      { label: 'Hero Section', href: '/admin/hero', icon: '⬡' },
      { label: 'About / Bio', href: '/admin/about', icon: '◍' },
      { label: 'Career Timeline', href: '/admin/timeline', icon: '◎' },
      { label: 'Skills', href: '/admin/skills', icon: '◈' },
      { label: 'Services', href: '/admin/services', icon: '◉' },
      { label: 'Projects', href: '/admin/projects', icon: '◆' },
      { label: 'Clients', href: '/admin/clients', icon: '◇' },
    ],
  },
  {
    group: 'Blog',
    items: [
      { label: 'Blog Posts', href: '/admin/blog', icon: '▣' },
    ],
  },
  {
    group: 'Requests',
    items: [
      { label: 'Contact Requests', href: '/admin/contacts', icon: '✉' },
      { label: 'Consultations', href: '/admin/consultations', icon: '◎' },
    ],
  },
  {
    group: 'Media & AI',
    items: [
      { label: 'Media Manager', href: '/admin/media', icon: '▤' },
      { label: 'AI Knowledge Base', href: '/admin/ai-kb', icon: '◈' },
    ],
  },
  {
    group: 'System',
    items: [
      { label: 'SEO Settings', href: '/admin/seo', icon: '◎' },
      { label: 'Site Settings', href: '/admin/settings', icon: '⚙' },
      { label: 'Users & Roles', href: '/admin/users', icon: '◉' },
      { label: 'Audit Logs', href: '/admin/audit', icon: '▦' },
    ],
  },
]

interface Props {
  collapsed: boolean
  onToggle: () => void
}

export function AdminSidebar({ collapsed, onToggle }: Props) {
  const pathname = usePathname()

  return (
    <aside
      className={`fixed top-0 left-0 h-screen bg-[#0c0c14] border-r border-[#1e1e2e] flex flex-col z-50 transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'}`}
    >
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-[#1e1e2e] gap-3 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white text-xs font-black flex-shrink-0">
          HBZ
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate">Admin Panel</div>
            <div className="text-[10px] text-slate-500 truncate">habibazar.com</div>
          </div>
        )}
        <button
          onClick={onToggle}
          className="ml-auto text-slate-500 hover:text-white transition-colors flex-shrink-0"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
        {NAV.map((section) => (
          <div key={section.group}>
            {!collapsed && (
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 px-2 mb-1">
                {section.group}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-all ${
                        active
                          ? 'bg-indigo-500/20 text-indigo-400 font-medium'
                          : 'text-slate-400 hover:bg-white/5 hover:text-white'
                      }`}
                      title={collapsed ? item.label : undefined}
                    >
                      <span className="text-base w-5 text-center flex-shrink-0">{item.icon}</span>
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-[#1e1e2e]">
        <Link
          href="/"
          target="_blank"
          className="flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-slate-500 hover:text-white hover:bg-white/5 transition-all"
          title="View public site"
        >
          <span>↗</span>
          {!collapsed && <span>View Public Site</span>}
        </Link>
      </div>
    </aside>
  )
}
