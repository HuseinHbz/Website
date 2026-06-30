import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { IntegrationsManager } from './IntegrationsManager'

export default async function IntegrationsPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return <AdminShell user={user} title="Enterprise Integrations"><IntegrationsManager /></AdminShell>
}
