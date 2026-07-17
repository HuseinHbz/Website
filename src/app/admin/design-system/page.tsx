import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { DesignSystem } from './DesignSystem'

export default async function DesignSystemPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="Design System">
      <DesignSystem />
    </AdminShell>
  )
}
