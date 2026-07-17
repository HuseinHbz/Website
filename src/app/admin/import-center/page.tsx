import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { ImportCenter } from './ImportCenter'

export default async function ImportCenterPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="Import & Migration Center">
      <ImportCenter role={user.role} />
    </AdminShell>
  )
}
