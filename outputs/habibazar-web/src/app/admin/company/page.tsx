import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { CompanyProfile } from './CompanyProfile'

export default async function CompanyPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="Company Profile">
      <CompanyProfile />
    </AdminShell>
  )
}
