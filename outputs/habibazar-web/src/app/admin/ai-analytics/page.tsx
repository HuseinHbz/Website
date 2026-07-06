import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { AiAnalyticsDashboard } from './AiAnalyticsDashboard'

export default async function AiAnalyticsPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="AI Analytics">
      <AiAnalyticsDashboard />
    </AdminShell>
  )
}
