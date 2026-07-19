import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { RulesCenter } from './RulesCenter'

export default async function RulesPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="Rules Center">
      <RulesCenter />
    </AdminShell>
  )
}
