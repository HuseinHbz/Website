import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { IntegrationSettings } from './IntegrationSettings'

export const metadata = { title: 'Integrations — HBZ Admin' }

// BUG-015 (26.26b): unified integration-credentials UI (Moadian/gateway/SMS/WA/Telegram).
export default async function Page() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="Integrations">
      <IntegrationSettings />
    </AdminShell>
  )
}
