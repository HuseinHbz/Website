import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { FinancialIntelligence } from './FinancialIntelligence'

export default async function FinancialIntelligencePage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return (
    <AdminShell user={user} title="Financial Intelligence">
      <FinancialIntelligence />
    </AdminShell>
  )
}
