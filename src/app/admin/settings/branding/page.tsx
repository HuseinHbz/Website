import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { BrandingSettings } from './BrandingSettings'

export default async function BrandingSettingsPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return <AdminShell user={user} title="Brand & Identity Settings"><BrandingSettings /></AdminShell>
}
