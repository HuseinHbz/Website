import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { AnalyticsPanel } from './AnalyticsPanel'

export default async function AnalyticsPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return <AdminShell user={user} title="آمار و تحلیل"><AnalyticsPanel /></AdminShell>
}
