import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { GlobalSearch } from './GlobalSearch'

export default async function SearchPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="Global Search">
      <GlobalSearch />
    </AdminShell>
  )
}
