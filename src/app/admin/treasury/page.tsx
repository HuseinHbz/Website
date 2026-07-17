import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { TreasuryCenter } from './TreasuryCenter'

export default async function TreasuryPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="Treasury">
      <TreasuryCenter />
    </AdminShell>
  )
}
