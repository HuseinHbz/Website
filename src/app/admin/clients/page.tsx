import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { ClientsManager } from './ClientsManager'

export default async function ClientsPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return <AdminShell user={user} title="Clients & Partners"><ClientsManager /></AdminShell>
}
