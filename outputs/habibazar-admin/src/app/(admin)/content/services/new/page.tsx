'use client'

import { useRouter } from 'next/navigation'
import { ServiceForm } from '@/components/content/ServiceForm'
import { PageHeader } from '@/components/ui/PageHeader'
import { apiPost } from '@/lib/api'

export default function NewServicePage() {
  const router = useRouter()

  async function handleSubmit(data: Parameters<typeof apiPost>[1]) {
    await apiPost('/api/v1/admin/content/services', data)
    router.push('/content/services')
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Service"
        description="Create a new service offering."
      />
      <div className="bg-surface border border-border rounded-xl p-6">
        <ServiceForm onSubmit={handleSubmit} />
      </div>
    </div>
  )
}
