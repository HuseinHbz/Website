import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { BusinessIntelligence } from './BusinessIntelligence'

export default async function BusinessIntelligencePage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="Business Intelligence">
      <BusinessIntelligence />
    </AdminShell>
  )
}
