import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { StatCards } from '@/components/dashboard/StatCards'
import { RecentLeads } from '@/components/dashboard/RecentLeads'
import { RecentConsultations } from '@/components/dashboard/RecentConsultations'
import type { DashboardStats } from '@/lib/types'

export const metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value
  if (!token) redirect('/login')

  const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.habibazar.ir'
  const res = await fetch(`${API}/api/v1/admin/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (res.status === 401) redirect('/login')

  const json = await res.json()
  const stats: DashboardStats = json.data

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
      <StatCards stats={stats} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentLeads leads={stats.recentLeads || []} />
        <RecentConsultations consultations={stats.recentConsultations || []} />
      </div>
    </div>
  )
}
