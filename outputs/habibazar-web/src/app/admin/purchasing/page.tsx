import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { PurchasingCenter } from './PurchasingCenter'

export default async function PurchasingPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="Purchasing Center">
      <PurchasingCenter />
    </AdminShell>
  )
}
