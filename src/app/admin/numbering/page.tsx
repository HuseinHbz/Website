import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { NumberingCenter } from './NumberingCenter'

export default async function NumberingPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="Numbering Engine">
      <NumberingCenter />
    </AdminShell>
  )
}
