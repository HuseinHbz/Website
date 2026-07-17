import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { SalesCenter } from './SalesCenter'

export default async function SalesPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="Sales Center">
      <SalesCenter />
    </AdminShell>
  )
}
