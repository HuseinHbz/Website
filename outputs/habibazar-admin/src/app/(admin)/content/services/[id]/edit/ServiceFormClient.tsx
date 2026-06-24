'use client'

import { useRouter } from 'next/navigation'
import { ServiceForm } from '@/components/content/ServiceForm'
import { apiPatch } from '@/lib/api'
import type { Service } from '@/lib/types'

interface ServiceFormClientProps {
  service: Service
}

export function ServiceFormClient({ service }: ServiceFormClientProps) {
  const router = useRouter()

  async function handleSubmit(data: Parameters<typeof apiPatch>[1]) {
    await apiPatch(`/api/v1/admin/content/services/${service.id}`, data)
    router.push('/content/services')
    router.refresh()
  }

  return <ServiceForm service={service} onSubmit={handleSubmit} />
}
