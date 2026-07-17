import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { DocumentCenter } from './DocumentCenter'

export default async function DocumentsPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="Document Center">
      <DocumentCenter />
    </AdminShell>
  )
}
