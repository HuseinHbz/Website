import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { AssetManager } from './AssetManager'

export default async function AssetsPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="Asset Center">
      <AssetManager />
    </AdminShell>
  )
}
