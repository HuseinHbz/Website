import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { MasterDataGovernance } from './MasterDataGovernance'

export default async function MasterDataPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="Master Data Governance">
      <MasterDataGovernance role={user.role} />
    </AdminShell>
  )
}
