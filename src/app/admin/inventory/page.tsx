import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { InventoryCenter } from './InventoryCenter'

export default async function InventoryPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="Inventory Center">
      <InventoryCenter />
    </AdminShell>
  )
}
