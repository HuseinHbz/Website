import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { ServiceFormClient } from './ServiceFormClient'
import { PageHeader } from '@/components/ui/PageHeader'
import type { Service } from '@/lib/types'

export const metadata = { title: 'Edit Service' }

interface EditServicePageProps {
  params: Promise<{ id: string }>
}

export default async function EditServicePage({ params }: EditServicePageProps) {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value
  if (!token) redirect('/login')

  const { id } = await params
  const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.habibazar.ir'

  const res = await fetch(`${API}/api/v1/admin/content/services/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (res.status === 401) redirect('/login')
  if (res.status === 404) notFound()

  const json = await res.json()
  const service: Service = json.data

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Service"
        description={service.titleEn || service.titleFa}
      />
      <div className="bg-surface border border-border rounded-xl p-6">
        <ServiceFormClient service={service} />
      </div>
    </div>
  )
}
