import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { IntegrationHub } from './IntegrationHub'

export default async function IntegrationHubPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="Integration Hub">
      <IntegrationHub />
    </AdminShell>
  )
}
