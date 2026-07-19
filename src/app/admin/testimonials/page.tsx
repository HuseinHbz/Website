import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { TestimonialsManager } from './TestimonialsManager'

export default async function TestimonialsPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return <AdminShell user={user} title="Client Testimonials"><TestimonialsManager /></AdminShell>
}
