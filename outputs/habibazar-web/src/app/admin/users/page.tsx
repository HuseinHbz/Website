import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { UsersManager } from './UsersManager'

export default async function UsersPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  if (user.role === 'editor') redirect('/admin')
  return <AdminShell user={user} title="Users & Roles"><UsersManager currentUserId={user.id} /></AdminShell>
}
