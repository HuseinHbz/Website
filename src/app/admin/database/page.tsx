import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { DatabaseHealth } from './DatabaseHealth'

export default async function DatabasePage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="Database Center">
      <DatabaseHealth />
    </AdminShell>
  )
}
