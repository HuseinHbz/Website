import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { AboutEditor } from './AboutEditor'

export default async function AboutPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="About / Bio">
      <AboutEditor />
    </AdminShell>
  )
}
