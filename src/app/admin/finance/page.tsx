import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { FinanceCenter } from './FinanceCenter'

export default async function FinancePage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="Financial Center">
      <FinanceCenter />
    </AdminShell>
  )
}
