import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { CertificationsManager } from './CertificationsManager'

export default async function CertificationsPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')

  return (
    <AdminShell user={user} title="Certifications">
      <CertificationsManager />
    </AdminShell>
  )
}
