import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { ApprovalCenter } from './ApprovalCenter'

export default async function ApprovalsPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="Approval Center">
      <ApprovalCenter />
    </AdminShell>
  )
}
