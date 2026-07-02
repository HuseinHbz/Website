import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { LogsMonitoring } from './LogsMonitoring'

export default async function LogsMonitoringPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="Logs & Monitoring">
      <LogsMonitoring />
    </AdminShell>
  )
}
