import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { TemplatesManager } from './TemplatesManager'

export default async function TemplatesPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return <AdminShell user={user} title="Page Templates"><TemplatesManager /></AdminShell>
}
