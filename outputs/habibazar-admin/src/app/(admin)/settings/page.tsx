import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SettingsClient } from './SettingsClient'
import { PageHeader } from '@/components/ui/PageHeader'
import type { Setting } from '@/lib/types'

export const metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value
  if (!token) redirect('/login')

  const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.habibazar.ir'
  const res = await fetch(`${API}/api/v1/admin/settings`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (res.status === 401) redirect('/login')

  const json = await res.json()
  const settings: Setting[] = json.data || []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage application configuration."
      />
      <SettingsClient settings={settings} />
    </div>
  )
}
