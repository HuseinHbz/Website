'use client'

import { useState } from 'react'
import { AdminSidebar } from './AdminSidebar'
import { AdminHeader } from './AdminHeader'
import type { AdminUser } from '@/lib/admin/auth'

interface Props {
  user: AdminUser
  title: string
  children: React.ReactNode
}

export function AdminShell({ user, title, children }: Props) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="min-h-screen bg-[#080810] text-white flex">
      <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div className={`flex-1 flex flex-col transition-all duration-300 ${collapsed ? 'ml-16' : 'ml-60'}`}>
        <AdminHeader user={user} title={title} />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
